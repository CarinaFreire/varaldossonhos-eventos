// /api/eventos.js — Função serverless (Vercel) para listar eventos do Airtable
import Airtable from "airtable";

export const config = { runtime: "nodejs" };

/* Helpers para manter compatível com nomes de campos que vocês já usaram */
function getField(f, keys) { for (const k of keys) if (k in f && f[k] != null) return f[k]; }
function toISOorNull(v){ if(!v) return null; const d=new Date(v); return isNaN(d)?null:d.toISOString(); }
function statusAuto(iniISO, fimISO){
  const hoje = new Date();
  const ini = iniISO ? new Date(iniISO) : null;
  const fim = fimISO ? new Date(fimISO) : null;
  if (ini && hoje < ini) return "em breve";
  if (fim && hoje > fim) return "encerrado";
  return "em andamento";
}
function mapEvento(r){
  const f = r.fields || {};

  // nomes que vimos no seu base (e alguns apelidos como fallback)
  const nome_evento = getField(f, ["nome_evento","Nome do Evento","nome"]) || "";
  const local_evento = getField(f, ["local_evento","escola_local","Local","Escola"]) || "";
  const endereco = getField(f, ["endereco","Endereço"]) || "";
  const descricao = getField(f, ["descricao","Descrição","descricao_evento"]) || "";

  // no seu base real o início é "data_evento"
  const data_inicio_raw = getField(f, ["data_evento","data_inicio","Data do Evento"]);
  const data_fim_raw    = getField(f, ["data_fim","fim","término"]);

  const data_evento = toISOorNull(data_inicio_raw);
  const data_fim    = toISOorNull(data_fim_raw);

  const status_raw = getField(f, ["status_evento","status"]) || statusAuto(data_evento, data_fim);
  const imagens    = getField(f, ["imagem","imagem_evento","Anexos"]) || [];
  const destaque   = !!getField(f, ["destacar_na_homepage","destaque_home"]);

  return {
    airtable_id: r.id,
    id_evento: getField(f, ["id_evento","ID"]) ?? null,
    nome_evento,
    descricao,
    status_evento: status_raw,
    local_evento,
    endereco,
    data_evento,
    data_fim,
    data_limite_recebimento: toISOorNull(getField(f, ["data_limite_recebimento"])),
    imagem: Array.isArray(imagens) ? imagens : [],
    destacar_na_homepage: destaque
  };
}

export default async function handler(req, res) {
  // CORS simples — seguro mesmo domínio
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();

  try {
    const { AIRTABLE_API_KEY, AIRTABLE_BASE_ID } = process.env;
    const TABLE = process.env.AIRTABLE_EVENTOS_TABLE || "eventos";
    if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
      return res.status(500).json({ sucesso:false, mensagem:"Variáveis do Airtable ausentes." });
    }

    const base = new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID);

    // sem "fields" e sem "sort" aqui para evitar erros de campo inexistente
    const records = await base(TABLE).select().all();

    // mapeia + descarta registros completamente vazios
    let eventos = records.map(mapEvento)
      .filter(ev => (ev.nome_evento && ev.nome_evento.trim()) || ev.data_evento);

    // filtro opcional por status: /api/eventos?status=em%20breve|em%20andamento|encerrado
    const statusFiltro = (req.query.status || "").trim().toLowerCase();
    if (statusFiltro) {
      eventos = eventos.filter(ev => (ev.status_evento || "").toLowerCase() === statusFiltro);
    }

    // ordena por data de início (nulos vão pro fim)
    eventos.sort((a,b)=>{
      const da = a.data_evento ? new Date(a.data_evento).getTime() : Infinity;
      const db = b.data_evento ? new Date(b.data_evento).getTime() : Infinity;
      return da - db;
    });

    res.status(200).json({ sucesso:true, eventos });
  } catch (e) {
    console.error("Erro /api/eventos:", e);
    res.status(500).json({ sucesso:false, mensagem:"Erro ao listar eventos.", detalhe:e.message });
  }
}



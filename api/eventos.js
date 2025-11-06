// /api/eventos.js — robusto a variações de nomes de campos no Airtable
import Airtable from "airtable";
export const config = { runtime: "nodejs" };

// tenta pegar o primeiro campo existente na lista
function pick(f, keys) {
  for (const k of keys) {
    if (k in f && f[k] != null) return f[k];
  }
  return undefined;
}
function toISOorNull(v) {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d) ? null : d.toISOString();
}
function statusAuto(iniISO, fimISO) {
  const hoje = new Date();
  const ini  = iniISO ? new Date(iniISO) : null;
  const fim  = fimISO ? new Date(fimISO) : null;
  if (ini && hoje < ini) return "em breve";
  if (fim && hoje > fim) return "encerrado";
  return "em andamento";
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();

  try {
    const { AIRTABLE_API_KEY, AIRTABLE_BASE_ID } = process.env;
    const TABLE = process.env.AIRTABLE_EVENTOS_TABLE || "eventos";
    if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
      return res.status(500).json({
        sucesso: false,
        mensagem: "Faltam AIRTABLE_API_KEY / AIRTABLE_BASE_ID",
      });
    }

    const base = new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID);

    // Sem fields/sort para evitar 422 por nomes diferentes
    const records = await base(TABLE).select().all();

    let eventos = records.map(r => {
      const f = r.fields || {};

      const nome_evento = pick(f, ["nome_evento","nome","titulo","título","Nome do Evento"]);
      const local_evento = pick(f, ["escola_local","local_evento","Local","local","Escola"]);
      const endereco     = pick(f, ["endereco","endereço","Endereco","Endereço"]);
      const descricao    = pick(f, ["descricao","descrição","Descrição","descricao_evento"]);

      const data_ini_raw = pick(f, ["data_inicio","data início","data_evento","inicio","Início","Data do Evento"]);
      const data_fim_raw = pick(f, ["data_fim","data fim","término","termino","fim","Fim"]);

      const status_raw   = pick(f, ["status","status_evento","Status"]);
      const imagens      = pick(f, ["imagem_evento","imagem","imagens","Anexos"]) || [];
      const destaque     = !!pick(f, ["destaque_home","destacar_na_homepage","Destacar na Homepage"]);

      const data_evento = toISOorNull(data_ini_raw);
      const data_fim    = toISOorNull(data_fim_raw);

      return {
        airtable_id: r.id,
        id_evento: pick(f, ["id_evento","ID","id"]) ?? null,
        nome_evento: nome_evento ?? "",
        descricao: descricao ?? "",
        status_evento: status_raw ?? statusAuto(data_evento, data_fim),
        local_evento: local_evento ?? "",
        endereco: endereco ?? "",
        data_evento,
        data_fim,
        imagem: Array.isArray(imagens) ? imagens : [],
        destacar_na_homepage: destaque,
        _raw_fields: f, // debug opcional
      };
    });

    // filtro opcional por status (?status=em%20breve|em%20andamento|encerrado)
    const filtro = (req.query.status || "").trim().toLowerCase();
    if (filtro) {
      eventos = eventos.filter(ev => (ev.status_evento || "").toLowerCase() === filtro);
    }

    // ordena por data de início (nulos vão ao final)
    eventos.sort((a,b) => {
      const da = a.data_evento ? new Date(a.data_evento).getTime() : Infinity;
      const db = b.data_evento ? new Date(b.data_evento).getTime() : Infinity;
      return da - db;
    });

    // evita cartões vazios
    eventos = eventos.filter(ev => (ev.nome_evento && ev.nome_evento.trim()) || ev.data_evento);

    return res.status(200).json({ sucesso: true, eventos });
  } catch (e) {
    console.error("Erro /api/eventos:", e);
    return res.status(500).json({
      sucesso: false,
      mensagem: "Erro ao listar eventos.",
      detalhe: e?.message || String(e),
    });
  }
}


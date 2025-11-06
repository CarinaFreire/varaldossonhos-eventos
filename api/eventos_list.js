// /api/eventos_list.js — robusto a nomes de campos diferentes no Airtable
import Airtable from "airtable";
export const config = { runtime: "nodejs" };

// utilzinho pra pegar o 1º nome que existir
function pick(f, keys) {
  for (const k of keys) {
    if (k in f && f[k] != null) return f[k];
  }
  return undefined;
}
function toISO(v) {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d) ? null : d.toISOString();
}
function statusAuto(dtIniISO, dtFimISO) {
  const hoje = new Date();
  const ini = dtIniISO ? new Date(dtIniISO) : null;
  const fim = dtFimISO ? new Date(dtFimISO) : null;
  if (ini && hoje < ini) return "em breve";
  if (fim && hoje > fim) return "encerrado";
  return "em andamento";
}
function mapEvento(rec) {
  const f = rec.fields || {};

  const nome_evento = pick(f, ["nome_evento", "nome", "titulo", "título"]);
  const local_evento = pick(f, ["local_evento", "escola_local", "local", "Escola"]);
  const endereco = pick(f, ["endereco", "endereço", "Endereco", "Endereço"]);
  const descricao = pick(f, ["descricao", "descrição", "Descrição"]);

  // datas com variações de nome
  const raw_inicio = pick(f, ["data_evento", "data_inicio", "data início", "Data do Evento", "inicio", "Início"]);
  const raw_fim    = pick(f, ["data_fim", "data fim", "fim", "Fim"]);

  // status e imagem (variações)
  const status_raw = pick(f, ["status_evento", "status", "Status"]);
  const imagens    = pick(f, ["imagem", "imagem_evento", "Imagem", "imagens", "Anexos"]) || [];
  const destaque   = !!pick(f, ["destacar_na_homepage", "destaque_home", "Destacar na Homepage"]);

  const data_evento = toISO(raw_inicio);
  const data_fim    = toISO(raw_fim);

  return {
    airtable_id: rec.id,
    id_evento: pick(f, ["id_evento", "ID", "id"]) ?? null,
    nome_evento: nome_evento ?? "",
    descricao: descricao ?? "",
    status_evento: status_raw ?? statusAuto(data_evento, data_fim),
    local_evento: local_evento ?? "",
    endereco: endereco ?? "",
    data_evento,
    data_fim,
    data_limite_recebimento: toISO(pick(f, ["data_limite_recebimento", "data limite"])),
    imagem: Array.isArray(imagens) ? imagens : [],
    destacar_na_homepage: destaque,
    _raw_fields: f, // útil para debug
  };
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
        mensagem: "Faltam AIRTABLE_API_KEY e/ou AIRTABLE_BASE_ID nas variáveis de ambiente.",
      });
    }

    const base = new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID);

    // 🔸 NÃO usamos fields/sort/filterByFormula para evitar "Unknown field"
    const records = await base(TABLE).select().all();

    let eventos = records.map(mapEvento);

    // remove placeholders vazios
    eventos = eventos.filter(ev => (ev.nome_evento && ev.nome_evento.trim()) || ev.data_evento);

    // filtros por query — feitos em JS, não no Airtable
    const status = (req.query.status || "").toLowerCase().trim();
    const destacados = req.query.destacados === "true";

    if (status) {
      eventos = eventos.filter(ev => (ev.status_evento || "").toLowerCase() === status);
    }
    if (destacados) {
      eventos = eventos.filter(ev => !!ev.destacar_na_homepage);
    }

    // ordena por data (nulos por último)
    eventos.sort((a, b) => {
      const da = a.data_evento ? new Date(a.data_evento).getTime() : Infinity;
      const db = b.data_evento ? new Date(b.data_evento).getTime() : Infinity;
      return da - db;
    });

    return res.status(200).json({ sucesso: true, eventos });
  } catch (e) {
    console.error("Erro /api/eventos_list:", e);
    return res.status(500).json({
      sucesso: false,
      mensagem: "Erro ao listar eventos.",
      detalhe: e?.message || String(e),
    });
  }
}


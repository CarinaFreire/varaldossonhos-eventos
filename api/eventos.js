// /api/eventos.js
import Airtable from "airtable";

export const config = { runtime: "nodejs" };

const ok = (res, data) => res.status(200).json(data);
const err = (res, code, msg, detalhe) =>
  res.status(code).json({ sucesso: false, mensagem: msg, detalhe });

function getAirtable() {
  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;
  const table = process.env.AIRTABLE_EVENTOS_TABLE || "eventos";
  if (!apiKey || !baseId) throw new Error("Credenciais Airtable ausentes.");
  const base = new Airtable({ apiKey }).base(baseId);
  return { base, table };
}

// helpers para normalizar contadores vindos como número, texto, lookup, etc.
function toIntSafe(v) {
  if (v == null) return 0;
  if (Array.isArray(v)) return v.length;
  const n = parseInt(`${v}`.trim(), 10);
  return Number.isFinite(n) ? n : 0;
}
function pick(...vals) {
  for (const v of vals) if (v !== undefined) return v;
  return undefined;
}

function mapEvento(rec) {
  const f = rec.fields || {};

  // imagem (pega array de anexos do campo "imagem")
  const imagem = Array.isArray(f.imagem)
    ? f.imagem.map(x => ({
        url: x.url,
        filename: x.filename,
        width: x.width,
        height: x.height,
      }))
    : [];

  // status: aceita suas 3 opções
  const statusRaw = (f.status_evento || "").toString().toLowerCase(); // "em andamento" | "proximo" | "encerrado"

  // normalização de contadores
  const cartinhas_total = toIntSafe(
    pick(f.cartinhas_total, f.cartinha, f.cartinhas, f.qtd_cartinhas, f.qtd_cartinha)
  );
  const adocoes_total = toIntSafe(
    pick(f.adocoes_total, f.adocoes, f.adoções, f.qtd_adocoes, f.qtd_adoções)
  );

  return {
    id: rec.id,
    id_evento: f.id_evento ?? null,
    nome_evento: f.nome_evento ?? "",
    local_evento: f.local_evento ?? "",
    descricao: f.descricao ?? "",
    data_evento: f.data_evento ?? null,
    data_limite_recebimento: f.data_limite_recebimento ?? null,
    status_evento: statusRaw,
    imagem,
    destacar_na_homepage: !!f.destacar_na_homepage,

    // >>> NOVOS CAMPOS normalizados
    cartinhas_total,
    adocoes_total,
  };
}

export default async function handler(req, res) {
  try {
    const { base, table } = getAirtable();

    // filtro por status opcional: ?status=em%20andamento|proximo|encerrado
    const statusFiltro = (req.query.status || "").toString().toLowerCase().trim();
    const allowed = ["em andamento", "proximo", "encerrado"];
    const useFilter = allowed.includes(statusFiltro);

    const params = useFilter
      ? {
          filterByFormula: `{status_evento} = '${statusFiltro}'`,
          pageSize: 50,
        }
      : { pageSize: 50 };

    const registros = await base(table).select(params).all();
    const eventos = registros.map(mapEvento);

    ok(res, { sucesso: true, total: eventos.length, eventos });
  } catch (e) {
    console.error("Erro /api/eventos:", e);
    err(res, 500, "Erro ao listar eventos.", e?.message || e?.toString());
  }
}

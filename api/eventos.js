// /api/eventos.js — versão robusta (NÃO envia filterByFormula quando vazio)
import Airtable from "airtable";
export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();

  try {
    const base  = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY })
      .base(process.env.AIRTABLE_BASE_ID);
    const table = process.env.AIRTABLE_EVENTOS_TABLE || "eventos";

    // --- Query params ---
    const statusRaw       = (req.query.status || "").trim().toLowerCase(); // em andamento | proximo | encerrado
    const destacadosOnly  = String(req.query.destacados || "").toLowerCase() === "true";
    const order           = (req.query.order || "asc").toLowerCase();      // asc | desc
    const destacadosFirst = String(req.query.destacados_first || "").toLowerCase() === "true";
    const limit           = Number.parseInt(req.query.limit, 10);
    const limitSafe       = Number.isFinite(limit) && limit > 0 ? limit : null;

    if (statusRaw && !["em andamento", "proximo", "encerrado"].includes(statusRaw)) {
      return res.status(400).json({ sucesso: false, mensagem: "Status inválido." });
    }
    if (!["asc", "desc"].includes(order)) {
      return res.status(400).json({ sucesso: false, mensagem: "Parâmetro 'order' inválido (use asc|desc)." });
    }

    // Monta formula (string) só se necessário
    const filtros = [];
    if (statusRaw)      filtros.push(`{status_evento}='${statusRaw}'`);
    if (destacadosOnly) filtros.push(`{destacar_na_homepage}=1`);

    const selectOpts = {};
    if (filtros.length) {
      // Airtable exige string aqui — nada de undefined
      selectOpts.filterByFormula = `AND(${filtros.join(",")})`;
    }

    // Busca crua para evitar UNKNOWN_FIELD_NAME se renomearem colunas
    const records = await base(table).select(selectOpts).all();

    // Mapeia p/ o front
    let eventos = records.map(r => {
      const f = r.fields || {};
      return {
        airtable_id: r.id,
        id_evento: f.id_evento ?? null,
        nome_evento: f.nome_evento ?? "",
        descricao: f.descricao ?? "",
        status_evento: (f.status_evento || "").toLowerCase(), // em andamento | proximo | encerrado
        local_evento: f.local_evento ?? "",
        endereco: f.endereco ?? "",
        data_evento: f.data_evento ?? null,
        data_fim:    f.data_fim ?? null,
        imagem: Array.isArray(f.imagem) ? f.imagem : [],
        destacar_na_homepage: !!f.destacar_na_homepage,
      };
    });

    // Remove itens vazios
    eventos = eventos.filter(ev =>
      (ev.nome_evento && ev.nome_evento.trim()) || ev.data_evento
    );

    // Ordenações
    if (destacadosFirst) {
      eventos.sort((a, b) => (b.destacar_na_homepage ? 1 : 0) - (a.destacar_na_homepage ? 1 : 0));
    }
    eventos.sort((a, b) => {
      const va = a.data_evento ? new Date(a.data_evento).getTime() : Infinity;
      const vb = b.data_evento ? new Date(b.data_evento).getTime() : Infinity;
      const cmp = va - vb;
      return order === "asc" ? cmp : -cmp;
    });

    if (limitSafe) eventos = eventos.slice(0, limitSafe);

    res.status(200).json({ sucesso: true, eventos });
  } catch (e) {
    console.error("Erro /api/eventos:", e);
    res.status(500).json({ sucesso: false, mensagem: "Erro ao listar eventos.", detalhe: e.message });
  }
}

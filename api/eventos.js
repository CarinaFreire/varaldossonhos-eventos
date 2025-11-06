// /api/eventos.js
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

    // filtro opcional por status
    const status = (req.query.status || "").trim().toLowerCase();
    const filtros = [];
    if (status) {
      // permitidos: em andamento | proximo | encerrado
      if (!["em andamento", "proximo", "encerrado"].includes(status)) {
        return res.status(400).json({ sucesso: false, mensagem: "Status inválido" });
      }
      filtros.push(`{status_evento}='${status}'`);
    }
    const filterByFormula = filtros.length ? `AND(${filtros.join(",")})` : undefined;

    const records = await base(table).select({
      filterByFormula,
      // sem 'fields' e sem 'sort' para evitar UNKNOWN_FIELD_NAME se renomearem colunas
    }).all();

    const eventos = records.map(r => {
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
        data_fim: f.data_fim ?? null,
        imagem: Array.isArray(f.imagem) ? f.imagem : [],
        destacar_na_homepage: !!f.destacar_na_homepage,
      };
    });

    // Ordena por data_evento (nulos no fim)
    eventos.sort((a, b) => {
      const da = a.data_evento ? new Date(a.data_evento).getTime() : Infinity;
      const db = b.data_evento ? new Date(b.data_evento).getTime() : Infinity;
      return da - db;
    });

    res.status(200).json({ sucesso: true, eventos });
  } catch (e) {
    console.error("Erro /api/eventos:", e);
    res.status(500).json({ sucesso: false, mensagem: "Erro ao listar eventos.", detalhe: e.message });
  }
}


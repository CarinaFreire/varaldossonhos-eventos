import Airtable from "airtable";
export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();

  try {
    const { AIRTABLE_API_KEY, AIRTABLE_BASE_ID } = process.env;
    const TABLE = process.env.AIRTABLE_EVENTOS_TABLE || "eventos";

    const base = new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID);

    const records = await base(TABLE)
      .select({
        sort: [{ field: "data_inicio", direction: "asc" }],
        fields: [
          "id_evento",
          "nome_evento",
          "escola_local",
          "endereco",
          "data_inicio",
          "data_fim",
          "descricao",
          "status",
          "imagem_evento",
          "destaque_home"
        ],
      })
      .all();

    const eventos = records.map(r => {
      const f = r.fields;
      return {
        airtable_id: r.id,
        id_evento: f.id_evento ?? null,
        nome_evento: f.nome_evento ?? "",
        descricao: f.descricao ?? "",
        status_evento: f.status ?? "",
        local_evento: f.escola_local ?? "",
        endereco: f.endereco ?? "",
        data_evento: f.data_inicio ?? null,
        data_fim: f.data_fim ?? null,
        imagem: Array.isArray(f.imagem_evento) ? f.imagem_evento : [],
        destacar_na_homepage: !!f.destaque_home,
      };
    });

    res.status(200).json({ sucesso: true, eventos });
  } catch (e) {
    console.error("Erro /api/eventos:", e);
    res.status(500).json({
      sucesso: false,
      mensagem: "Erro ao listar eventos.",
      detalhe: e?.message || String(e),
    });
  }
}


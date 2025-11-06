// /api/eventos_list.js
import Airtable from "airtable";
export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
  // CORS básico
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
        mensagem:
          "Variáveis ausentes. Defina AIRTABLE_API_KEY e AIRTABLE_BASE_ID (e opcional AIRTABLE_EVENTOS_TABLE).",
      });
    }

    // --- filtros opcionais via query ---
    const { status, destacados } = req.query; // ex: ?status=em%20breve&destacados=true
    const filtros = [];
    if (status) {
      // compara exatamente o valor do campo {status}
      filtros.push(`{status}='${String(status)}'`);
    }
    if (destacados === "true") {
      filtros.push("{destaque_home}=1");
    }

    // Monta as opções do select sem incluir filterByFormula quando vazio
    const selectOpts = {
      // ⚠️ NÃO passe filterByFormula quando não houver filtros
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
        "destaque_home",
      ],
    };
    if (filtros.length) {
      selectOpts.filterByFormula = filtros.length === 1
        ? filtros[0]
        : `AND(${filtros.join(",")})`;
    }

    const base = new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID);
    const records = await base(TABLE).select(selectOpts).all();

    const eventos = records.map((r) => {
      const f = r.fields || {};
      return {
        airtable_id: r.id,
        id_evento: f.id_evento ?? null,
        nome_evento: f.nome_evento ?? "",
        descricao: f.descricao ?? "",
        status_evento: f.status ?? "",
        local_evento: f.escola_local ?? "",
        endereco: f.endereco ?? "",
        // devolve ISO quando possível; se Airtable já manda ISO/Date, ok
        data_evento: f.data_inicio ?? null,
        data_fim: f.data_fim ?? null,
        imagem: Array.isArray(f.imagem_evento) ? f.imagem_evento : [],
        destacar_na_homepage: !!f.destaque_home,
      };
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

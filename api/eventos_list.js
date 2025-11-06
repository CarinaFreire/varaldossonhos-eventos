// ============================================================
// 🩵 VARAL DOS SONHOS — /api/eventos_list
// Lista completa de eventos (com filtros via query)
// Tabela Airtable: "eventos"
// Campos usados: id_evento, nome_evento, escola_local, endereco,
//                data_inicio, data_fim, descricao, status,
//                imagem_evento (anexo), destaque_home (checkbox)
// ============================================================
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

    if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
      return res.status(500).json({
        sucesso: false,
        mensagem:
          "Faltam variáveis AIRTABLE_API_KEY e/ou AIRTABLE_BASE_ID nas Environment Variables do Vercel.",
      });
    }

    // Filtros opcionais via query
    // /api/eventos_list?status=em%20breve&destacados=true
    const { status, destacados } = req.query;
    const filtros = [];
    if (status) filtros.push(`{status}='${String(status)}'`);
    if (destacados === "true") filtros.push("{destaque_home}=1");
    const filterByFormula = filtros.length ? `AND(${filtros.join(",")})` : undefined;

    const base = new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID);

    const records = await base(TABLE)
      .select({
        filterByFormula,
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
      })
      .all();

    const eventos = records
      .map((r) => {
        const f = r.fields || {};
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
      })
      // defesa extra: ignora placeholders vazios
      .filter(ev => (ev.nome_evento && ev.nome_evento.trim()) || ev.data_evento);

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

// ============================================================
// 💙 VARAL DOS SONHOS — /api/eventos.js (datas sem fuso)
// Usa: data_evento (início) e data_limite_recebimento (data limite)
// ============================================================
import Airtable from "airtable";
export const config = { runtime: "nodejs" };

// Garante 'YYYY-MM-DD' ou null
function normalizeDateStr(v) {
  if (!v) return null;
  if (typeof v === "string") {
    const s = v.includes("T") ? v.split("T")[0] : v;
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
  }
  if (v instanceof Date && !isNaN(v)) {
    const y = v.getUTCFullYear();
    const m = String(v.getUTCMonth() + 1).padStart(2, "0");
    const d = String(v.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return null;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();

  try {
    const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY })
      .base(process.env.AIRTABLE_BASE_ID);
    const table = process.env.AIRTABLE_EVENTOS_TABLE || "eventos";

    // Filtros opcionais
    const { status, destacados } = req.query;
    const filtros = [];
    if (typeof status === "string" && status.trim()) {
      // status_evento: 'em andamento' | 'encerrado' | 'proximo'
      filtros.push(`{status_evento}='${status.trim()}'`);
    }
    if (destacados === "true") {
      filtros.push("{destacar_na_homepage}=1");
    }

    const selectParams = {
      sort: [{ field: "data_evento", direction: "asc" }],
    };
    if (filtros.length) {
      selectParams.filterByFormula = `AND(${filtros.join(",")})`;
    }

    const records = await base(table).select(selectParams).all();

    const eventos = records.map((r) => {
      const f = r.fields || {};
      return {
        airtable_id: r.id,
        id_evento: f.id_evento ?? null,
        nome_evento: f.nome_evento ?? "",
        descricao: f.descricao ?? "",
        status_evento: f.status_evento ?? "",             // 'em andamento' | 'encerrado' | 'proximo'
        local_evento: f.local_evento ?? f.escola_local ?? "",
        endereco: f.endereco ?? "",
        data_evento: normalizeDateStr(f.data_evento),     // início (YYYY-MM-DD)
        data_limite_recebimento: normalizeDateStr(f.data_limite_recebimento), // data limite (YYYY-MM-DD)
        imagem: Array.isArray(f.imagem) ? f.imagem : [],
        destacar_na_homepage: !!f.destacar_na_homepage,
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



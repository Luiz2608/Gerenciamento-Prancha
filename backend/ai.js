import fs from "fs";
import pdfParse from "pdf-parse";

const normalizeText = (str) => {
  try { return String(str).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); } catch { return String(str).toLowerCase(); }
};

const parsePlate = (text) => {
  const s = String(text).toUpperCase();
  const m1 = s.match(/\b([A-Z]{3}[0-9]{4})\b/);
  if (m1) return m1[1];
  const m2 = s.match(/\b([A-Z]{3}[0-9][A-Z][0-9]{2})\b/);
  if (m2) return m2[1];
  return null;
};

const parseChassis = (text) => {
  const s = String(text).toUpperCase();
  const m = s.match(/\b([A-HJ-NPR-Z0-9]{17})\b/);
  return m ? m[1] : null;
};

const parseYear = (text) => {
  const s = normalizeText(text);
  const m = s.match(/\b(20\d{2})\b/);
  return m ? Number(m[1]) : null;
};

const parseIssueDate = (text) => {
  const s = normalizeText(text);
  const m = s.match(/emitido\s*em\s*[:\.]?\s*((?:0?[1-9]|[12]\d|3[01])\s*[\/-]\s*(0[1-9]|1[0-2])\s*[\/-]\s*(20\d{2}))/);
  if (m && m[1]) {
    const d = String(m[1]).match(/(0?[1-9]|[12]\d|3[01])\s*[\/-]\s*(0[1-9]|1[0-2])\s*[\/-]\s*(20\d{2})/);
    if (d) { const dd = String(d[1]).padStart(2, '0'); return `${d[3]}-${d[2]}-${dd}`; }
  }
  return null;
};

const parseValidityDate = (text) => {
  const s = normalizeText(text);
  const tries = [
    /com\s*validade\s*ate\s*((?:0?[1-9]|[12]\d|3[01])\s*[\/-]\s*(?:0[1-9]|1[0-2])\s*[\/-]\s*20\d{2})/,
    /validade\s*ate\s*((?:0?[1-9]|[12]\d|3[01])\s*[\/-]\s*(?:0[1-9]|1[0-2])\s*[\/-]\s*20\d{2})/,
    /vencimento\s*(?:em|ate)?\s*((?:0?[1-9]|[12]\d|3[01])\s*[\/-]\s*(?:0[1-9]|1[0-2])\s*[\/-]\s*20\d{2})/,
    /valido\s*ate\s*((?:0?[1-9]|[12]\d|3[01])\s*[\/-]\s*(?:0[1-9]|1[0-2])\s*[\/-]\s*20\d{2})/,
    /ate\s*((?:0?[1-9]|[12]\d|3[01])\s*[\/-]\s*(?:0[1-9]|1[0-2])\s*[\/-]\s*20\d{2})/
  ];
  for (const rg of tries) {
    const m = s.match(rg);
    const d = String(m?.[1] || "").match(/(0?[1-9]|[12]\d|3[01])\s*[\/-]\s*(0[1-9]|1[0-2])\s*[\/-]\s*(20\d{2})/);
    if (d) { const dd = String(d[1]).padStart(2,'0'); return `${d[3]}-${d[2]}-${dd}`; }
  }
  return null;
};

const classifyDocTypeHeuristic = (text) => {
  const s = normalizeText(text);
  if (/tacografo|tac\u00f3grafo|certificado/.test(s)) return "tacografo_certificado";
  if (/licenciamento|crlv|ipva|documento/.test(s)) return "documento";
  if (/seguro|apolice/.test(s)) return "seguro";
  if (/inspecao|vistoria/.test(s)) return "inspecao";
  return "documento";
};

async function deepseekExtract(text) {
  const key = process.env.DEEPSEEK_API_KEY;
  const url = process.env.DEEPSEEK_API_URL || "https://api.deepseek.com/v1/chat/completions";
  if (!key) return null;
  try {
    const prompt = `Extraia do texto do documento os campos: placa (formato AAA1234 ou AAA1A23), chassi (17 chars), ano, tipo de documento (licenciamento/seguro/inspecao/tacografo), data de emissão (dd/mm/aaaa) e data de validade (dd/mm/aaaa). Responda em JSON com {plate, chassis, year, doc_type, issue_date, expiry_date}. Texto:\n${text}`;
    const body = {
      model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
      messages: [{ role: "system", content: "Você é um extrator de dados estruturados de documentos." }, { role: "user", content: prompt }],
      temperature: 0
    };
    const r = await fetch(url, {
      method: "POST",
      headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const j = await r.json();
    const content = j?.choices?.[0]?.message?.content || "";
    try {
      const parsed = JSON.parse(content);
      return parsed;
    } catch {
      return null;
    }
  } catch {
    return null;
  }
}

export async function extractDocument({ filePath, mime, type }) {
  const buf = fs.readFileSync(filePath);
  const data = await pdfParse(buf).catch(() => ({ text: "" }));
  const text = data?.text || "";
  const plate = parsePlate(text);
  const chassis = parseChassis(text);
  const year = parseYear(text);
  const issue_date = parseIssueDate(text);
  const expiry_date = parseValidityDate(text);
  const doc_type = classifyDocTypeHeuristic(text);

  let ai = await deepseekExtract(text);
  const result = {
    plate: ai?.plate || plate || null,
    chassis: ai?.chassis || chassis || null,
    year: ai?.year != null ? Number(ai.year) : (year || null),
    doc_type: ai?.doc_type || doc_type,
    issue_date: ai?.issue_date || issue_date || null,
    expiry_date: ai?.expiry_date || expiry_date || null,
    confidence: ai ? 0.8 : 0.5,
    notes: ai ? "Campos complementados pela IA (DeepSeek)" : "Campos inferidos por heurística"
  };
  return result;
}


import { db } from "../database/db.js";
import PDFDocument from "pdfkit";

const computeKm = (km_start, km_end) => {
  if (km_start == null || km_end == null) return 0;
  return Math.max(0, Number(km_end) - Number(km_start));
};

const computeHours = (date, start_time, end_time) => {
  if (!date || !start_time || !end_time) return 0;
  const start = new Date(`${date}T${start_time}:00`);
  const end = new Date(`${date}T${end_time}:00`);
  const diff = Math.max(0, end.getTime() - start.getTime());
  return Math.round((diff / 3600000) * 100) / 100;
};

const filterSql = (q) => {
  const { startDate, endDate, driverId, destination, status, search } = q;
  const where = [];
  const params = [];
  if (startDate) {
    where.push("date >= ?");
    params.push(startDate);
  }
  if (endDate) {
    where.push("date <= ?");
    params.push(endDate);
  }
  if (driverId) {
    where.push("driver_id = ?");
    params.push(Number(driverId));
  }
  if (destination) {
    where.push("destination LIKE ?");
    params.push(`%${destination}%`);
  }
  if (status) {
    where.push("status = ?");
    params.push(status);
  }
  if (search) {
    where.push("(description LIKE ? OR service_type LIKE ?)");
    params.push(`%${search}%`, `%${search}%`);
  }
  return { whereSql: where.length ? `WHERE ${where.join(" AND ")}` : "", params };
};

export const exportCsv = (req, res) => {
  const { whereSql, params } = filterSql(req.query);
  const rows = db.prepare(`SELECT * FROM trips ${whereSql} ORDER BY id DESC`).all(...params);
  const header = [
    "id",
    "data",
    "motorista_id",
    "destino",
    "tipo_servico",
    "descricao",
    "hora_saida",
    "hora_retorno",
    "km_inicial",
    "km_final",
    "status",
    "km_rodado",
    "horas_trabalhadas"
  ];
  const lines = rows.map((t) => [
    t.id,
    t.date,
    t.driver_id,
    t.destination || "",
    t.service_type || "",
    t.description || "",
    t.start_time || "",
    t.end_time || "",
    t.km_start ?? "",
    t.km_end ?? "",
    t.status,
    computeKm(t.km_start, t.km_end),
    computeHours(t.date, t.start_time, t.end_time)
  ]);
  const csv = [header.join(","), ...lines.map((l) => l.join(","))].join("\n");
  res.header("Content-Type", "text/csv");
  res.attachment("viagens.csv");
  res.send(csv);
};

export const exportPdf = (req, res) => {
  const { whereSql, params } = filterSql(req.query);
  const rows = db.prepare(`SELECT * FROM trips ${whereSql} ORDER BY date ASC`).all(...params);
  const doc = new PDFDocument({ margin: 40 });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", "attachment; filename=relatorio.pdf");
  doc.pipe(res);
  doc.fontSize(16).text("Relatorio de Viagens", { align: "center" });
  doc.moveDown();
  rows.forEach((t) => {
    const km = computeKm(t.km_start, t.km_end);
    const h = computeHours(t.date, t.start_time, t.end_time);
    doc.fontSize(10).text(`Data: ${t.date} | Motorista: ${t.driver_id} | Destino: ${t.destination || ""} | Tipo: ${t.service_type || ""} | Status: ${t.status} | KM: ${km} | Horas: ${h}`);
  });
  doc.end();
};


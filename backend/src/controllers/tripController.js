import { db } from "../database/db.js";

const computeStatus = (end_time, km_end) => {
  if (!end_time || end_time === "" || km_end === null || km_end === undefined || km_end === "") return "Em andamento";
  return "Finalizada";
};

const computeHours = (date, start_time, end_time) => {
  if (!date || !start_time || !end_time) return 0;
  const start = new Date(`${date}T${start_time}:00`);
  const end = new Date(`${date}T${end_time}:00`);
  const diff = Math.max(0, end.getTime() - start.getTime());
  return Math.round((diff / 3600000) * 100) / 100;
};

const computeKm = (km_start, km_end) => {
  if (km_start == null || km_end == null) return 0;
  return Math.max(0, Number(km_end) - Number(km_start));
};

export const listTrips = (req, res) => {
  const { startDate, endDate, driverId, destination, status, search, page = 1, pageSize = 10 } = req.query;
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
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const total = db.prepare(`SELECT COUNT(*) as c FROM trips ${whereSql}`).get(...params).c;
  const offset = (Number(page) - 1) * Number(pageSize);
  const rows = db
    .prepare(`SELECT * FROM trips ${whereSql} ORDER BY id DESC LIMIT ? OFFSET ?`)
    .all(...params, Number(pageSize), offset)
    .map((t) => ({
      ...t,
      km_rodado: computeKm(t.km_start, t.km_end),
      horas: computeHours(t.date, t.start_time, t.end_time)
    }));
  res.json({ data: rows, total, page: Number(page), pageSize: Number(pageSize) });
};

export const getTrip = (req, res) => {
  const id = Number(req.params.id);
  const t = db.prepare("SELECT * FROM trips WHERE id = ?").get(id);
  if (!t) return res.status(404).json({ error: "Not found" });
  res.json({
    ...t,
    km_rodado: computeKm(t.km_start, t.km_end),
    horas: computeHours(t.date, t.start_time, t.end_time)
  });
};

export const createTrip = (req, res) => {
  const { date, driver_id, destination, service_type, description, start_time, end_time, km_start, km_end } = req.body;
  const status = computeStatus(end_time, km_end);
  const info = db
    .prepare(
      "INSERT INTO trips (date, driver_id, destination, service_type, description, start_time, end_time, km_start, km_end, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .run(date, Number(driver_id), destination || null, service_type || null, description || null, start_time || null, end_time || null, km_start != null ? Number(km_start) : null, km_end != null ? Number(km_end) : null, status);
  const t = db.prepare("SELECT * FROM trips WHERE id = ?").get(info.lastInsertRowid);
  res.status(201).json({
    ...t,
    km_rodado: computeKm(t.km_start, t.km_end),
    horas: computeHours(t.date, t.start_time, t.end_time)
  });
};

export const updateTrip = (req, res) => {
  const id = Number(req.params.id);
  const { date, driver_id, destination, service_type, description, start_time, end_time, km_start, km_end } = req.body;
  const status = computeStatus(end_time, km_end);
  db
    .prepare(
      "UPDATE trips SET date = ?, driver_id = ?, destination = ?, service_type = ?, description = ?, start_time = ?, end_time = ?, km_start = ?, km_end = ?, status = ? WHERE id = ?"
    )
    .run(date, Number(driver_id), destination || null, service_type || null, description || null, start_time || null, end_time || null, km_start != null ? Number(km_start) : null, km_end != null ? Number(km_end) : null, status, id);
  const t = db.prepare("SELECT * FROM trips WHERE id = ?").get(id);
  if (!t) return res.status(404).json({ error: "Not found" });
  res.json({
    ...t,
    km_rodado: computeKm(t.km_start, t.km_end),
    horas: computeHours(t.date, t.start_time, t.end_time)
  });
};

export const deleteTrip = (req, res) => {
  const id = Number(req.params.id);
  db.prepare("DELETE FROM trips WHERE id = ?").run(id);
  res.json({ ok: true });
};


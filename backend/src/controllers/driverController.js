import { db } from "../database/db.js";

export const listDrivers = (req, res) => {
  const rows = db.prepare("SELECT * FROM drivers ORDER BY id DESC").all();
  res.json(rows);
};

export const getDriver = (req, res) => {
  const id = Number(req.params.id);
  const row = db.prepare("SELECT * FROM drivers WHERE id = ?").get(id);
  if (!row) return res.status(404).json({ error: "Not found" });
  res.json(row);
};

export const createDriver = (req, res) => {
  const { name, cpf, cnh_category, status } = req.body;
  const info = db
    .prepare("INSERT INTO drivers (name, cpf, cnh_category, status) VALUES (?, ?, ?, ?)")
    .run(name, cpf || null, cnh_category || null, status || "Ativo");
  const row = db.prepare("SELECT * FROM drivers WHERE id = ?").get(info.lastInsertRowid);
  res.status(201).json(row);
};

export const updateDriver = (req, res) => {
  const id = Number(req.params.id);
  const { name, cpf, cnh_category, status } = req.body;
  db.prepare("UPDATE drivers SET name = ?, cpf = ?, cnh_category = ?, status = ? WHERE id = ?").run(
    name,
    cpf || null,
    cnh_category || null,
    status || "Ativo",
    id
  );
  const row = db.prepare("SELECT * FROM drivers WHERE id = ?").get(id);
  if (!row) return res.status(404).json({ error: "Not found" });
  res.json(row);
};

export const deleteDriver = (req, res) => {
  const id = Number(req.params.id);
  db.prepare("DELETE FROM drivers WHERE id = ?").run(id);
  res.json({ ok: true });
};


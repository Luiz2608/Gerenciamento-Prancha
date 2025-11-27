import { db } from "../database/db.js";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, "..", "..", "database.sqlite");

export const listDestinations = (req, res) => {
  const rows = db.prepare("SELECT * FROM destinations ORDER BY name").all();
  res.json(rows);
};

export const createDestination = (req, res) => {
  const { name } = req.body;
  const info = db.prepare("INSERT INTO destinations (name) VALUES (?)").run(name);
  res.status(201).json(db.prepare("SELECT * FROM destinations WHERE id = ?").get(info.lastInsertRowid));
};

export const deleteDestination = (req, res) => {
  const id = Number(req.params.id);
  db.prepare("DELETE FROM destinations WHERE id = ?").run(id);
  res.json({ ok: true });
};

export const listServiceTypes = (req, res) => {
  const rows = db.prepare("SELECT * FROM service_types ORDER BY name").all();
  res.json(rows);
};

export const createServiceType = (req, res) => {
  const { name } = req.body;
  const info = db.prepare("INSERT INTO service_types (name) VALUES (?)").run(name);
  res.status(201).json(db.prepare("SELECT * FROM service_types WHERE id = ?").get(info.lastInsertRowid));
};

export const deleteServiceType = (req, res) => {
  const id = Number(req.params.id);
  db.prepare("DELETE FROM service_types WHERE id = ?").run(id);
  res.json({ ok: true });
};

export const getTruck = (req, res) => {
  const row = db.prepare("SELECT * FROM truck WHERE id = 1").get();
  res.json(row || {});
};

export const updateTruck = (req, res) => {
  const { plate, model, year } = req.body;
  db.prepare("UPDATE truck SET plate = ?, model = ?, year = ? WHERE id = 1").run(plate || null, model || null, year != null ? Number(year) : null);
  const row = db.prepare("SELECT * FROM truck WHERE id = 1").get();
  res.json(row || {});
};

export const backup = (req, res) => {
  res.download(dbPath, "database.sqlite");
};


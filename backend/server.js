import express from "express";
import cors from "cors";
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";

const app = express();
app.use(cors());
app.use(express.json());

const dbFile = process.env.DB_PATH || "prancha.db";
const db = new Database(dbFile);

app.get("/", (req, res) => {
  res.json({ ok: true, name: "Viagens da Prancha API", health: "/api/health" });
});

db.exec(`
CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'user'
);
CREATE TABLE IF NOT EXISTS motoristas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  cpf TEXT,
  cnh_category TEXT,
  status TEXT DEFAULT 'Ativo'
);
CREATE TABLE IF NOT EXISTS caminhoes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  plate TEXT,
  model TEXT,
  year INTEGER,
  chassis TEXT,
  km_current INTEGER,
  fleet TEXT,
  status TEXT DEFAULT 'Ativo'
);
CREATE TABLE IF NOT EXISTS pranchas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  asset_number TEXT,
  type TEXT,
  capacity INTEGER,
  year INTEGER,
  status TEXT DEFAULT 'Ativo'
);
CREATE TABLE IF NOT EXISTS viagens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  driver_id INTEGER NOT NULL,
  truck_id INTEGER,
  prancha_id INTEGER,
  destination TEXT,
  service_type TEXT,
  description TEXT,
  start_time TEXT,
  end_time TEXT,
  km_start INTEGER,
  km_end INTEGER,
  fuel_liters REAL,
  fuel_price REAL,
  other_costs REAL,
  maintenance_cost REAL,
  driver_daily REAL,
  requester TEXT,
  status TEXT,
  FOREIGN KEY(driver_id) REFERENCES motoristas(id)
);
`);

const computeKm = (a, b) => (a == null || b == null ? 0 : Math.max(0, Number(b) - Number(a)));
const computeHours = (date, s, e) => {
  if (!date || !s || !e) return 0;
  const [sh, sm] = String(s).split(":").map((x) => Number(x) || 0);
  const [eh, em] = String(e).split(":").map((x) => Number(x) || 0);
  const startMin = sh * 60 + sm;
  const endMin = eh * 60 + em;
  const diffMin = endMin >= startMin ? (endMin - startMin) : (endMin + 24 * 60 - startMin);
  return Math.round((diffMin / 60) * 100) / 100;
};
const computeStatus = (end_time, km_end) => (!end_time || end_time === "" || km_end == null || km_end === "" ? "Em andamento" : "Finalizada");

app.post("/api/usuarios/register", (req, res) => {
  const { username, password, role = "user" } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: "Usuário e senha são obrigatórios" });
  try {
    const hash = bcrypt.hashSync(String(password), 10);
    const stmt = db.prepare("INSERT INTO usuarios (username, password_hash, role) VALUES (?, ?, ?)");
    const info = stmt.run(username, hash, role);
    res.json({ id: info.lastInsertRowid, username, role });
  } catch (e) {
    res.status(400).json({ error: "Usuário já existe" });
  }
});

app.post("/api/login", (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: "Credenciais inválidas" });
  const user = db.prepare("SELECT * FROM usuarios WHERE username = ?").get(username);
  if (!user) return res.status(401).json({ error: "Credenciais inválidas" });
  const ok = bcrypt.compareSync(String(password), user.password_hash);
  if (!ok) return res.status(401).json({ error: "Credenciais inválidas" });
  res.json({ token: "local-token", user: { id: user.id, username: user.username, role: user.role || "user" } });
});

app.get("/api/motoristas", (req, res) => {
  const rows = db.prepare("SELECT * FROM motoristas ORDER BY id DESC").all();
  res.json(rows);
});
app.post("/api/motoristas", (req, res) => {
  const { name, cpf = null, cnh_category = null, status = "Ativo" } = req.body || {};
  if (!name) return res.status(400).json({ error: "Nome é obrigatório" });
  const info = db.prepare("INSERT INTO motoristas (name, cpf, cnh_category, status) VALUES (?, ?, ?, ?)").run(name, cpf, cnh_category, status);
  const row = db.prepare("SELECT * FROM motoristas WHERE id = ?").get(info.lastInsertRowid);
  res.json(row);
});
app.put("/api/motoristas/:id", (req, res) => {
  const id = Number(req.params.id);
  const { name, cpf = null, cnh_category = null, status = "Ativo" } = req.body || {};
  db.prepare("UPDATE motoristas SET name=?, cpf=?, cnh_category=?, status=? WHERE id = ?").run(name, cpf, cnh_category, status, id);
  const row = db.prepare("SELECT * FROM motoristas WHERE id = ?").get(id);
  res.json(row);
});
app.delete("/api/motoristas/:id", (req, res) => {
  const id = Number(req.params.id);
  db.prepare("DELETE FROM motoristas WHERE id = ?").run(id);
  res.json({ ok: true });
});

app.get("/api/viagens", (req, res) => {
  const { startDate, endDate, driverId, destination, status, truckId, pranchaId, plate } = req.query;
  let rows = db.prepare("SELECT * FROM viagens").all();
  if (startDate) rows = rows.filter((t) => t.date >= startDate);
  if (endDate) rows = rows.filter((t) => t.date <= endDate);
  if (driverId) rows = rows.filter((t) => t.driver_id === Number(driverId));
  if (destination) rows = rows.filter((t) => String(t.destination || "").toLowerCase().includes(String(destination).toLowerCase()));
  if (status) rows = rows.filter((t) => t.status === status);
  if (truckId) rows = rows.filter((t) => t.truck_id === Number(truckId));
  if (pranchaId) rows = rows.filter((t) => t.prancha_id === Number(pranchaId));
  if (plate) {
    const trucks = db.prepare("SELECT id, plate FROM caminhoes").all();
    rows = rows.filter((t) => {
      const tr = trucks.find((x) => x.id === t.truck_id);
      return tr && String(tr.plate || "").toLowerCase().includes(String(plate).toLowerCase());
    });
  }
  rows = rows.map((t) => ({
    ...t,
    km_rodado: computeKm(t.km_start, t.km_end),
    horas: computeHours(t.date, t.start_time, t.end_time),
    total_cost: Number(t.fuel_liters || 0) * Number(t.fuel_price || 0) + Number(t.other_costs || 0) + Number(t.maintenance_cost || 0) + Number(t.driver_daily || 0)
  }));
  res.json(rows);
});
app.get("/api/viagens/:id", (req, res) => {
  const id = Number(req.params.id);
  const t = db.prepare("SELECT * FROM viagens WHERE id = ?").get(id);
  if (!t) return res.status(404).json({ error: "Not found" });
  res.json({ ...t, km_rodado: computeKm(t.km_start, t.km_end), horas: computeHours(t.date, t.start_time, t.end_time) });
});
app.post("/api/viagens", (req, res) => {
  const d = req.body || {};
  const status = computeStatus(d.end_time, d.km_end);
  const stmt = db.prepare(`INSERT INTO viagens (date, driver_id, truck_id, prancha_id, destination, service_type, description, start_time, end_time, km_start, km_end, fuel_liters, fuel_price, other_costs, maintenance_cost, driver_daily, requester, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const info = stmt.run(d.date, Number(d.driver_id), d.truck_id != null ? Number(d.truck_id) : null, d.prancha_id != null ? Number(d.prancha_id) : null, d.destination || null, d.service_type || null, d.description || null, d.start_time || null, d.end_time || null, d.km_start != null ? Number(d.km_start) : null, d.km_end != null ? Number(d.km_end) : null, d.fuel_liters != null ? Number(d.fuel_liters) : 0, d.fuel_price != null ? Number(d.fuel_price) : 0, d.other_costs != null ? Number(d.other_costs) : 0, d.maintenance_cost != null ? Number(d.maintenance_cost) : 0, d.driver_daily != null ? Number(d.driver_daily) : 0, d.requester || null, status);
  const t = db.prepare("SELECT * FROM viagens WHERE id = ?").get(info.lastInsertRowid);
  if (t.truck_id != null && t.km_end != null) db.prepare("UPDATE caminhoes SET km_current = ? WHERE id = ?").run(Number(t.km_end), Number(t.truck_id));
  res.json({ ...t, km_rodado: computeKm(t.km_start, t.km_end), horas: computeHours(t.date, t.start_time, t.end_time) });
});
app.put("/api/viagens/:id", (req, res) => {
  const id = Number(req.params.id);
  const d = req.body || {};
  const status = computeStatus(d.end_time, d.km_end);
  const stmt = db.prepare(`UPDATE viagens SET date=?, driver_id=?, truck_id=?, prancha_id=?, destination=?, service_type=?, description=?, start_time=?, end_time=?, km_start=?, km_end=?, fuel_liters=?, fuel_price=?, other_costs=?, maintenance_cost=?, driver_daily=?, requester=?, status=? WHERE id = ?`);
  stmt.run(d.date, Number(d.driver_id), d.truck_id != null ? Number(d.truck_id) : null, d.prancha_id != null ? Number(d.prancha_id) : null, d.destination || null, d.service_type || null, d.description || null, d.start_time || null, d.end_time || null, d.km_start != null ? Number(d.km_start) : null, d.km_end != null ? Number(d.km_end) : null, d.fuel_liters != null ? Number(d.fuel_liters) : 0, d.fuel_price != null ? Number(d.fuel_price) : 0, d.other_costs != null ? Number(d.other_costs) : 0, d.maintenance_cost != null ? Number(d.maintenance_cost) : 0, d.driver_daily != null ? Number(d.driver_daily) : 0, d.requester || null, status, id);
  const t = db.prepare("SELECT * FROM viagens WHERE id = ?").get(id);
  if (t.truck_id != null && t.km_end != null) db.prepare("UPDATE caminhoes SET km_current = ? WHERE id = ?").run(Number(t.km_end), Number(t.truck_id));
  res.json({ ...t, km_rodado: computeKm(t.km_start, t.km_end), horas: computeHours(t.date, t.start_time, t.end_time) });
});
app.delete("/api/viagens/:id", (req, res) => {
  const id = Number(req.params.id);
  db.prepare("DELETE FROM viagens WHERE id = ?").run(id);
  res.json({ ok: true });
});

app.get("/api/health", (req, res) => res.json({ ok: true }));

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`API running on http://localhost:${port}`);
});

import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";
import fs from "fs";
import multer from "multer";
import pdfParse from "pdf-parse";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { Pool } from "pg";
import bcrypt from "bcryptjs";

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

app.get("/", (req, res) => {
  res.json({ ok: true, name: "Viagens da Prancha API", health: "/api/health" });
});

await pool.query(`
CREATE TABLE IF NOT EXISTS usuarios (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'user'
);
CREATE TABLE IF NOT EXISTS motoristas (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  cpf TEXT,
  cnh_category TEXT,
  status TEXT DEFAULT 'Ativo'
);
/* Migration to ensure cnh_number exists */
try {
  await pool.query("ALTER TABLE motoristas ADD COLUMN IF NOT EXISTS cnh_number TEXT");
} catch (e) { console.error("Migration warning:", e.message); }

CREATE TABLE IF NOT EXISTS caminhoes (
  id SERIAL PRIMARY KEY,
  plate TEXT,
  model TEXT,
  year INTEGER,
  chassis TEXT,
  km_current INTEGER,
  fleet TEXT,
  status TEXT DEFAULT 'Ativo'
);
CREATE TABLE IF NOT EXISTS pranchas (
  id SERIAL PRIMARY KEY,
  asset_number TEXT,
  type TEXT,
  capacity INTEGER,
  year INTEGER,
  plate TEXT,
  chassis TEXT,
  status TEXT DEFAULT 'Ativo'
);
/* Migration to ensure pranchas columns exist */
try {
  await pool.query("ALTER TABLE pranchas ADD COLUMN IF NOT EXISTS plate TEXT");
  await pool.query("ALTER TABLE pranchas ADD COLUMN IF NOT EXISTS chassis TEXT");
} catch (e) { console.error("Migration warning (pranchas):", e.message); }

CREATE TABLE IF NOT EXISTS viagens (
  id SERIAL PRIMARY KEY,
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
  status TEXT
);
CREATE TABLE IF NOT EXISTS login_logs (
  id SERIAL PRIMARY KEY,
  user_id TEXT,
  email TEXT,
  at TIMESTAMP DEFAULT NOW(),
  device TEXT,
  ip TEXT,
  client_id TEXT
);
CREATE TABLE IF NOT EXISTS truck_documents (
  id SERIAL PRIMARY KEY,
  truck_id INTEGER NOT NULL,
  type TEXT NOT NULL,
  filename TEXT NOT NULL,
  mime TEXT,
  size INTEGER,
  uploaded_at TIMESTAMP DEFAULT NOW(),
  expiry_date TEXT
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

app.post("/api/usuarios/register", async (req, res) => {
  const { username, password, role = "user" } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: "Usuário e senha são obrigatórios" });
  try {
    const hash = bcrypt.hashSync(String(password), 10);
    const r = await pool.query("INSERT INTO usuarios (username, password_hash, role) VALUES ($1, $2, $3) RETURNING id, username, role", [username, hash, role]);
    res.json(r.rows[0]);
  } catch (e) {
    res.status(400).json({ error: "Usuário já existe" });
  }
});

app.post("/api/login", async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: "Credenciais inválidas" });
  const r = await pool.query("SELECT * FROM usuarios WHERE username = $1", [username]);
  const user = r.rows[0];
  if (!user) return res.status(401).json({ error: "Credenciais inválidas" });
  const ok = bcrypt.compareSync(String(password), user.password_hash);
  if (!ok) return res.status(401).json({ error: "Credenciais inválidas" });
  try {
    const ua = String(req.headers["user-agent"] || "").toLowerCase();
    const device = /mobi|android|iphone|ipad|ipod/.test(ua) ? "mobile" : "desktop";
    const ip = req.headers["x-forwarded-for"]?.toString().split(",")[0] || req.socket?.remoteAddress || null;
    const clientId = req.headers["x-client-id"] || null;
    await pool.query("INSERT INTO login_logs (user_id, email, device, ip, client_id) VALUES ($1,$2,$3,$4,$5)", [String(user.id), String(user.username), device, ip, clientId ? String(clientId) : null]);
  } catch {}
  res.json({ token: "local-token", user: { id: user.id, username: user.username, role: user.role || "user" } });
});

app.get("/api/motoristas", async (req, res) => {
  const r = await pool.query("SELECT * FROM motoristas ORDER BY id DESC");
  res.json(r.rows);
});
app.post("/api/motoristas", async (req, res) => {
  const { name, cpf = null, cnh_number = null, cnh_category = null, status = "Ativo" } = req.body || {};
  if (!name) return res.status(400).json({ error: "Nome é obrigatório" });
  const r = await pool.query("INSERT INTO motoristas (name, cpf, cnh_number, cnh_category, status) VALUES ($1, $2, $3, $4, $5) RETURNING *", [name, cpf, cnh_number, cnh_category, status]);
  res.json(r.rows[0]);
});
app.put("/api/motoristas/:id", async (req, res) => {
  const id = Number(req.params.id);
  const { name, cpf = null, cnh_number = null, cnh_category = null, status = "Ativo" } = req.body || {};
  const r = await pool.query("UPDATE motoristas SET name=$1, cpf=$2, cnh_number=$3, cnh_category=$4, status=$5 WHERE id=$6 RETURNING *", [name, cpf, cnh_number, cnh_category, status, id]);
  res.json(r.rows[0]);
});
app.delete("/api/motoristas/:id", async (req, res) => {
  const id = Number(req.params.id);
  await pool.query("DELETE FROM motoristas WHERE id=$1", [id]);
  res.json({ ok: true });
});

// Caminhões
app.get("/api/caminhoes", async (req, res) => {
  const r = await pool.query("SELECT * FROM caminhoes ORDER BY id DESC");
  res.json(r.rows);
});
app.post("/api/caminhoes", async (req, res) => {
  const { plate = null, model = null, year = null, chassis = null, km_current = null, fleet = null, status = "Ativo" } = req.body || {};
  const r = await pool.query("INSERT INTO caminhoes (plate, model, year, chassis, km_current, fleet, status) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *", [plate, model, year != null ? Number(year) : null, chassis, km_current != null ? Number(km_current) : null, fleet, status]);
  res.json(r.rows[0]);
});
app.put("/api/caminhoes/:id", async (req, res) => {
  const id = Number(req.params.id);
  const { plate = null, model = null, year = null, chassis = null, km_current = null, fleet = null, status = "Ativo" } = req.body || {};
  const r = await pool.query("UPDATE caminhoes SET plate=$1, model=$2, year=$3, chassis=$4, km_current=$5, fleet=$6, status=$7 WHERE id=$8 RETURNING *", [plate, model, year != null ? Number(year) : null, chassis, km_current != null ? Number(km_current) : null, fleet, status, id]);
  res.json(r.rows[0]);
});
app.delete("/api/caminhoes/:id", async (req, res) => {
  const id = Number(req.params.id);
  await pool.query("DELETE FROM caminhoes WHERE id=$1", [id]);
  res.json({ ok: true });
});

// Pranchas
app.get("/api/pranchas", async (req, res) => {
  const r = await pool.query("SELECT * FROM pranchas ORDER BY id DESC");
  res.json(r.rows);
});
app.post("/api/pranchas", async (req, res) => {
  const { asset_number = null, type = null, capacity = null, year = null, plate = null, chassis = null, status = "Ativo" } = req.body || {};
  const r = await pool.query("INSERT INTO pranchas (asset_number, type, capacity, year, plate, chassis, status) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *", [asset_number, type, capacity != null ? Number(capacity) : null, year != null ? Number(year) : null, plate, chassis, status]);
  res.json(r.rows[0]);
});
app.put("/api/pranchas/:id", async (req, res) => {
  const id = Number(req.params.id);
  const { asset_number = null, type = null, capacity = null, year = null, plate = null, chassis = null, status = "Ativo" } = req.body || {};
  const r = await pool.query("UPDATE pranchas SET asset_number=$1, type=$2, capacity=$3, year=$4, plate=$5, chassis=$6, status=$7 WHERE id=$8 RETURNING *", [asset_number, type, capacity != null ? Number(capacity) : null, year != null ? Number(year) : null, plate, chassis, status, id]);
  res.json(r.rows[0]);
});
app.delete("/api/pranchas/:id", async (req, res) => {
  const id = Number(req.params.id);
  await pool.query("DELETE FROM pranchas WHERE id=$1", [id]);
  res.json({ ok: true });
});

app.get("/api/viagens", async (req, res) => {
  const { startDate, endDate, driverId, destination, status, truckId, pranchaId, plate } = req.query;
  const r = await pool.query("SELECT * FROM viagens");
  let rows = r.rows;
  if (startDate) rows = rows.filter((t) => t.date >= startDate);
  if (endDate) rows = rows.filter((t) => t.date <= endDate);
  if (driverId) rows = rows.filter((t) => t.driver_id === Number(driverId));
  if (destination) rows = rows.filter((t) => String(t.destination || "").toLowerCase().includes(String(destination).toLowerCase()));
  if (status) rows = rows.filter((t) => t.status === status);
  if (truckId) rows = rows.filter((t) => t.truck_id === Number(truckId));
  if (pranchaId) rows = rows.filter((t) => t.prancha_id === Number(pranchaId));
  if (plate) {
    const trq = await pool.query("SELECT id, plate FROM caminhoes");
    const trucks = trq.rows;
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
app.get("/api/viagens/:id", async (req, res) => {
  const id = Number(req.params.id);
  const r = await pool.query("SELECT * FROM viagens WHERE id=$1", [id]);
  const t = r.rows[0];
  if (!t) return res.status(404).json({ error: "Not found" });
  res.json({ ...t, km_rodado: computeKm(t.km_start, t.km_end), horas: computeHours(t.date, t.start_time, t.end_time) });
});
app.post("/api/viagens", async (req, res) => {
  const d = req.body || {};
  const status = computeStatus(d.end_time, d.km_end);
  const r = await pool.query(
    "INSERT INTO viagens (date, driver_id, truck_id, prancha_id, destination, service_type, description, start_time, end_time, km_start, km_end, fuel_liters, fuel_price, other_costs, maintenance_cost, driver_daily, requester, status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING *",
    [d.date, Number(d.driver_id), d.truck_id != null ? Number(d.truck_id) : null, d.prancha_id != null ? Number(d.prancha_id) : null, d.destination || null, d.service_type || null, d.description || null, d.start_time || null, d.end_time || null, d.km_start != null ? Number(d.km_start) : null, d.km_end != null ? Number(d.km_end) : null, d.fuel_liters != null ? Number(d.fuel_liters) : 0, d.fuel_price != null ? Number(d.fuel_price) : 0, d.other_costs != null ? Number(d.other_costs) : 0, d.maintenance_cost != null ? Number(d.maintenance_cost) : 0, d.driver_daily != null ? Number(d.driver_daily) : 0, d.requester || null, status]
  );
  const t = r.rows[0];
  if (t.truck_id != null && t.km_end != null) await pool.query("UPDATE caminhoes SET km_current=$1 WHERE id=$2", [Number(t.km_end), Number(t.truck_id)]);
  res.json({ ...t, km_rodado: computeKm(t.km_start, t.km_end), horas: computeHours(t.date, t.start_time, t.end_time) });
});
app.put("/api/viagens/:id", async (req, res) => {
  const id = Number(req.params.id);
  const d = req.body || {};
  const status = computeStatus(d.end_time, d.km_end);
  const r = await pool.query(
    "UPDATE viagens SET date=$1, driver_id=$2, truck_id=$3, prancha_id=$4, destination=$5, service_type=$6, description=$7, start_time=$8, end_time=$9, km_start=$10, km_end=$11, fuel_liters=$12, fuel_price=$13, other_costs=$14, maintenance_cost=$15, driver_daily=$16, requester=$17, status=$18 WHERE id=$19 RETURNING *",
    [d.date, Number(d.driver_id), d.truck_id != null ? Number(d.truck_id) : null, d.prancha_id != null ? Number(d.prancha_id) : null, d.destination || null, d.service_type || null, d.description || null, d.start_time || null, d.end_time || null, d.km_start != null ? Number(d.km_start) : null, d.km_end != null ? Number(d.km_end) : null, d.fuel_liters != null ? Number(d.fuel_liters) : 0, d.fuel_price != null ? Number(d.fuel_price) : 0, d.other_costs != null ? Number(d.other_costs) : 0, d.maintenance_cost != null ? Number(d.maintenance_cost) : 0, d.driver_daily != null ? Number(d.driver_daily) : 0, d.requester || null, status, id]
  );
  const t = r.rows[0];
  if (t.truck_id != null && t.km_end != null) await pool.query("UPDATE caminhoes SET km_current=$1 WHERE id=$2", [Number(t.km_end), Number(t.truck_id)]);
  res.json({ ...t, km_rodado: computeKm(t.km_start, t.km_end), horas: computeHours(t.date, t.start_time, t.end_time) });
});
app.delete("/api/viagens/:id", async (req, res) => {
  const id = Number(req.params.id);
  await pool.query("DELETE FROM viagens WHERE id=$1", [id]);
  res.json({ ok: true });
});

app.get("/api/health", (req, res) => res.json({ ok: true }));

// Configure uploads directory
const uploadsRoot = path.join(__dirname, "uploads");
try { fs.mkdirSync(uploadsRoot, { recursive: true }); } catch {}
app.use("/uploads", express.static(uploadsRoot));

// Multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const truckId = String(req.body.truck_id || req.query.truck_id || "unknown");
    const dest = path.join(uploadsRoot, "trucks", truckId);
    try { fs.mkdirSync(dest, { recursive: true }); } catch {}
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    const ts = Date.now();
    const safe = String(file.originalname || "arquivo").replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `${ts}-${safe}`);
  }
});
const upload = multer({ storage });

// Helpers for expiry handling
function parseDateFromText(text) {
  if (!text) return null;
  const s = String(text);
  // Accept optional spaces and various separators (slash, hyphen, en/em dash, dot)
  const m1 = s.match(/(20\d{2})\s*[-_\/\.\u2013\u2014]\s*(0[1-9]|1[0-2])\s*[-_\/\.\u2013\u2014]\s*(0[1-9]|[12]\d|3[01])/);
  if (m1) return `${m1[1]}-${m1[2]}-${m1[3]}`;
  const m2 = s.match(/(0[1-9]|[12]\d|3[01])\s*[-_\/\.\u2013\u2014]\s*(0[1-9]|1[0-2])\s*[-_\/\.\u2013\u2014]\s*(20\d{2})/);
  if (m2) return `${m2[3]}-${m2[2]}-${m2[1]}`;
  // Try formats like "16 de janeiro de 2025"
  const months = { janeiro: '01', fevereiro: '02', marco: '03', março: '03', abril: '04', maio: '05', junho: '06', julho: '07', agosto: '08', setembro: '09', outubro: '10', novembro: '11', dezembro: '12' };
  const norm = normalizeText(s);
  const m3 = norm.match(/(0?[1-9]|[12]\d|3[01])\s*de\s*(janeiro|fevereiro|marco|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s*de\s*(20\d{2})/);
  if (m3) { const dd = String(m3[1]).padStart(2, '0'); const mm = months[m3[2]]; const yy = m3[3]; return `${yy}-${mm}-${dd}`; }
  return null;
}
function normalizeText(str) {
  try { return String(str).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); } catch { return String(str).toLowerCase(); }
}
function parseValidityDate(text) {
  if (!text) return null;
  const s = normalizeText(text);
  const dateFrom = (m) => {
    if (!m) return null;
    const d = String(m).match(/(0?[1-9]|[12]\d|3[01])\s*[\/-]\s*(0[1-9]|1[0-2])\s*[\/-]\s*(20\d{2})/);
    if (!d) return null;
    const dd = String(d[1]).padStart(2, '0');
    const mm = d[2];
    const yy = d[3];
    return `${yy}-${mm}-${dd}`;
  };
  const tries = [
    /com\s*validade\s*ate\s*((?:0?[1-9]|[12]\d|3[01])\s*[\/-]\s*(?:0[1-9]|1[0-2])\s*[\/-]\s*20\d{2})/,
    /validade\s*ate\s*((?:0?[1-9]|[12]\d|3[01])\s*[\/-]\s*(?:0[1-9]|1[0-2])\s*[\/-]\s*20\d{2})/,
    /vencimento\s*(?:em|ate)?\s*((?:0?[1-9]|[12]\d|3[01])\s*[\/-]\s*(?:0[1-9]|1[0-2])\s*[\/-]\s*20\d{2})/,
    /valido\s*ate\s*((?:0?[1-9]|[12]\d|3[01])\s*[\/-]\s*(?:0[1-9]|1[0-2])\s*[\/-]\s*20\d{2})/,
    /ate\s*((?:0?[1-9]|[12]\d|3[01])\s*[\/-]\s*(?:0[1-9]|1[0-2])\s*[\/-]\s*20\d{2})/
  ];
  for (const rg of tries) {
    const m = s.match(rg);
    const d = dateFrom(m?.[1] || "");
    if (d) return d;
  }
  return null;
}
function parseIssueDate(text) {
  if (!text) return null;
  const s = normalizeText(text);
  const m = s.match(/emitido\s*em\s*((?:0?[1-9]|[12]\d|3[01])\s*[\/-]\s*(?:0[1-9]|1[0-2])\s*[\/-]\s*20\d{2})/);
  if (m && m[1]) {
    const d = String(m[1]).match(/(0?[1-9]|[12]\d|3[01])\s*[\/-]\s*(0[1-9]|1[0-2])\s*[\/-]\s*(20\d{2})/);
    if (d) { const dd = String(d[1]).padStart(2, '0'); return `${d[3]}-${d[2]}-${dd}`; }
  }
  return null;
}
function parseExerciseYear(text) {
  if (!text) return null;
  const s = normalizeText(text);
  // Look for "exercicio" followed by a year
  const m = s.match(/exercicio[^0-9]*?(20\d{2})/);
  if (m) return Number(m[1]);
  // Fallback: first standalone 20xx year present
  const m2 = s.match(/\b(20\d{2})\b/);
  if (m2) return Number(m2[1]);
  return null;
}
function endOfExerciseValidity(year) {
  const y = Number(year);
  if (!y || y < 1900) return null;
  return `${y + 1}-10-31`;
}
function addDays(baseDateStr, days) {
  try {
    const [y, m, d] = String(baseDateStr).split("-").map(Number);
    const dt = new Date(y, (m - 1), d);
    dt.setDate(dt.getDate() + Number(days));
    const yy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, "0");
    const dd = String(dt.getDate()).padStart(2, "0");
    return `${yy}-${mm}-${dd}`;
  } catch {
    return null;
  }
}
function computeExpiry({ type, filename, uploadedAt }) {
  const uploadedDate = uploadedAt ? new Date(uploadedAt) : new Date();
  const upY = uploadedDate.getFullYear();
  const upM = String(uploadedDate.getMonth() + 1).padStart(2, "0");
  const upD = String(uploadedDate.getDate()).padStart(2, "0");
  const fallbackOneYear = `${upY + 1}-${upM}-${upD}`;
  const parsed = parseDateFromText(filename);
  if (parsed) return parsed;
  if (String(type) === "documento") {
    const yr = parseExerciseYear(filename);
    if (yr) {
      const end = endOfExerciseValidity(yr);
      if (end) return end;
    }
  }
  if (String(type) === "tacografo_certificado") return fallbackOneYear;
  return null;
}
function computeExpiryStatus(expiryDate) {
  if (!expiryDate) return { status: "unknown", days: null };
  try {
    const [y, m, d] = String(expiryDate).split("-").map(Number);
    const exp = new Date(y, (m - 1), d);
    const now = new Date();
    const diffMs = exp.getTime() - now.getTime();
    const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    if (days < 0) return { status: "expired", days };
    if (days <= 30) return { status: "expiring", days };
    return { status: "valid", days };
  } catch {
    return { status: "unknown", days: null };
  }
}

app.post("/api/documentos/upload", upload.single("file"), async (req, res) => {
  try {
    const truck_id = Number(req.body.truck_id);
    const type = String(req.body.type || "documento");
    let expiry_date = req.body.expiry_date || null;
    if (!truck_id || !req.file) return res.status(400).json({ error: "truck_id e arquivo são obrigatórios" });
    const filename = req.file.filename;
    const mime = (req.file.mimetype || "").toLowerCase();
    const size = req.file.size || null;
    const isPdf = mime.includes("pdf") || /\.pdf$/i.test(String(filename));
    if (!expiry_date && isPdf) {
      try {
        const buf = fs.readFileSync(path.join(uploadsRoot, "trucks", String(truck_id), filename));
        const parsed = await pdfParse(buf);
        const txt = parsed?.text || "";
        const validityDate = parseValidityDate(txt);
        const textDate = parseDateFromText(txt);
        const issueDate = parseIssueDate(txt);
        const exerciseYear = parseExerciseYear(txt);
        if (!expiry_date && validityDate) expiry_date = validityDate;
        if (!expiry_date && String(type) === "documento" && exerciseYear) {
          const end = endOfExerciseValidity(exerciseYear);
          if (end) expiry_date = end;
        }
        if (!expiry_date && String(type) === "tacografo_certificado" && issueDate) {
          // derive +1 year from issue date
          const [iy, im, id] = String(issueDate).split("-").map(Number);
          const base = new Date(iy, (im - 1), id);
          base.setFullYear(base.getFullYear() + 1);
          const yy = base.getFullYear();
          const mm = String(base.getMonth() + 1).padStart(2, "0");
          const dd = String(base.getDate()).padStart(2, "0");
          expiry_date = `${yy}-${mm}-${dd}`;
        }
        if (!expiry_date && textDate) expiry_date = textDate;
      } catch {}
    }
    if (!expiry_date) {
      expiry_date = computeExpiry({ type, filename, uploadedAt: Date.now() }) || null;
    }
    const r = await pool.query(
      "INSERT INTO truck_documents (truck_id, type, filename, mime, size, expiry_date) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *",
      [truck_id, type, filename, mime, size, expiry_date]
    );
    const row = r.rows[0];
    const url = `/uploads/trucks/${truck_id}/${filename}`;
    const { status, days } = computeExpiryStatus(row.expiry_date);
    res.json({ ...row, url, expiry_status: status, days_to_expiry: days });
  } catch (e) {
    console.error("Upload error", e);
    res.status(500).json({ error: "Falha no upload" });
  }
});

// List documents by truck
app.get("/api/caminhoes/:id/documentos", async (req, res) => {
  const truck_id = Number(req.params.id);
  const r = await pool.query("SELECT * FROM truck_documents WHERE truck_id=$1 ORDER BY uploaded_at DESC", [truck_id]);
  const rows = r.rows.map((row) => {
    const url = `/uploads/trucks/${truck_id}/${row.filename}`;
    const { status, days } = computeExpiryStatus(row.expiry_date);
    return { ...row, url, expiry_status: status, days_to_expiry: days };
  });
  res.json(rows);
});

// Update document (expiry_date only)
app.put("/api/documentos/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { expiry_date } = req.body || {};
    const r0 = await pool.query("SELECT * FROM truck_documents WHERE id=$1", [id]);
    const before = r0.rows[0];
    if (!before) return res.status(404).json({ error: "Not found" });
    const r = await pool.query("UPDATE truck_documents SET expiry_date=$1 WHERE id=$2 RETURNING *", [expiry_date || null, id]);
    const row = r.rows[0];
    const url = `/uploads/trucks/${row.truck_id}/${row.filename}`;
    res.json({ ...row, url });
  } catch (e) {
    console.error("Update document error", e);
    res.status(500).json({ error: "Falha ao atualizar documento" });
  }
});

// Delete document
app.delete("/api/documentos/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const r0 = await pool.query("SELECT * FROM truck_documents WHERE id=$1", [id]);
    const row = r0.rows[0];
    if (!row) return res.status(404).json({ error: "Not found" });
    const filePath = path.join(uploadsRoot, "trucks", String(row.truck_id), row.filename);
    try { fs.unlinkSync(filePath); } catch {}
    await pool.query("DELETE FROM truck_documents WHERE id=$1", [id]);
    res.json({ ok: true });
  } catch (e) {
    console.error("Delete document error", e);
    res.status(500).json({ error: "Falha ao excluir documento" });
  }
});

// Serve frontend static files
app.use(express.static(path.join(__dirname, "../frontend/dist")));

// Handle SPA routing - return index.html for any unknown route
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/dist/index.html"));
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`API running on http://localhost:${port}`);
});

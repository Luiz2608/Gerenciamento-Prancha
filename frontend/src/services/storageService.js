const KEY = "prancha_json_db";

const files = {
  motoristas: "data/motoristas.json",
  viagens: "data/viagens.json",
  destinos: "data/destinos.json",
  tipos: "data/tipos_servico.json",
  usuarios: "data/usuarios.json",
  config: "data/config.json",
  caminhoes: "data/caminhoes.json",
  pranchas: "data/pranchas.json",
  custos: "data/custos.json"
};

const base64 = (s) => typeof btoa !== "undefined" ? btoa(s) : Buffer.from(s).toString("base64");
const base64utf8 = (s) => typeof btoa !== "undefined" ? btoa(unescape(encodeURIComponent(s))) : Buffer.from(s, "utf8").toString("base64");
const uuid = () => "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
  const r = Math.random() * 16 | 0;
  const v = c === "x" ? r : (r & 0x3 | 0x8);
  return v.toString(16);
});
const CLIENT_ID_KEY = "client_id";
const getClientId = () => {
  try {
    let id = localStorage.getItem(CLIENT_ID_KEY);
    if (!id) { id = uuid(); localStorage.setItem(CLIENT_ID_KEY, id); }
    return id;
  } catch {
    return uuid();
  }
};

const API_URL = typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_API_URL ? String(import.meta.env.VITE_API_URL) : null;
const api = (path, opts = {}) => fetch(`${API_URL}${path}`, { ...opts, headers: { "Content-Type": "application/json", "x-client-id": getClientId(), ...(opts.headers || {}) } });

const getDB = () => JSON.parse(localStorage.getItem(KEY) || "null");
const setDB = (db) => localStorage.setItem(KEY, JSON.stringify(db));
const OPS_KEY = "prancha_ops_queue";
const getQueue = () => { try { return JSON.parse(localStorage.getItem(OPS_KEY) || "[]"); } catch { return []; } };
const setQueue = (q) => localStorage.setItem(OPS_KEY, JSON.stringify(q));
const isOnline = () => (typeof navigator !== "undefined" ? !!navigator.onLine : true);
let listenersRegistered = false;
let syncing = false;
function enqueue(op) { const q = getQueue(); q.push({ ...op, id: uuid(), when: new Date().toISOString() }); setQueue(q); }
async function syncPending() {
  if (syncing) return; syncing = true;
  try {
    const { supabase: sb } = await import("./supabaseClient.js");
    if (!sb || !isOnline()) { syncing = false; return; }
    let q = getQueue();
    if (!Array.isArray(q) || q.length === 0) { syncing = false; return; }
    const db = getDB();
    const mapMotoristas = {};
    const mapCaminhoes = {};
    const mapPranchas = {};
    const mapViagens = {};
    const processInsert = async (table, payload) => {
      const { data: row, error } = await sb.from(table).insert([payload]).select().single();
      if (error || !row) throw (error || new Error("insert_failed"));
      return row;
    };
    const processUpdate = async (table, idField, idVal, payload) => {
      const { data: row, error } = await sb.from(table).update(payload).eq(idField, idVal).select().single();
      if (error || !row) throw (error || new Error("update_failed"));
      return row;
    };
    const processDelete = async (table, idField, idVal) => { await sb.from(table).delete().eq(idField, idVal); return { ok: true }; };
    const nextQueue = [];
    for (const it of q) {
      try {
        if (it.table === "motoristas") {
          if (it.op === "insert") {
            const row = await processInsert("motoristas", it.payload);
            const oldId = it.localId;
            mapMotoristas[oldId] = row.id;
            const idx = db.motoristas.findIndex((d) => d.id === oldId);
            if (idx>=0) db.motoristas[idx] = { ...db.motoristas[idx], id: row.id };
            db.viagens = db.viagens.map((v) => (v.driver_id === oldId ? { ...v, driver_id: row.id } : v));
          } else if (it.op === "update") {
            const id = mapMotoristas[it.localId] || it.remoteId || it.localId;
            await processUpdate("motoristas", "id", id, it.payload);
          } else if (it.op === "delete") {
            const id = mapMotoristas[it.localId] || it.remoteId || it.localId;
            await processDelete("motoristas", "id", id);
          }
        } else if (it.table === "caminhoes") {
          if (it.op === "insert") {
            const row = await processInsert("caminhoes", it.payload);
            const oldId = it.localId;
            mapCaminhoes[oldId] = row.id;
            const idx = db.caminhoes.findIndex((d) => d.id === oldId);
            if (idx>=0) db.caminhoes[idx] = { ...db.caminhoes[idx], id: row.id };
            db.viagens = db.viagens.map((v) => (v.truck_id === oldId ? { ...v, truck_id: row.id } : v));
          } else if (it.op === "update") {
            const id = mapCaminhoes[it.localId] || it.remoteId || it.localId;
            await processUpdate("caminhoes", "id", id, it.payload);
          } else if (it.op === "delete") {
            const id = mapCaminhoes[it.localId] || it.remoteId || it.localId;
            await processDelete("caminhoes", "id", id);
          }
        } else if (it.table === "pranchas") {
          if (it.op === "insert") {
            let row;
            try {
              row = await processInsert("pranchas", it.payload);
            } catch (e) {
              const payload2 = { ...it.payload };
              delete payload2.plate;
              delete payload2.chassis;
              const partial = await processInsert("pranchas", payload2);
              row = { ...partial, plate: it.payload.plate, chassis: it.payload.chassis };
            }
            const oldId = it.localId;
            mapPranchas[oldId] = row.id;
            const idx = db.pranchas.findIndex((d) => d.id === oldId);
            if (idx>=0) db.pranchas[idx] = { ...db.pranchas[idx], id: row.id };
            db.viagens = db.viagens.map((v) => (v.prancha_id === oldId ? { ...v, prancha_id: row.id } : v));
          } else if (it.op === "update") {
            const id = mapPranchas[it.localId] || it.remoteId || it.localId;
            try {
              await processUpdate("pranchas", "id", id, it.payload);
            } catch (e) {
              const payload2 = { ...it.payload };
              delete payload2.plate;
              delete payload2.chassis;
              await processUpdate("pranchas", "id", id, payload2);
              // Update local DB to ensure plate/chassis are preserved locally even if backend rejected them
              const db = getDB();
              const idx = db.pranchas.findIndex((d) => d.id === id);
              if (idx >= 0) {
                db.pranchas[idx] = { ...db.pranchas[idx], ...it.payload };
                setDB(db);
              }
            }
          } else if (it.op === "delete") {
            const id = mapPranchas[it.localId] || it.remoteId || it.localId;
            await processDelete("pranchas", "id", id);
          }
        } else if (it.table === "viagens") {
          if (it.op === "insert") {
            const src = it.payload;
            let p = {
              date: src.date,
              driver_id: Number(mapMotoristas[src.driver_id] || src.driver_id),
              truck_id: src.truck_id != null ? Number(mapCaminhoes[src.truck_id] || src.truck_id) : null,
              prancha_id: src.prancha_id != null ? Number(mapPranchas[src.prancha_id] || src.prancha_id) : null,
              destination: src.destination || null,
              service_type: src.service_type || null,
              description: src.description || null,
              start_time: src.start_time || null,
              end_time: src.end_time || null,
              km_start: src.km_start != null ? Number(src.km_start) : null,
              km_end: src.km_end != null ? Number(src.km_end) : null,
              fuel_liters: src.fuel_liters != null ? Number(src.fuel_liters) : 0,
              fuel_price: src.fuel_price != null ? Number(src.fuel_price) : 0,
              other_costs: src.other_costs != null ? Number(src.other_costs) : 0,
              maintenance_cost: src.maintenance_cost != null ? Number(src.maintenance_cost) : 0,
              driver_daily: src.driver_daily != null ? Number(src.driver_daily) : 0,
              requester: src.requester || null,
              status: computeStatus(src.end_time, src.km_end)
            };
            const row = await processInsert("viagens", p);
            const oldId = it.localId;
            mapViagens[oldId] = row.id;
            const idx = db.viagens.findIndex((d) => d.id === oldId);
            if (idx>=0) db.viagens[idx] = { ...db.viagens[idx], id: row.id };
            db.custos = db.custos.map((c) => (String(c.viagemId) === String(oldId) ? { ...c, viagemId: String(row.id) } : c));
          } else if (it.op === "update") {
            const id = mapViagens[it.localId] || it.remoteId || it.localId;
            const src = it.payload;
            const p = {
              date: src.date,
              driver_id: Number(src.driver_id),
              truck_id: src.truck_id != null ? Number(src.truck_id) : null,
              prancha_id: src.prancha_id != null ? Number(src.prancha_id) : null,
              destination: src.destination || null,
              service_type: src.service_type || null,
              description: src.description || null,
              start_time: src.start_time || null,
              end_time: src.end_time || null,
              km_start: src.km_start != null ? Number(src.km_start) : null,
              km_end: src.km_end != null ? Number(src.km_end) : null,
              fuel_liters: src.fuel_liters != null ? Number(src.fuel_liters) : 0,
              fuel_price: src.fuel_price != null ? Number(src.fuel_price) : 0,
              other_costs: src.other_costs != null ? Number(src.other_costs) : 0,
              maintenance_cost: src.maintenance_cost != null ? Number(src.maintenance_cost) : 0,
              driver_daily: src.driver_daily != null ? Number(src.driver_daily) : 0,
              requester: src.requester || null,
              status: computeStatus(src.end_time, src.km_end)
            };
            await processUpdate("viagens", "id", id, p);
          } else if (it.op === "delete") {
            const id = mapViagens[it.localId] || it.remoteId || it.localId;
            await processDelete("viagens", "id", id);
          }
        } else if (it.table === "custos") {
          if (it.op === "insert") {
            const p = { ...it.payload };
            p.viagemId = p.viagemId != null ? String(mapViagens[Number(p.viagemId)] || p.viagemId) : p.viagemId;
            await processInsert("custos", p);
          } else if (it.op === "update") {
            const id = it.remoteId || it.localId;
            await processUpdate("custos", "id", id, it.payload);
          } else if (it.op === "delete") {
            const id = it.remoteId || it.localId;
            await processDelete("custos", "id", id);
          }
        } else if (it.table === "login_logs") {
          if (it.op === "insert") {
            await processInsert("login_logs", it.payload);
          }
        }
      } catch (e) {
        nextQueue.push(it);
      }
    }
    setDB(db);
    setQueue(nextQueue);
  } finally { syncing = false; }
}
function ensureListeners() {
  if (listenersRegistered) return;
  listenersRegistered = true;
  if (typeof window !== "undefined") {
    window.addEventListener("online", () => { syncPending(); });
  }
}

async function fetchJson(path, fallback) {
  try {
    const r = await fetch(path);
    if (!r.ok) return fallback;
    return await r.json();
  } catch {
    return fallback;
  }
}

export async function initLoad() {
  const existing = getDB();
  if (existing) {
    const db = existing;
    db.motoristas = Array.isArray(db.motoristas) ? db.motoristas : [];
    db.viagens = Array.isArray(db.viagens) ? db.viagens : [];
    db.destinos = Array.isArray(db.destinos) ? db.destinos : [];
    db.tipos_servico = Array.isArray(db.tipos_servico) ? db.tipos_servico : [];
    db.usuarios = Array.isArray(db.usuarios) ? db.usuarios : [];
    db.config = db.config || {};
    db.caminhoes = Array.isArray(db.caminhoes) ? db.caminhoes : [];
    db.pranchas = Array.isArray(db.pranchas) ? db.pranchas : [];
    db.custos = Array.isArray(db.custos) ? db.custos : [];
    db.seq = db.seq || {};
    db.seq.motoristas = Number.isFinite(db.seq.motoristas) ? db.seq.motoristas : (db.motoristas.reduce((m, x) => Math.max(m, x.id || 0), 0) + 1);
    db.seq.viagens = Number.isFinite(db.seq.viagens) ? db.seq.viagens : (db.viagens.reduce((m, x) => Math.max(m, x.id || 0), 0) + 1);
    db.seq.destinos = Number.isFinite(db.seq.destinos) ? db.seq.destinos : (db.destinos.reduce((m, x) => Math.max(m, x.id || 0), 0) + 1);
    db.seq.tipos = Number.isFinite(db.seq.tipos) ? db.seq.tipos : (db.tipos_servico.reduce((m, x) => Math.max(m, x.id || 0), 0) + 1);
    db.seq.caminhoes = Number.isFinite(db.seq.caminhoes) ? db.seq.caminhoes : (db.caminhoes.reduce((m, x) => Math.max(m, x.id || 0), 0) + 1);
    db.seq.pranchas = Number.isFinite(db.seq.pranchas) ? db.seq.pranchas : (db.pranchas.reduce((m, x) => Math.max(m, x.id || 0), 0) + 1);
    setDB(db);
    try { await migrateCostsFromTrips(db); } catch (e) { console.error("Migration error", e); }
    ensureListeners();
    await syncPending();
    return db;
  }
  const [motoristas, viagens, destinos, tipos, usuarios, config, caminhoes, pranchas, custos] = await Promise.all([
    fetchJson(files.motoristas, []),
    fetchJson(files.viagens, []),
    fetchJson(files.destinos, []),
    fetchJson(files.tipos, []),
    fetchJson(files.usuarios, []),
    fetchJson(files.config, {}),
    fetchJson(files.caminhoes, []),
    fetchJson(files.pranchas, []),
    fetchJson(files.custos, [])
  ]);
  const db = {
    motoristas,
    viagens,
    destinos,
    tipos_servico: tipos,
    usuarios,
    config,
    caminhoes,
    pranchas,
    custos: Array.isArray(custos) ? custos : [],
    seq: {
      motoristas: motoristas.reduce((m, x) => Math.max(m, x.id || 0), 0) + 1,
      viagens: viagens.reduce((m, x) => Math.max(m, x.id || 0), 0) + 1,
      destinos: destinos.reduce((m, x) => Math.max(m, x.id || 0), 0) + 1,
      tipos: tipos.reduce((m, x) => Math.max(m, x.id || 0), 0) + 1,
      caminhoes: caminhoes.reduce((m, x) => Math.max(m, x.id || 0), 0) + 1,
      pranchas: pranchas.reduce((m, x) => Math.max(m, x.id || 0), 0) + 1
    }
  };
  setDB(db);
  try { await migrateCostsFromTrips(db); } catch (e) { console.error("Migration error", e); }
  ensureListeners();
  await syncPending();
  return db;
}

const computeKm = (a, b) => (a == null || b == null ? 0 : Math.max(0, Number(b) - Number(a)));
const computeHours = (date, s, e, endDate) => {
  if (!date || !s || !e) return 0;
  const [sh, sm] = String(s).split(":").map((x) => Number(x) || 0);
  const [eh, em] = String(e).split(":").map((x) => Number(x) || 0);
  const startMin = sh * 60 + sm;
  const endMin = eh * 60 + em;
  let diffMin = endMin - startMin;
  if (diffMin < 0) diffMin += 24 * 60;
  if (endDate && endDate !== date) {
    const parseIso = (iso) => {
      const [y, m, d] = String(iso || "").split("-").map(Number);
      if (!y || !m || !d) return null;
      return new Date(y, (m - 1), d);
    };
    const d1 = parseIso(date);
    const d2 = parseIso(endDate);
    if (d1 && d2) {
      const days = Math.max(0, Math.round((d2 - d1) / (24 * 60 * 60 * 1000)));
      diffMin += days * 24 * 60;
    }
  }
  return Math.round((diffMin / 60) * 100) / 100;
};
const computeStatus = (end_time, km_end) => (!end_time || end_time === "" || km_end == null || km_end === "" ? "Em Andamento" : "Finalizado");

export async function login(username, password) {
  await initLoad();
  if (API_URL) {
    const r = await api("/api/login", { method: "POST", body: JSON.stringify({ username, password }) });
    const j = await r.json();
    if (!r.ok) throw new Error(j?.error || "Credenciais inválidas");
    const token = j?.token || "local-token";
    const user = j?.user || { id: null, username, role: "user" };
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(user));
    return { token, user };
  }
  const { supabase: sb } = await import("./supabaseClient.js");
  if (sb && isOnline()) {
    const { data, error } = await sb.auth.signInWithPassword({ email: String(username), password: String(password) });
    if (error) throw error;
    const session = data?.session || null;
    const user = session?.user || null;
    const token = session?.access_token || "supabase-token";
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify({ id: user?.id, username: user?.email, role: "user" }));
    try {
      const ua = typeof navigator !== "undefined" ? String(navigator.userAgent || "").toLowerCase() : "";
      const device = /mobi|android|iphone|ipad|ipod/.test(ua) ? "mobile" : "desktop";
      const clientId = getClientId();
      await sb.from("login_logs").insert([{ user_id: String(user?.id || ""), email: String(user?.email || username), device, client_id: clientId }]);
    } catch {}
    return { token, user: { id: user?.id, username: user?.email, role: "user" } };
  }
  const db = getDB();
  const u = db.usuarios.find((x) => x.username === username);
  if (!u) throw new Error("Credenciais inválidas");
  const p = base64(password);
  if (u.password_base64 !== p) throw new Error("Credenciais inválidas");
  localStorage.setItem("token", "local-token");
  localStorage.setItem("user", JSON.stringify({ id: u.id, username: u.username, role: u.role || "user" }));
  try {
    const ua = typeof navigator !== "undefined" ? String(navigator.userAgent || "").toLowerCase() : "";
    const device = /mobi|android|iphone|ipad|ipod/.test(ua) ? "mobile" : "desktop";
    const clientId = getClientId();
    enqueue({ table: "login_logs", op: "insert", payload: { user_id: String(u.id), email: String(u.username), device, client_id: clientId } });
  } catch {}
  return { token: "local-token", user: { id: u.id, username: u.username, role: u.role || "user" } };
}
export async function registerUser(username, password, role = "user") {
  await initLoad();
  if (API_URL) {
    const r = await api("/api/usuarios/register", { method: "POST", body: JSON.stringify({ username, password, role }) });
    const j = await r.json();
    if (!r.ok) throw new Error(j?.error || "Erro ao registrar");
    return j;
  }
  const { supabase: sb } = await import("./supabaseClient.js");
  if (sb && isOnline()) {
    const { data, error } = await sb.auth.signUp({ email: String(username), password: String(password) });
    if (error) throw error;
    const requiresEmailConfirmation = !!(data?.user && !data?.session);
    return { username, role, requiresEmailConfirmation };
  }
  const db = getDB();
  if (db.usuarios.find((x) => x.username === username)) throw new Error("Usuário já existe");
  const id = db.usuarios.reduce((m, u) => Math.max(m, u.id || 0), 0) + 1;
  const password_base64 = base64(password);
  db.usuarios.push({ id, username, password_base64, role });
  setDB(db);
  return { id, username, role };
}

export async function getMotoristas() { await initLoad(); if (API_URL) { const r = await api("/api/motoristas"); const j = await r.json(); return Array.isArray(j) ? j : []; } const { supabase: sb } = await import("./supabaseClient.js"); if (sb && isOnline()) { const { data } = await sb.from("motoristas").select("*").order("id", { ascending: false }); const rows = Array.isArray(data) ? data : []; const db = getDB(); db.motoristas = rows.slice(); setDB(db); return rows; } return getDB().motoristas.slice().reverse(); }
export async function saveMotorista(data) { await initLoad(); if (API_URL) { const r = await api("/api/motoristas", { method: "POST", body: JSON.stringify({ name: data.name, cpf: data.cpf || null, cnh_category: data.cnh_category || null, status: data.status || "Ativo" }) }); return await r.json(); } const { supabase: sb } = await import("./supabaseClient.js"); const payload = { name: data.name, cpf: data.cpf || null, cnh_category: data.cnh_category || null, status: data.status || "Ativo" }; if (sb && isOnline()) { const { data: row } = await sb.from("motoristas").insert([payload]).select().single(); const db = getDB(); const idx = db.motoristas.findIndex((d) => d.id === row.id); if (idx>=0) db.motoristas[idx] = row; else db.motoristas.push(row); setDB(db); return row; } const db = getDB(); const id = db.seq.motoristas++; const row = { id, ...payload }; db.motoristas.push(row); setDB(db); enqueue({ table: "motoristas", op: "insert", payload, localId: id }); return row; }
export async function updateMotorista(id, data) { await initLoad(); if (API_URL) { const r = await api(`/api/motoristas/${id}`, { method: "PUT", body: JSON.stringify({ name: data.name, cpf: data.cpf || null, cnh_category: data.cnh_category || null, status: data.status || "Ativo" }) }); return await r.json(); } const { supabase: sb } = await import("./supabaseClient.js"); const payload = { name: data.name, cpf: data.cpf || null, cnh_category: data.cnh_category || null, status: data.status || "Ativo" }; if (sb && isOnline()) { const { data: row } = await sb.from("motoristas").update(payload).eq("id", id).select().single(); const db = getDB(); const i = db.motoristas.findIndex((d) => d.id === id); if (i>=0) db.motoristas[i] = row; else db.motoristas.push(row); setDB(db); return row; } const db = getDB(); const i = db.motoristas.findIndex((d) => d.id === id); if (i>=0) db.motoristas[i] = { id, ...payload }; else db.motoristas.push({ id, ...payload }); setDB(db); enqueue({ table: "motoristas", op: "update", payload, localId: id }); return db.motoristas[i>=0?i:db.motoristas.length-1]; }
export async function deleteMotorista(id) { await initLoad(); if (API_URL) { await api(`/api/motoristas/${id}`, { method: "DELETE" }); return { ok: true }; } const { supabase: sb } = await import("./supabaseClient.js"); if (sb && isOnline()) { await sb.from("motoristas").delete().eq("id", id); const db = getDB(); db.motoristas = db.motoristas.filter((d) => d.id !== id); setDB(db); return { ok: true }; } const db = getDB(); db.motoristas = db.motoristas.filter((d) => d.id !== id); setDB(db); enqueue({ table: "motoristas", op: "delete", localId: id }); return { ok: true }; }

export async function getViagens(opts = {}) {
  await initLoad();
  const { supabase: sb } = await import("./supabaseClient.js");
  const { startDate, endDate, driverId, destination, status, search, truckId, pranchaId, vehicleType, plate, id, page = 1, pageSize = 10 } = opts;
  if (API_URL) {
    const params = new URLSearchParams();
    if (id) params.set("id", id);
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    if (driverId) params.set("driverId", String(driverId));
    if (destination) params.set("destination", destination);
    if (status) params.set("status", status);
    if (truckId) params.set("truckId", String(truckId));
    if (pranchaId) params.set("pranchaId", String(pranchaId));
    if (plate) params.set("plate", plate);
    const r = await api(`/api/viagens?${params.toString()}`);
    const rows = await r.json();
    const total = rows.length;
    const offset = (Number(page) - 1) * Number(pageSize);
    const data = rows.slice(offset, offset + Number(pageSize));
    return { data, total, page: Number(page), pageSize: Number(pageSize) };
  } else if (sb && isOnline()) {
    let query = sb.from("viagens").select("*").order("date", { ascending: false }).order("id", { ascending: false });
    if (startDate) query = query.gte("date", startDate);
    if (endDate) query = query.lte("date", endDate);
    if (driverId) query = query.eq("driver_id", Number(driverId));
    if (status) query = query.eq("status", status);
    if (truckId) query = query.eq("truck_id", Number(truckId));
    if (pranchaId) query = query.eq("prancha_id", Number(pranchaId));
    const { data: rows0 } = await query;
    let rows = Array.isArray(rows0) ? rows0.slice() : [];
    if (id) rows = rows.filter((t) => String(t.id).includes(String(id)));
    if (destination) rows = rows.filter((t) => String(t.destination || "").toLowerCase().includes(destination.toLowerCase()));
    if (search) rows = rows.filter((t) => (t.description || "").toLowerCase().includes(search.toLowerCase()) || (t.service_type || "").toLowerCase().includes(search.toLowerCase()));
    if (vehicleType === "truck") rows = rows.filter((t) => t.truck_id != null);
    if (vehicleType === "prancha") rows = rows.filter((t) => t.prancha_id != null);
    if (plate) {
      const { data: trucks } = await sb.from("caminhoes").select("id, plate");
      rows = rows.filter((t) => {
        const tr = (Array.isArray(trucks) ? trucks : []).find((x) => x.id === t.truck_id);
        return tr && String(tr.plate || "").toLowerCase().includes(plate.toLowerCase());
      });
    }
    rows = rows.map((t) => ({ ...t, km_rodado: computeKm(t.km_start, t.km_end), horas: computeHours(t.date, t.start_time, t.end_time, t.end_date), total_cost: Number(t.fuel_liters || 0) * Number(t.fuel_price || 0) + Number(t.other_costs || 0) + Number(t.maintenance_cost || 0) + Number(t.driver_daily || 0) }));
    const total = rows.length;
    const offset = (Number(page) - 1) * Number(pageSize);
    const data = rows.slice(offset, offset + Number(pageSize));
    return { data, total, page: Number(page), pageSize: Number(pageSize) };
  }
  const db = getDB();
  let rows = db.viagens.slice().reverse();
  if (id) rows = rows.filter((t) => String(t.id).includes(String(id)));
  if (startDate) rows = rows.filter((t) => t.date >= startDate);
  if (endDate) rows = rows.filter((t) => t.date <= endDate);
  if (driverId) rows = rows.filter((t) => t.driver_id === Number(driverId));
  if (destination) rows = rows.filter((t) => (t.destination || "").toLowerCase().includes(destination.toLowerCase()));
  if (status) rows = rows.filter((t) => t.status === status);
  if (search) rows = rows.filter((t) => (t.description || "").toLowerCase().includes(search.toLowerCase()) || (t.service_type || "").toLowerCase().includes(search.toLowerCase()));
  if (truckId) rows = rows.filter((t) => t.truck_id === Number(truckId));
  if (pranchaId) rows = rows.filter((t) => t.prancha_id === Number(pranchaId));
  if (vehicleType === "truck") rows = rows.filter((t) => t.truck_id != null);
  if (vehicleType === "prancha") rows = rows.filter((t) => t.prancha_id != null);
  if (plate) rows = rows.filter((t) => {
    const tr = db.caminhoes.find((x) => x.id === t.truck_id);
    return tr && (tr.plate || "").toLowerCase().includes(plate.toLowerCase());
  });
  rows = rows.map((t) => ({ ...t, km_rodado: computeKm(t.km_start, t.km_end), horas: computeHours(t.date, t.start_time, t.end_time, t.end_date), total_cost: Number(t.fuel_liters || 0) * Number(t.fuel_price || 0) + Number(t.other_costs || 0) + Number(t.maintenance_cost || 0) + Number(t.driver_daily || 0) }));
  const total = rows.length;
  const offset = (Number(page) - 1) * Number(pageSize);
  const data = rows.slice(offset, offset + Number(pageSize));
  return { data, total, page: Number(page), pageSize: Number(pageSize) };
}
export async function getViagem(id) { await initLoad(); const { supabase: sb } = await import("./supabaseClient.js"); if (API_URL) { const r = await api(`/api/viagens/${id}`); if (!r.ok) return null; const j = await r.json(); return { ...j, end_date: j.end_date || j.date }; } if (sb && isOnline()) { const { data: t } = await sb.from("viagens").select("*").eq("id", Number(id)).single(); if (!t) return null; return { ...t, end_date: t.end_date || t.date, km_rodado: computeKm(t.km_start, t.km_end), horas: computeHours(t.date, t.start_time, t.end_time, t.end_date || t.date) }; } const db = getDB(); const t = db.viagens.find((x) => x.id === Number(id)); if (!t) return null; return { ...t, end_date: t.end_date || t.date, km_rodado: computeKm(t.km_start, t.km_end), horas: computeHours(t.date, t.start_time, t.end_time, t.end_date || t.date) }; }
export async function saveViagem(data) { await initLoad(); if (API_URL) { const r = await api("/api/viagens", { method: "POST", body: JSON.stringify(data) }); return await r.json(); } const { supabase: sb } = await import("./supabaseClient.js"); if (sb && isOnline()) { const status = data.status || computeStatus(data.end_time, data.km_end); const payload = { date: data.date, driver_id: Number(data.driver_id), truck_id: data.truck_id != null ? Number(data.truck_id) : null, prancha_id: data.prancha_id != null ? Number(data.prancha_id) : null, destination: data.destination || null, service_type: data.service_type || null, description: data.description || null, start_time: data.start_time || null, end_time: data.end_time || null, km_start: data.km_start != null ? Number(data.km_start) : null, km_end: data.km_end != null ? Number(data.km_end) : null, fuel_liters: data.fuel_liters != null ? Number(data.fuel_liters) : 0, fuel_price: data.fuel_price != null ? Number(data.fuel_price) : 0, other_costs: data.other_costs != null ? Number(data.other_costs) : 0, maintenance_cost: data.maintenance_cost != null ? Number(data.maintenance_cost) : 0, driver_daily: data.driver_daily != null ? Number(data.driver_daily) : 0, requester: data.requester || null, status };
  const { data: row, error } = await sb.from("viagens").insert([payload]).select().single();
  if (row) {
    if (row.truck_id != null && row.km_end != null) { await sb.from("caminhoes").update({ km_current: Number(row.km_end) }).eq("id", Number(row.truck_id)); }
    return { ...row, km_rodado: computeKm(row.km_start, row.km_end), horas: computeHours(row.date, row.start_time, row.end_time, row.end_date || row.date), total_cost: Number(row.fuel_liters || 0) * Number(row.fuel_price || 0) + Number(row.other_costs || 0) + Number(row.maintenance_cost || 0) + Number(row.driver_daily || 0) };
  }
}
const db = getDB(); const id = db.seq.viagens++; const status = data.status || computeStatus(data.end_time, data.km_end); const t = { id, date: data.date, end_date: data.end_date || data.date, driver_id: Number(data.driver_id), truck_id: data.truck_id != null ? Number(data.truck_id) : null, prancha_id: data.prancha_id != null ? Number(data.prancha_id) : null, destination: data.destination || null, service_type: data.service_type || null, description: data.description || null, start_time: data.start_time || null, end_time: data.end_time || null, km_start: data.km_start != null ? Number(data.km_start) : null, km_end: data.km_end != null ? Number(data.km_end) : null, fuel_liters: data.fuel_liters != null ? Number(data.fuel_liters) : 0, fuel_price: data.fuel_price != null ? Number(data.fuel_price) : 0, other_costs: data.other_costs != null ? Number(data.other_costs) : 0, maintenance_cost: data.maintenance_cost != null ? Number(data.maintenance_cost) : 0, driver_daily: data.driver_daily != null ? Number(data.driver_daily) : 0, requester: data.requester || null, status }; db.viagens.push(t); if (t.truck_id != null && t.km_end != null) { const ti = db.caminhoes.findIndex((d) => d.id === Number(t.truck_id)); if (ti>=0) db.caminhoes[ti] = { ...db.caminhoes[ti], km_current: Number(t.km_end) }; } setDB(db); enqueue({ table: "viagens", op: "insert", payload: t, localId: id }); return { ...t, km_rodado: computeKm(t.km_start, t.km_end), horas: computeHours(t.date, t.start_time, t.end_time, t.end_date), total_cost: Number(t.fuel_liters || 0) * Number(t.fuel_price || 0) + Number(t.other_costs || 0) + Number(t.maintenance_cost || 0) + Number(t.driver_daily || 0) }; }
export async function updateViagem(id, data) { await initLoad(); if (API_URL) { const r = await api(`/api/viagens/${id}`, { method: "PUT", body: JSON.stringify(data) }); return await r.json(); } const { supabase: sb } = await import("./supabaseClient.js"); if (sb && isOnline()) { const status = data.status || computeStatus(data.end_time, data.km_end); const payload = { date: data.date, driver_id: Number(data.driver_id), truck_id: data.truck_id != null ? Number(data.truck_id) : null, prancha_id: data.prancha_id != null ? Number(data.prancha_id) : null, destination: data.destination || null, service_type: data.service_type || null, description: data.description || null, start_time: data.start_time || null, end_time: data.end_time || null, km_start: data.km_start != null ? Number(data.km_start) : null, km_end: data.km_end != null ? Number(data.km_end) : null, fuel_liters: data.fuel_liters != null ? Number(data.fuel_liters) : 0, fuel_price: data.fuel_price != null ? Number(data.fuel_price) : 0, other_costs: data.other_costs != null ? Number(data.other_costs) : 0, maintenance_cost: data.maintenance_cost != null ? Number(data.maintenance_cost) : 0, driver_daily: data.driver_daily != null ? Number(data.driver_daily) : 0, requester: data.requester || null, status };
  const { data: row, error } = await sb.from("viagens").update(payload).eq("id", Number(id)).select().single();
  if (row) {
    if (row.truck_id != null && row.km_end != null) { await sb.from("caminhoes").update({ km_current: Number(row.km_end) }).eq("id", Number(row.truck_id)); }
    return { ...row, km_rodado: computeKm(row.km_start, row.km_end), horas: computeHours(row.date, row.start_time, row.end_time, row.end_date || row.date), total_cost: Number(row.fuel_liters || 0) * Number(row.fuel_price || 0) + Number(row.other_costs || 0) + Number(row.maintenance_cost || 0) + Number(row.driver_daily || 0) };
  }
}
const db = getDB(); const i = db.viagens.findIndex((t) => t.id === Number(id)); const status = data.status || computeStatus(data.end_time, data.km_end); if (i>=0) db.viagens[i] = { id: Number(id), date: data.date, end_date: data.end_date || data.date, driver_id: Number(data.driver_id), truck_id: data.truck_id != null ? Number(data.truck_id) : null, prancha_id: data.prancha_id != null ? Number(data.prancha_id) : null, destination: data.destination || null, service_type: data.service_type || null, description: data.description || null, start_time: data.start_time || null, end_time: data.end_time || null, km_start: data.km_start != null ? Number(data.km_start) : null, km_end: data.km_end != null ? Number(data.km_end) : null, fuel_liters: data.fuel_liters != null ? Number(data.fuel_liters) : 0, fuel_price: data.fuel_price != null ? Number(data.fuel_price) : 0, other_costs: data.other_costs != null ? Number(data.other_costs) : 0, maintenance_cost: data.maintenance_cost != null ? Number(data.maintenance_cost) : 0, driver_daily: data.driver_daily != null ? Number(data.driver_daily) : 0, requester: data.requester || null, status }; const t = db.viagens[i]; if (t.truck_id != null && t.km_end != null) { const ti = db.caminhoes.findIndex((d) => d.id === Number(t.truck_id)); if (ti>=0) db.caminhoes[ti] = { ...db.caminhoes[ti], km_current: Number(t.km_end) }; } setDB(db);
enqueue({ table: "viagens", op: "update", payload: t, localId: Number(id) }); return { ...t, km_rodado: computeKm(t.km_start, t.km_end), horas: computeHours(t.date, t.start_time, t.end_time, t.end_date), total_cost: Number(t.fuel_liters || 0) * Number(t.fuel_price || 0) + Number(t.other_costs || 0) + Number(t.maintenance_cost || 0) + Number(t.driver_daily || 0) };
}
export async function deleteViagem(id) { await initLoad(); const { supabase: sb } = await import("./supabaseClient.js"); if (API_URL) { await api(`/api/viagens/${id}`, { method: "DELETE" }); return { ok: true }; } if (sb && isOnline()) { await sb.from("viagens").delete().eq("id", Number(id)); return { ok: true }; } const db = getDB(); db.viagens = db.viagens.filter((t) => t.id !== Number(id)); setDB(db); enqueue({ table: "viagens", op: "delete", localId: Number(id) }); return { ok: true }; }

export async function getDestinos() { await initLoad(); return getDB().destinos; }
export async function saveDestino(name) { await initLoad(); const db = getDB(); const id = db.seq.destinos++; const row = { id, name }; db.destinos.push(row); setDB(db); return row; }
export async function deleteDestino(id) { await initLoad(); const db = getDB(); db.destinos = db.destinos.filter((d) => d.id !== Number(id)); setDB(db); return { ok: true }; }

export async function getTiposServico() { await initLoad(); return getDB().tipos_servico; }
export async function saveTipoServico(name) { await initLoad(); const db = getDB(); const id = db.seq.tipos++; const row = { id, name }; db.tipos_servico.push(row); setDB(db); return row; }
export async function deleteTipoServico(id) { await initLoad(); const db = getDB(); db.tipos_servico = db.tipos_servico.filter((d) => d.id !== Number(id)); setDB(db); return { ok: true }; }

export async function getTruck() { await initLoad(); return getDB().config.truck || {}; }
export async function updateTruck(data) { await initLoad(); const db = getDB(); db.config.truck = { plate: data.plate || null, model: data.model || null, year: data.year != null ? Number(data.year) : null }; setDB(db); return db.config.truck; }

export async function getCaminhoes() { 
  await initLoad(); 
  if (API_URL) { 
    try {
      const r = await api("/api/caminhoes"); 
      const j = await r.json(); 
      return Array.isArray(j) ? j : []; 
    } catch (e) {
      console.error("API error getCaminhoes", e);
      return [];
    }
  } 
  const { supabase: sb } = await import("./supabaseClient.js"); 
  if (sb && isOnline()) { 
    const { data } = await sb.from("caminhoes").select("*").order("id", { ascending: false }); 
    const rows = Array.isArray(data) ? data : []; 
    const db = getDB(); 
    if (db && Array.isArray(db.caminhoes)) {
      const mergedRows = rows.map(r => {
        const local = db.caminhoes.find(p => p.id == r.id);
        if (local) {
          return { ...r, chassis: local.chassis || r.chassis, plate: local.plate || r.plate, fleet: local.fleet || r.fleet };
        }
        return r;
      });
      db.caminhoes = mergedRows.slice(); 
      setDB(db); 
      return mergedRows; 
    }
    return rows;
  } 
  const db = getDB();
  return (db && Array.isArray(db.caminhoes)) ? db.caminhoes.slice().reverse() : []; 
}

export async function saveCaminhao(data) {
  await initLoad();
  if (API_URL) {
    const r = await api("/api/caminhoes", {
      method: "POST",
      body: JSON.stringify({
        plate: data.plate || null,
        model: data.model || null,
        year: data.year != null ? Number(data.year) : null,
        chassis: data.chassis || null,
        km_current: data.km_current != null ? Number(data.km_current) : null,
        fleet: data.fleet || null,
        status: data.status || "Ativo"
      })
    });
    return await r.json();
  }
  const { supabase: sb } = await import("./supabaseClient.js");
  const payload = {
    plate: data.plate || null,
    model: data.model || null,
    year: data.year != null ? Number(data.year) : null,
    chassis: data.chassis || null,
    km_current: data.km_current != null ? Number(data.km_current) : null,
    fleet: data.fleet || null,
    status: data.status || "Ativo"
  };
  if (sb && isOnline()) {
    const { data: row } = await sb.from("caminhoes").insert([payload]).select().single();
    const db = getDB();
    if (db && Array.isArray(db.caminhoes)) {
        const idx = db.caminhoes.findIndex((d) => d.id == row.id);
        const localRow = { ...row, chassis: payload.chassis || row.chassis, plate: payload.plate || row.plate, fleet: payload.fleet || row.fleet };
        if (idx >= 0) db.caminhoes[idx] = localRow;
        else db.caminhoes.push(localRow);
        setDB(db);
    }
    return row; // Return row from Supabase
  }
  const db = getDB();
  const id = db.seq.caminhoes++;
  const row = { id, ...payload };
  db.caminhoes.push(row);
  setDB(db);
  enqueue({ table: "caminhoes", op: "insert", payload, localId: id });
  return row;
}

export async function updateCaminhao(id, data) {
  await initLoad();
  if (API_URL) {
    const r = await api(`/api/caminhoes/${id}`, {
      method: "PUT",
      body: JSON.stringify({
        plate: data.plate || null,
        model: data.model || null,
        year: data.year != null ? Number(data.year) : null,
        chassis: data.chassis || null,
        km_current: data.km_current != null ? Number(data.km_current) : null,
        fleet: data.fleet || null,
        status: data.status || "Ativo"
      })
    });
    return await r.json();
  }
  const { supabase: sb } = await import("./supabaseClient.js");
  const payload = {
    plate: data.plate || null,
    model: data.model || null,
    year: data.year != null ? Number(data.year) : null,
    chassis: data.chassis || null,
    km_current: data.km_current != null ? Number(data.km_current) : null,
    fleet: data.fleet || null,
    status: data.status || "Ativo"
  };
  if (sb && isOnline()) {
    const { data: row } = await sb.from("caminhoes").update(payload).eq("id", id).select().single();
    const db = getDB();
    if (db && Array.isArray(db.caminhoes)) {
        const i = db.caminhoes.findIndex((d) => d.id == id);
        const localRow = { ...row, chassis: payload.chassis || row.chassis, plate: payload.plate || row.plate, fleet: payload.fleet || row.fleet };
        if (i >= 0) db.caminhoes[i] = localRow;
        else db.caminhoes.push(localRow);
        setDB(db);
    }
    return row;
  }
  const db = getDB();
  const i = db.caminhoes.findIndex((d) => d.id == id);
  if (i >= 0) db.caminhoes[i] = { id: Number(id), ...payload };
  else db.caminhoes.push({ id: Number(id), ...payload });
  setDB(db);
  enqueue({ table: "caminhoes", op: "update", payload, localId: Number(id) });
  return db.caminhoes[i >= 0 ? i : db.caminhoes.length - 1];
}

export async function deleteCaminhao(id) {
  await initLoad();
  if (API_URL) {
    await api(`/api/caminhoes/${id}`, { method: "DELETE" });
    return { ok: true };
  }
  const { supabase: sb } = await import("./supabaseClient.js");
  if (sb && isOnline()) {
    await sb.from("caminhoes").delete().eq("id", id);
    const db = getDB();
    if (db && Array.isArray(db.caminhoes)) {
        db.caminhoes = db.caminhoes.filter((d) => d.id !== Number(id));
        setDB(db);
    }
    return { ok: true };
  }
  const db = getDB();
  db.caminhoes = db.caminhoes.filter((d) => d.id !== Number(id));
  setDB(db);
  enqueue({ table: "caminhoes", op: "delete", localId: Number(id) });
  return { ok: true };
}

export async function getPranchas() { 
  await initLoad(); 
  if (API_URL) { 
    try {
      const r = await api("/api/pranchas"); 
      const j = await r.json(); 
      return Array.isArray(j) ? j : []; 
    } catch (e) {
      console.error("API error getPranchas", e);
      return [];
    }
  } 
  const { supabase: sb } = await import("./supabaseClient.js"); 
  if (sb && isOnline()) { 
    const { data } = await sb.from("pranchas").select("*").order("id", { ascending: false }); 
    const rows = Array.isArray(data) ? data : []; 
    const db = getDB(); 
    if (db && Array.isArray(db.pranchas)) {
      const mergedRows = rows.map(r => {
        const local = db.pranchas.find(p => p.id == r.id);
        if (local) {
          return { ...r, plate: local.plate || r.plate, chassis: local.chassis || r.chassis, fleet: local.fleet || r.fleet, conjunto: local.conjunto || r.conjunto, is_set: local.is_set || r.is_set, asset_number2: local.asset_number2 || r.asset_number2, plate2: local.plate2 || r.plate2, chassis2: local.chassis2 || r.chassis2 };
        }
        return r;
      });
      db.pranchas = mergedRows.slice(); 
      setDB(db); 
      return mergedRows; 
    }
    return rows;
  } 
  const db = getDB();
  return (db && Array.isArray(db.pranchas)) ? db.pranchas.slice().reverse() : []; 
}

export async function savePrancha(data) {
  await initLoad();
  if (API_URL) {
    const r = await api("/api/pranchas", {
      method: "POST",
      body: JSON.stringify({
        asset_number: data.asset_number || null,
        type: data.type || null,
        capacity: data.capacity != null ? Number(data.capacity) : null,
        year: data.year != null ? Number(data.year) : null,
        plate: data.plate || null,
        chassis: data.chassis || null,
        status: data.status || "Ativo",
        fleet: data.fleet || null,
        conjunto: data.conjunto || null,
        is_set: data.is_set || false,
        asset_number2: data.asset_number2 || null,
        plate2: data.plate2 || null,
        chassis2: data.chassis2 || null
      })
    });
    return await r.json();
  }
  const { supabase: sb } = await import("./supabaseClient.js");
  const payloadBase = {
    asset_number: data.asset_number || null,
    type: data.type || null,
    capacity: data.capacity != null ? Number(data.capacity) : null,
    year: data.year != null ? Number(data.year) : null,
    status: data.status || "Ativo"
  };
  const payloadDb = {
    ...payloadBase,
    plate: data.plate || null,
    chassis: data.chassis || null,
    fleet: data.fleet || null,
    conjunto: data.conjunto || null,
    is_set: data.is_set || false,
    asset_number2: data.asset_number2 || null,
    plate2: data.plate2 || null,
    chassis2: data.chassis2 || null
  };
  if (sb && isOnline()) {
    let row = null;
    const ins1 = await sb.from("pranchas").insert([payloadDb]).select().single();
    if (ins1.error || !ins1.data) {
      const ins2 = await sb.from("pranchas").insert([payloadBase]).select().single();
      row = ins2.data ? { ...ins2.data, plate: payloadDb.plate, chassis: payloadDb.chassis, fleet: payloadDb.fleet, conjunto: payloadDb.conjunto, is_set: payloadDb.is_set, asset_number2: payloadDb.asset_number2, plate2: payloadDb.plate2, chassis2: payloadDb.chassis2 } : null;
    } else {
      row = ins1.data;
    }
    const db = getDB();
    if (row && db && Array.isArray(db.pranchas)) {
      const idx = db.pranchas.findIndex((d) => d.id == row.id);
      if (idx >= 0) db.pranchas[idx] = row;
      else db.pranchas.push(row);
      setDB(db);
      return row;
    }
  }
  const db = getDB();
  const id = db.seq.pranchas++;
  const row = { id, ...payloadDb };
  db.pranchas.push(row);
  setDB(db);
  enqueue({ table: "pranchas", op: "insert", payload: payloadDb, localId: id });
  return row;
}

export async function updatePrancha(id, data) {
  await initLoad();
  if (API_URL) {
    const r = await api(`/api/pranchas/${id}`, {
      method: "PUT",
      body: JSON.stringify({
        asset_number: data.asset_number || null,
        type: data.type || null,
        capacity: data.capacity != null ? Number(data.capacity) : null,
        year: data.year != null ? Number(data.year) : null,
        plate: data.plate || null,
        chassis: data.chassis || null,
        status: data.status || "Ativo",
        fleet: data.fleet || null,
        conjunto: data.conjunto || null,
        is_set: data.is_set || false,
        asset_number2: data.asset_number2 || null,
        plate2: data.plate2 || null,
        chassis2: data.chassis2 || null
      })
    });
    return await r.json();
  }
  const { supabase: sb } = await import("./supabaseClient.js");
  const payloadBase = {
    asset_number: data.asset_number || null,
    type: data.type || null,
    capacity: data.capacity != null ? Number(data.capacity) : null,
    year: data.year != null ? Number(data.year) : null,
    status: data.status || "Ativo"
  };
  const payloadDb = {
    ...payloadBase,
    plate: data.plate || null,
    chassis: data.chassis || null,
    fleet: data.fleet || null,
    conjunto: data.conjunto || null,
    is_set: data.is_set || false,
    asset_number2: data.asset_number2 || null,
    plate2: data.plate2 || null,
    chassis2: data.chassis2 || null
  };
  if (sb && isOnline()) {
    let row = null;
    const up1 = await sb.from("pranchas").update(payloadDb).eq("id", Number(id)).select().single();
    if (up1.error || !up1.data) {
      const up2 = await sb.from("pranchas").update(payloadBase).eq("id", Number(id)).select().single();
      row = up2.data ? { ...up2.data, plate: payloadDb.plate, chassis: payloadDb.chassis, fleet: payloadDb.fleet, conjunto: payloadDb.conjunto, is_set: payloadDb.is_set, asset_number2: payloadDb.asset_number2, plate2: payloadDb.plate2, chassis2: payloadDb.chassis2 } : null;
    } else {
      row = up1.data;
    }
    const db = getDB();
    if (row && db && Array.isArray(db.pranchas)) {
      const i = db.pranchas.findIndex((d) => d.id == id);
      if (i >= 0) db.pranchas[i] = row;
      else db.pranchas.push(row);
      setDB(db);
      return row;
    }
  }
  const db = getDB();
  const i = db.pranchas.findIndex((d) => d.id == id);
  if (i >= 0) db.pranchas[i] = { id: Number(id), ...payloadDb };
  else db.pranchas.push({ id: Number(id), ...payloadDb });
  setDB(db);
  enqueue({ table: "pranchas", op: "update", payload: payloadDb, localId: Number(id) });
  return db.pranchas[i >= 0 ? i : db.pranchas.length - 1];
}

export async function deletePrancha(id) {
  await initLoad();
  if (API_URL) {
    await api(`/api/pranchas/${id}`, { method: "DELETE" });
    return { ok: true };
  }
  const { supabase: sb } = await import("./supabaseClient.js");
  if (sb && isOnline()) {
    await sb.from("pranchas").delete().eq("id", id);
    const db = getDB();
    if (db && Array.isArray(db.pranchas)) {
      db.pranchas = db.pranchas.filter((d) => d.id !== Number(id));
      setDB(db);
    }
    return { ok: true };
  }
  const db = getDB();
  db.pranchas = db.pranchas.filter((d) => d.id !== Number(id));
  setDB(db);
  enqueue({ table: "pranchas", op: "delete", localId: Number(id) });
  return { ok: true };
}

export async function getViagemByCaminhao(id, opts = {}) { return getViagens({ ...opts, truckId: id }); }
export async function getViagemByPrancha(id, opts = {}) { return getViagens({ ...opts, pranchaId: id }); }

export async function dashboard(opts = {}) {
  await initLoad();
  const { supabase: sb } = await import("./supabaseClient.js");
  const now = new Date();
  const year = Number(opts.year || now.getFullYear());
  const monthNum = Number(opts.month || (now.getMonth() + 1));
  const month = String(Math.min(12, Math.max(1, monthNum))).padStart(2, "0");
  const start = String(opts.startDate || `${year}-${month}-01`);
  const endDate0 = opts.endDate ? (() => { const [y2, m2, d2] = String(opts.endDate).split("-").map(Number); return new Date(y2, (m2 - 1), d2); })() : new Date(year, (Number(month) - 1) + 1, 0);
  const end = String(opts.endDate || `${year}-${month}-${String(endDate0.getDate()).padStart(2, "0")}`);

  // Previous month calculation
  const prevDate = new Date(year, monthNum - 2, 1);
  const prevYear = prevDate.getFullYear();
  const prevMonth = String(prevDate.getMonth() + 1).padStart(2, "0");
  const prevStart = `${prevYear}-${prevMonth}-01`;
  const prevEnd0 = new Date(prevYear, prevDate.getMonth() + 1, 0);
  const prevEnd = `${prevYear}-${prevMonth}-${String(prevEnd0.getDate()).padStart(2, "0")}`;

  let viagens = [];
  let motoristas = [];
  let caminhoes = [];
  let pranchas = [];
  let custos = [];
  if (sb && isOnline()) {
    const { data: v } = await sb.from("viagens").select("*");
    const { data: d } = await sb.from("motoristas").select("*");
    const { data: t } = await sb.from("caminhoes").select("*");
    const { data: p } = await sb.from("pranchas").select("*");
    viagens = Array.isArray(v) ? v : [];
    motoristas = Array.isArray(d) ? d : [];
    caminhoes = Array.isArray(t) ? t : [];
    pranchas = Array.isArray(p) ? p : [];
    const dbLocal = getDB();
    custos = Array.isArray(dbLocal.custos) ? dbLocal.custos : [];
  } else {
    const db = getDB();
    viagens = db.viagens;
    motoristas = db.motoristas;
    caminhoes = db.caminhoes;
    pranchas = db.pranchas;
    custos = db.custos;
  }

  // Pending Trips & Truck Status
  const pendingTrips = viagens.filter(t => t.status !== "Finalizado").length;
  const busyTruckIds = new Set(viagens.filter(t => t.status !== "Finalizado" && t.truck_id).map(t => String(t.truck_id)));
  const trucksInTrip = caminhoes.filter(c => busyTruckIds.has(String(c.id))).length;
  const trucksAvailable = caminhoes.length - trucksInTrip;

  // Current Month Stats
  const monthTrips = viagens.filter((t) => t.date >= start && t.date <= end);
  const totalTrips = monthTrips.length;
  const totalKm = monthTrips.reduce((a, t) => a + computeKm(t.km_start, t.km_end), 0);
  const totalHours = monthTrips.reduce((a, t) => a + computeHours(t.date, t.start_time, t.end_time, t.end_date), 0);
  
  const calcCost = (t) => Number(t.fuel_liters || 0) * Number(t.fuel_price || 0) + Number(t.other_costs || 0) + Number(t.maintenance_cost || 0) + Number(t.driver_daily || 0);
  const totalCostsMonth = monthTrips.reduce((a, t) => a + calcCost(t), 0);

  // Previous Month Stats for Trends
  const prevTrips = viagens.filter((t) => t.date >= prevStart && t.date <= prevEnd);
  const prevTotalTrips = prevTrips.length;
  const prevTotalKm = prevTrips.reduce((a, t) => a + computeKm(t.km_start, t.km_end), 0);
  const prevTotalCosts = prevTrips.reduce((a, t) => a + calcCost(t), 0);

  const calcTrend = (curr, prev) => {
    if (prev === 0) return curr > 0 ? 100 : 0;
    return ((curr - prev) / prev) * 100;
  };
  const trends = {
    trips: calcTrend(totalTrips, prevTotalTrips),
    km: calcTrend(totalKm, prevTotalKm),
    costs: calcTrend(totalCostsMonth, prevTotalCosts)
  };

  const driverCounts = {};
  const destinationCounts = {};
  monthTrips.forEach((t) => { driverCounts[t.driver_id] = (driverCounts[t.driver_id] || 0) + 1; if (t.destination) destinationCounts[t.destination] = (destinationCounts[t.destination] || 0) + 1; });
  const topDriverId = Object.keys(driverCounts).sort((a, b) => driverCounts[b] - driverCounts[a])[0] || null;
  const topDriver = topDriverId ? motoristas.find((d) => d.id === Number(topDriverId))?.name || null : null;
  const topDestination = Object.keys(destinationCounts).sort((a, b) => destinationCounts[b] - destinationCounts[a])[0] || null;
  const kmByMonth = [];
  const hoursByMonth = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(year, i, 1);
    const y2 = d.getFullYear();
    const m2 = String(i + 1).padStart(2, "0");
    const s = `${y2}-${m2}-01`;
    const eDate = new Date(y2, i + 1, 0);
    const e = `${y2}-${m2}-${String(eDate.getDate()).padStart(2, "0")}`;
    const rows = viagens.filter((t) => t.date >= s && t.date <= e);
    const km = rows.reduce((a, t) => a + computeKm(t.km_start, t.km_end), 0);
    const hrs = rows.reduce((a, t) => a + computeHours(t.date, t.start_time, t.end_time, t.end_date), 0);
    kmByMonth.push({ month: m2, km });
    hoursByMonth.push({ month: m2, hours: hrs });
  }
  const tripsByDriver = motoristas.map((d) => ({ name: d.name, value: monthTrips.filter((t) => t.driver_id === d.id).length }));
  
  const totalCompleted = monthTrips.filter((t) => t.status === "Finalizado").length;
  const totalDrivers = motoristas.length;
  const totalTrucks = caminhoes.length;
  const totalPranchas = pranchas.length;
  const totalCustos = custos.length;
  
  const categories = ["Máquinas Agrícolas","Máquinas de Construção","Equipamentos Industriais","Veículos Pesados","Veículos Leves"];
  const costsByCategory = categories.map((name) => ({ 
    name, 
    value: monthTrips
      .filter((t) => (t.service_type || "").toLowerCase() === name.toLowerCase())
      .reduce((a, t) => a + calcCost(t), 0) 
  }));
  
  const costsByMonth = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(year, i, 1);
    const y2 = d.getFullYear();
    const m2 = String(i + 1).padStart(2, "0");
    const s = `${y2}-${m2}-01`;
    const eDate = new Date(y2, i + 1, 0);
    const e = `${y2}-${m2}-${String(eDate.getDate()).padStart(2, "0")}`;
    const rows = viagens.filter((t) => t.date >= s && t.date <= e);
    const total = rows.reduce((a, t) => a + calcCost(t), 0);
    costsByMonth.push({ month: m2, total });
  }
  return { totalTrips, totalKm, totalHours, totalCompleted, topDriver, topDestination, kmByMonth, hoursByMonth, tripsByDriver, totalCostsMonth, totalDrivers, totalTrucks, totalPranchas, totalCustos, costsByCategory, costsByMonth, pendingTrips, trucksAvailable, trucksInTrip, trends };
}

export async function exportCsv(filters = {}) {
  const res = await getViagens(filters);
  const rows = res.data;
  const header = ["id","data","motorista_id","caminhao_id","prancha_id","destino","tipo_servico","descricao","hora_saida","hora_retorno","km_inicial","km_final","status","km_rodado","horas_trabalhadas","combustivel_l","valor_combustivel","manutencao","diaria_motorista","outros_custos","custo_total"];
  const lines = rows.map((t) => [t.id,t.date,t.driver_id,t.truck_id ?? "",t.prancha_id ?? "",t.destination || "",t.service_type || "",t.description || "",t.start_time || "",t.end_time || "",t.km_start ?? "",t.km_end ?? "",t.status,t.km_rodado,t.horas,t.fuel_liters ?? 0,t.fuel_price ?? 0,t.maintenance_cost ?? 0,t.driver_daily ?? 0,t.other_costs ?? 0,t.total_cost ?? 0]);
  const csv = [header.join(","), ...lines.map((l) => l.join(","))].join("\n");
  return new Blob([csv], { type: "text/csv" });
}

export async function exportPdf(filters = {}) {
  const res = await getViagens(filters);
  const rows = res.data.slice().sort((a,b)=> (a.date> b.date ? 1 : -1));
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text("Relatório de Viagens", 105, 15, { align: "center" });
  doc.setFontSize(10);
  let y = 25;
  rows.forEach((t) => {
    const line = `Data: ${t.date} | Motorista: ${t.driver_id} | Destino: ${t.destination || ""} | Tipo: ${t.service_type || ""} | Status: ${t.status} | KM: ${t.km_rodado} | Horas: ${t.horas}`;
    doc.text(line, 10, y);
    y += 6;
    if (y > 280) { doc.addPage(); y = 15; }
  });
  return doc.output("blob");
}

export async function backupBlob() { await initLoad(); return new Blob([localStorage.getItem(KEY)], { type: "application/json" }); }

function computeCustoFields(raw) {
  const consumoLitros = Number(raw.consumoLitros || 0);
  const valorLitro = Number(raw.valorLitro || 0);
  const diariaMotorista = Number(raw.diariaMotorista || 0);
  const pedagios = Number(raw.pedagios || 0);
  const manutencao = Number(raw.manutencao || 0);
  const outrosSum = Array.isArray(raw.outrosCustos) ? raw.outrosCustos.reduce((a, it) => a + Number(it.valor || 0), 0) : 0;
  const custoCombustivel = consumoLitros * valorLitro;
  const subtotal = custoCombustivel + diariaMotorista + pedagios + manutencao + outrosSum;
  const kmRodado = Number(raw.kmRodado || 0);
  const custoPorKm = kmRodado > 0 ? subtotal / kmRodado : 0;
  return { custoCombustivel, custoTotal: subtotal, custoPorKm };
}

async function migrateCostsFromTrips(dbInput) {
  const db = dbInput || getDB();
  if (!db) return;
  if (!Array.isArray(db.custos)) db.custos = [];
  if (!Array.isArray(db.viagens)) return;

  const existingByTrip = new Set(db.custos.map((c) => String(c.viagemId)));
  db.viagens.forEach((t) => {
    const hasCosts = Number(t.fuel_liters || 0) || Number(t.other_costs || 0) || Number(t.maintenance_cost || 0) || Number(t.driver_daily || 0);
    if (hasCosts && !existingByTrip.has(String(t.id))) {
      const base = {
        id: uuid(),
        viagemId: String(t.id),
        dataRegistro: new Date().toISOString(),
        registradoPor: "system",
        caminhaoId: t.truck_id != null ? String(t.truck_id) : null,
        pranchaId: t.prancha_id != null ? String(t.prancha_id) : null,
        consumoLitros: Number(t.fuel_liters || 0),
        valorLitro: Number(t.fuel_price || 0),
        kmRodado: Number(computeKm(t.km_start, t.km_end) || 0),
        tempoHoras: Number(computeHours(t.date, t.start_time, t.end_time, t.end_date) || 0),
        diariaMotorista: Number(t.driver_daily || 0),
        pedagios: 0,
        manutencao: Number(t.maintenance_cost || 0),
        outrosCustos: [{ descricao: "Outros", valor: Number(t.other_costs || 0) }],
        moeda: "BRL",
        anexos: [],
        aprovado: false,
        aprovadoPor: null,
        aprovadoEm: null,
        observacoes: null,
        audit: [{ when: new Date().toISOString(), who: "system", what: `Migrado da viagem ${t.id}` }]
      };
      const computed = computeCustoFields(base);
      const row = { ...base, ...computed };
      db.custos.push(row);
    }
  });
  setDB(db);
}

export async function getCustos(opts = {}) {
  await initLoad();
  const { sb } = await import("./supabaseClient.js");
  const { startDate, endDate, caminhaoId, pranchaId, driverId, aprovado, search, minCusto, maxCusto, page = 1, pageSize = 10 } = opts;
  if (sb && isOnline()) {
    let query = sb.from("custos").select("*");
    if (startDate) query = query.gte("dataRegistro", startDate);
    if (endDate) query = query.lte("dataRegistro", endDate);
    if (caminhaoId) query = query.eq("caminhaoId", String(caminhaoId));
    if (pranchaId) query = query.eq("pranchaId", String(pranchaId));
    if (typeof aprovado === "boolean") query = query.eq("aprovado", aprovado);
    const { data: rows0 } = await query;
    let rows = Array.isArray(rows0) ? rows0.slice().reverse() : [];
    if (driverId) {
      const { data: viagens } = await sb.from("viagens").select("id, driver_id");
      const ids = new Set((Array.isArray(viagens) ? viagens : []).filter((v) => String(v.driver_id) === String(driverId)).map((v) => String(v.id)));
      rows = rows.filter((c) => ids.has(String(c.viagemId || "")));
    }
    if (minCusto != null) rows = rows.filter((c) => Number(c.custoTotal || 0) >= Number(minCusto));
    if (maxCusto != null) rows = rows.filter((c) => Number(c.custoTotal || 0) <= Number(maxCusto));
    if (search) {
      const s = String(search).toLowerCase();
      rows = rows.filter((c) => (String(c.observacoes || "").toLowerCase().includes(s)) || (Array.isArray(c.outrosCustos) && c.outrosCustos.some((o) => String(o.descricao || "").toLowerCase().includes(s))));
    }
    const total = rows.length;
    const offset = (Number(page) - 1) * Number(pageSize);
    const data = rows.slice(offset, offset + Number(pageSize));
    return { data, total, page: Number(page), pageSize: Number(pageSize) };
  }
  const db = getDB();
  let rows = db.custos.slice().reverse();
  if (startDate) rows = rows.filter((c) => c.dataRegistro >= startDate);
  if (endDate) rows = rows.filter((c) => c.dataRegistro <= endDate);
  if (caminhaoId) rows = rows.filter((c) => String(c.caminhaoId || "") === String(caminhaoId));
  if (pranchaId) rows = rows.filter((c) => String(c.pranchaId || "") === String(pranchaId));
  if (typeof aprovado === "boolean") rows = rows.filter((c) => c.aprovado === aprovado);
  if (driverId) rows = rows.filter((c) => {
    const t = db.viagens.find((v) => String(v.id) === String(c.viagemId));
    return t && String(t.driver_id) === String(driverId);
  });
  if (minCusto != null) rows = rows.filter((c) => Number(c.custoTotal || 0) >= Number(minCusto));
  if (maxCusto != null) rows = rows.filter((c) => Number(c.custoTotal || 0) <= Number(maxCusto));
  if (search) {
    const s = search.toLowerCase();
    rows = rows.filter((c) => (c.observacoes || "").toLowerCase().includes(s) || (Array.isArray(c.outrosCustos) && c.outrosCustos.some((o) => (o.descricao || "").toLowerCase().includes(s))));
  }
  const total = rows.length;
  const offset = (Number(page) - 1) * Number(pageSize);
  const data = rows.slice(offset, offset + Number(pageSize));
  return { data, total, page: Number(page), pageSize: Number(pageSize) };
}

export async function getCustoById(id) {
  await initLoad();
  const { sb } = await import("./supabaseClient.js");
  if (sb && isOnline()) {
    const { data } = await sb.from("custos").select("*").eq("id", String(id)).single();
    return data || null;
  }
  const db = getDB();
  return db.custos.find((c) => String(c.id) === String(id)) || null;
}

export async function saveCusto(raw) {
  await initLoad();
  const { sb } = await import("./supabaseClient.js");
  const db = getDB();
  const viagem = raw.viagemId ? (sb ? null : db.viagens.find((v) => String(v.id) === String(raw.viagemId))) : null;
  const base = {
    id: uuid(),
    viagemId: raw.viagemId ? String(raw.viagemId) : null,
    dataRegistro: raw.dataRegistro || new Date().toISOString(),
    registradoPor: raw.registradoPor || (JSON.parse(localStorage.getItem("user") || "{}").username || ""),
    caminhaoId: raw.caminhaoId != null ? String(raw.caminhaoId) : (viagem && viagem.truck_id != null ? String(viagem.truck_id) : null),
    pranchaId: raw.pranchaId != null ? String(raw.pranchaId) : (viagem && viagem.prancha_id != null ? String(viagem.prancha_id) : null),
    consumoLitros: Number(raw.consumoLitros || 0),
    valorLitro: Number(raw.valorLitro || 0),
    kmRodado: raw.kmRodado != null ? Number(raw.kmRodado) : (viagem ? Number(computeKm(viagem.km_start, viagem.km_end)) : 0),
    tempoHoras: raw.tempoHoras != null ? Number(raw.tempoHoras) : (viagem ? Number(computeHours(viagem.date, viagem.start_time, viagem.end_time, viagem.end_date)) : 0),
    diariaMotorista: Number(raw.diariaMotorista || 0),
    pedagios: Number(raw.pedagios || 0),
    manutencao: Number(raw.manutencao || 0),
    outrosCustos: Array.isArray(raw.outrosCustos) ? raw.outrosCustos.map((o) => ({ descricao: o.descricao || "", valor: Number(o.valor || 0) })) : [],
    categoria: raw.categoria || "veículos pesados",
    moeda: "BRL",
    anexos: Array.isArray(raw.anexos) ? raw.anexos.map((a) => ({ id: uuid(), nome: a.nome || a.name || "arquivo", path: a.path || null, base64: a.base64 || null, uploadedAt: new Date().toISOString() })) : [],
    aprovado: false,
    aprovadoPor: null,
    aprovadoEm: null,
    observacoes: raw.observacoes || null,
    audit: []
  };
  const computed = computeCustoFields(base);
  const row = { ...base, ...computed };
  row.audit.push({ when: new Date().toISOString(), who: base.registradoPor || "", what: "Custo criado" });
  if (sb && isOnline()) {
    const { data } = await sb.from("custos").insert([row]).select().single();
    return data || row;
  }
  db.custos.push(row);
  setDB(db);
  enqueue({ table: "custos", op: "insert", payload: row, localId: String(row.id) });
  return row;
}

export async function updateCusto(id, patch) {
  await initLoad();
  const { sb } = await import("./supabaseClient.js");
  if (sb && isOnline()) {
    const { data: before } = await sb.from("custos").select("*").eq("id", String(id)).single();
    if (!before) return null;
    const merged = { ...before, ...patch, categoria: patch.categoria || before.categoria || "veículos pesados", outrosCustos: Array.isArray(patch.outrosCustos) ? patch.outrosCustos.map((o) => ({ descricao: o.descricao || "", valor: Number(o.valor || 0) })) : before.outrosCustos };
    const computed = computeCustoFields(merged);
    const after = { ...merged, ...computed };
    const who = JSON.parse(localStorage.getItem("user") || "{}").username || "";
    const changed = Object.keys(patch).join(", ");
    after.audit = [...(before.audit || []), { when: new Date().toISOString(), who, what: `Atualizado: ${changed}` }];
    const { data } = await sb.from("custos").update(after).eq("id", String(id)).select().single();
    return data || after;
  }
  const db = getDB();
  const i = db.custos.findIndex((c) => String(c.id) === String(id));
  if (i < 0) return null;
  const before = db.custos[i];
  const merged = { ...before, ...patch, categoria: patch.categoria || before.categoria || "veículos pesados", outrosCustos: Array.isArray(patch.outrosCustos) ? patch.outrosCustos.map((o) => ({ descricao: o.descricao || "", valor: Number(o.valor || 0) })) : before.outrosCustos };
  const computed = computeCustoFields(merged);
  const after = { ...merged, ...computed };
  const who = JSON.parse(localStorage.getItem("user") || "{}").username || "";
  const changed = Object.keys(patch).join(", ");
  after.audit = [...(before.audit || []), { when: new Date().toISOString(), who, what: `Atualizado: ${changed}` }];
  db.custos[i] = after;
  setDB(db);
  enqueue({ table: "custos", op: "update", payload: after, localId: String(id) });
  return after;
}

export async function deleteCusto(id) { await initLoad(); const { supabase: sb } = await import("./supabaseClient.js"); if (sb && isOnline()) { await sb.from("custos").delete().eq("id", String(id)); return { ok: true }; } const db = getDB(); db.custos = db.custos.filter((c) => String(c.id) !== String(id)); setDB(db); enqueue({ table: "custos", op: "delete", localId: String(id) }); return { ok: true }; }

export async function attachFileToCusto(id, fileMeta, fileContentBase64) {
  await initLoad();
  const { sb } = await import("./supabaseClient.js");
  if (sb && isOnline()) {
    const { data: before } = await sb.from("custos").select("*").eq("id", String(id)).single();
    if (!before) return null;
    const att = { id: uuid(), nome: fileMeta?.nome || fileMeta?.name || "arquivo", path: fileMeta?.path || null, base64: fileContentBase64 || null, uploadedAt: new Date().toISOString() };
    const who = JSON.parse(localStorage.getItem("user") || "{}").username || "";
    const item = { ...before, anexos: [...(before.anexos || []), att], audit: [...(before.audit || []), { when: new Date().toISOString(), who, what: `Anexo adicionado: ${att.nome}` }] };
    await sb.from("custos").update(item).eq("id", String(id));
    return att;
  }
  const db = getDB();
  const i = db.custos.findIndex((c) => String(c.id) === String(id));
  if (i < 0) return null;
  const item = db.custos[i];
  const att = { id: uuid(), nome: fileMeta?.nome || fileMeta?.name || "arquivo", path: fileMeta?.path || null, base64: fileContentBase64 || null, uploadedAt: new Date().toISOString() };
  item.anexos = [...(item.anexos || []), att];
  const who = JSON.parse(localStorage.getItem("user") || "{}").username || "";
  item.audit = [...(item.audit || []), { when: new Date().toISOString(), who, what: `Anexo adicionado: ${att.nome}` }];
  db.custos[i] = item;
  setDB(db);
  enqueue({ table: "custos", op: "update", payload: item, localId: String(id) });
  return att;
}

export async function approveCusto(id, usuario) {
  await initLoad();
  const { supabase: sb } = await import("./supabaseClient.js");
  const user = usuario || JSON.parse(localStorage.getItem("user") || "{}");
  if ((user.role || "user") !== "admin") throw new Error("Acesso negado");
  if (sb && isOnline()) {
    const { data: before } = await sb.from("custos").select("*").eq("id", String(id)).single();
    if (!before) return null;
    const item = { ...before, aprovado: true, aprovadoPor: user.username || "", aprovadoEm: new Date().toISOString(), audit: [...(before.audit || []), { when: new Date().toISOString(), who: user.username || "", what: "Custo aprovado" }] };
    const { data } = await sb.from("custos").update(item).eq("id", String(id)).select().single();
    return data || item;
  }
  const db = getDB();
  const i = db.custos.findIndex((c) => String(c.id) === String(id));
  if (i < 0) return null;
  const item = db.custos[i];
  item.aprovado = true;
  item.aprovadoPor = user.username || "";
  item.aprovadoEm = new Date().toISOString();
  item.audit = [...(item.audit || []), { when: item.aprovadoEm, who: item.aprovadoPor, what: "Custo aprovado" }];
  db.custos[i] = item;
  setDB(db);
  enqueue({ table: "custos", op: "update", payload: item, localId: String(id) });
  return item;
}

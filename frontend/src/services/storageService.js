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

const getDB = () => JSON.parse(localStorage.getItem(KEY) || "null");
const setDB = (db) => localStorage.setItem(KEY, JSON.stringify(db));

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
    await migrateCostsFromTrips();
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
  await migrateCostsFromTrips();
  return db;
}

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

export async function login(username, password) {
  await initLoad();
  const db = getDB();
  const u = db.usuarios.find((x) => x.username === username);
  if (!u) throw new Error("Credenciais inválidas");
  const p = base64(password);
  if (u.password_base64 !== p) throw new Error("Credenciais inválidas");
  localStorage.setItem("token", "local-token");
  localStorage.setItem("user", JSON.stringify({ id: u.id, username: u.username, role: u.role || "user" }));
  return { token: "local-token", user: { id: u.id, username: u.username, role: u.role || "user" } };
}
export async function registerUser(username, password, role = "user") {
  await initLoad();
  const db = getDB();
  if (db.usuarios.find((x) => x.username === username)) throw new Error("Usuário já existe");
  const id = db.usuarios.reduce((m, u) => Math.max(m, u.id || 0), 0) + 1;
  const password_base64 = base64(password);
  db.usuarios.push({ id, username, password_base64, role });
  setDB(db);
  return { id, username, role };
}

export async function getMotoristas() { await initLoad(); return getDB().motoristas.slice().reverse(); }
export async function saveMotorista(data) { await initLoad(); const db = getDB(); const id = db.seq.motoristas++; const row = { id, name: data.name, cpf: data.cpf || null, cnh_category: data.cnh_category || null, status: data.status || "Ativo" }; db.motoristas.push(row); setDB(db); return row; }
export async function updateMotorista(id, data) { await initLoad(); const db = getDB(); const i = db.motoristas.findIndex((d) => d.id === id); if (i>=0) db.motoristas[i] = { id, name: data.name, cpf: data.cpf || null, cnh_category: data.cnh_category || null, status: data.status || "Ativo" }; setDB(db); return db.motoristas[i]; }
export async function deleteMotorista(id) { await initLoad(); const db = getDB(); db.motoristas = db.motoristas.filter((d) => d.id !== id); setDB(db); return { ok: true }; }

export async function getViagens(opts = {}) {
  await initLoad();
  const db = getDB();
  const { startDate, endDate, driverId, destination, status, search, truckId, pranchaId, vehicleType, plate, page = 1, pageSize = 10 } = opts;
  let rows = db.viagens.slice().reverse();
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
  rows = rows.map((t) => ({ ...t, km_rodado: computeKm(t.km_start, t.km_end), horas: computeHours(t.date, t.start_time, t.end_time), total_cost: Number(t.fuel_liters || 0) * Number(t.fuel_price || 0) + Number(t.other_costs || 0) + Number(t.maintenance_cost || 0) + Number(t.driver_daily || 0) }));
  const total = rows.length;
  const offset = (Number(page) - 1) * Number(pageSize);
  const data = rows.slice(offset, offset + Number(pageSize));
  return { data, total, page: Number(page), pageSize: Number(pageSize) };
}
export async function getViagem(id) { await initLoad(); const db = getDB(); const t = db.viagens.find((x) => x.id === Number(id)); if (!t) return null; return { ...t, km_rodado: computeKm(t.km_start, t.km_end), horas: computeHours(t.date, t.start_time, t.end_time) }; }
export async function saveViagem(data) { await initLoad(); const db = getDB(); const id = db.seq.viagens++; const status = computeStatus(data.end_time, data.km_end); const t = { id, date: data.date, driver_id: Number(data.driver_id), truck_id: data.truck_id != null ? Number(data.truck_id) : null, prancha_id: data.prancha_id != null ? Number(data.prancha_id) : null, destination: data.destination || null, service_type: data.service_type || null, description: data.description || null, start_time: data.start_time || null, end_time: data.end_time || null, km_start: data.km_start != null ? Number(data.km_start) : null, km_end: data.km_end != null ? Number(data.km_end) : null, fuel_liters: data.fuel_liters != null ? Number(data.fuel_liters) : 0, fuel_price: data.fuel_price != null ? Number(data.fuel_price) : 0, other_costs: data.other_costs != null ? Number(data.other_costs) : 0, maintenance_cost: data.maintenance_cost != null ? Number(data.maintenance_cost) : 0, driver_daily: data.driver_daily != null ? Number(data.driver_daily) : 0, requester: data.requester || null, status }; db.viagens.push(t); if (t.truck_id != null && t.km_end != null) { const ti = db.caminhoes.findIndex((d) => d.id === Number(t.truck_id)); if (ti>=0) db.caminhoes[ti] = { ...db.caminhoes[ti], km_current: Number(t.km_end) }; } setDB(db); return { ...t, km_rodado: computeKm(t.km_start, t.km_end), horas: computeHours(t.date, t.start_time, t.end_time), total_cost: Number(t.fuel_liters || 0) * Number(t.fuel_price || 0) + Number(t.other_costs || 0) + Number(t.maintenance_cost || 0) + Number(t.driver_daily || 0) }; }
export async function updateViagem(id, data) { await initLoad(); const db = getDB(); const i = db.viagens.findIndex((t) => t.id === Number(id)); const status = computeStatus(data.end_time, data.km_end); if (i>=0) db.viagens[i] = { id: Number(id), date: data.date, driver_id: Number(data.driver_id), truck_id: data.truck_id != null ? Number(data.truck_id) : null, prancha_id: data.prancha_id != null ? Number(data.prancha_id) : null, destination: data.destination || null, service_type: data.service_type || null, description: data.description || null, start_time: data.start_time || null, end_time: data.end_time || null, km_start: data.km_start != null ? Number(data.km_start) : null, km_end: data.km_end != null ? Number(data.km_end) : null, fuel_liters: data.fuel_liters != null ? Number(data.fuel_liters) : 0, fuel_price: data.fuel_price != null ? Number(data.fuel_price) : 0, other_costs: data.other_costs != null ? Number(data.other_costs) : 0, maintenance_cost: data.maintenance_cost != null ? Number(data.maintenance_cost) : 0, driver_daily: data.driver_daily != null ? Number(data.driver_daily) : 0, requester: data.requester || null, status }; const t = db.viagens[i]; if (t.truck_id != null && t.km_end != null) { const ti = db.caminhoes.findIndex((d) => d.id === Number(t.truck_id)); if (ti>=0) db.caminhoes[ti] = { ...db.caminhoes[ti], km_current: Number(t.km_end) }; } setDB(db); return { ...t, km_rodado: computeKm(t.km_start, t.km_end), horas: computeHours(t.date, t.start_time, t.end_time), total_cost: Number(t.fuel_liters || 0) * Number(t.fuel_price || 0) + Number(t.other_costs || 0) + Number(t.maintenance_cost || 0) + Number(t.driver_daily || 0) }; }
export async function deleteViagem(id) { await initLoad(); const db = getDB(); db.viagens = db.viagens.filter((t) => t.id !== Number(id)); setDB(db); return { ok: true }; }

export async function getDestinos() { await initLoad(); return getDB().destinos; }
export async function saveDestino(name) { await initLoad(); const db = getDB(); const id = db.seq.destinos++; const row = { id, name }; db.destinos.push(row); setDB(db); return row; }
export async function deleteDestino(id) { await initLoad(); const db = getDB(); db.destinos = db.destinos.filter((d) => d.id !== Number(id)); setDB(db); return { ok: true }; }

export async function getTiposServico() { await initLoad(); return getDB().tipos_servico; }
export async function saveTipoServico(name) { await initLoad(); const db = getDB(); const id = db.seq.tipos++; const row = { id, name }; db.tipos_servico.push(row); setDB(db); return row; }
export async function deleteTipoServico(id) { await initLoad(); const db = getDB(); db.tipos_servico = db.tipos_servico.filter((d) => d.id !== Number(id)); setDB(db); return { ok: true }; }

export async function getTruck() { await initLoad(); return getDB().config.truck || {}; }
export async function updateTruck(data) { await initLoad(); const db = getDB(); db.config.truck = { plate: data.plate || null, model: data.model || null, year: data.year != null ? Number(data.year) : null }; setDB(db); return db.config.truck; }

export async function getCaminhoes() { await initLoad(); return getDB().caminhoes.slice().reverse(); }
export async function saveCaminhao(data) { await initLoad(); const db = getDB(); const id = db.seq.caminhoes++; const row = { id, plate: data.plate || null, model: data.model || null, year: data.year != null ? Number(data.year) : null, chassis: data.chassis || null, km_current: data.km_current != null ? Number(data.km_current) : null, fleet: data.fleet || null, status: data.status || "Ativo" }; db.caminhoes.push(row); setDB(db); return row; }
export async function updateCaminhao(id, data) { await initLoad(); const db = getDB(); const i = db.caminhoes.findIndex((d) => d.id === Number(id)); if (i>=0) db.caminhoes[i] = { id: Number(id), plate: data.plate || null, model: data.model || null, year: data.year != null ? Number(data.year) : null, chassis: data.chassis || null, km_current: data.km_current != null ? Number(data.km_current) : null, fleet: data.fleet || null, status: data.status || "Ativo" }; setDB(db); return db.caminhoes[i]; }
export async function deleteCaminhao(id) { await initLoad(); const db = getDB(); db.caminhoes = db.caminhoes.filter((d) => d.id !== Number(id)); setDB(db); return { ok: true }; }

export async function getPranchas() { await initLoad(); return getDB().pranchas.slice().reverse(); }
export async function savePrancha(data) { await initLoad(); const db = getDB(); const id = db.seq.pranchas++; const row = { id, asset_number: data.asset_number || null, type: data.type || null, capacity: data.capacity != null ? Number(data.capacity) : null, year: data.year != null ? Number(data.year) : null, status: data.status || "Ativo" }; db.pranchas.push(row); setDB(db); return row; }
export async function updatePrancha(id, data) { await initLoad(); const db = getDB(); const i = db.pranchas.findIndex((d) => d.id === Number(id)); if (i>=0) db.pranchas[i] = { id: Number(id), asset_number: data.asset_number || null, type: data.type || null, capacity: data.capacity != null ? Number(data.capacity) : null, year: data.year != null ? Number(data.year) : null, status: data.status || "Ativo" }; setDB(db); return db.pranchas[i]; }
export async function deletePrancha(id) { await initLoad(); const db = getDB(); db.pranchas = db.pranchas.filter((d) => d.id !== Number(id)); setDB(db); return { ok: true }; }

export async function getViagemByCaminhao(id, opts = {}) { return getViagens({ ...opts, truckId: id }); }
export async function getViagemByPrancha(id, opts = {}) { return getViagens({ ...opts, pranchaId: id }); }

export async function dashboard() {
  await initLoad();
  const db = getDB();
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const start = `${y}-${m}-01`;
  const endDate = new Date(y, now.getMonth() + 1, 0);
  const end = `${y}-${String(endDate.getDate()).padStart(2, "0")}`;
  const monthTrips = db.viagens.filter((t) => t.date >= start && t.date <= end);
  const totalTrips = monthTrips.length;
  const totalKm = monthTrips.reduce((a, t) => a + computeKm(t.km_start, t.km_end), 0);
  const totalHours = monthTrips.reduce((a, t) => a + computeHours(t.date, t.start_time, t.end_time), 0);
  const driverCounts = {};
  const destinationCounts = {};
  monthTrips.forEach((t) => { driverCounts[t.driver_id] = (driverCounts[t.driver_id] || 0) + 1; if (t.destination) destinationCounts[t.destination] = (destinationCounts[t.destination] || 0) + 1; });
  const topDriverId = Object.keys(driverCounts).sort((a, b) => driverCounts[b] - driverCounts[a])[0] || null;
  const topDriver = topDriverId ? db.motoristas.find((d) => d.id === Number(topDriverId))?.name || null : null;
  const topDestination = Object.keys(destinationCounts).sort((a, b) => destinationCounts[b] - destinationCounts[a])[0] || null;
  const kmByMonth = [];
  const hoursByMonth = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(y, i, 1);
    const y2 = d.getFullYear();
    const m2 = String(i + 1).padStart(2, "0");
    const s = `${y2}-${m2}-01`;
    const eDate = new Date(y2, i + 1, 0);
    const e = `${y2}-${String(eDate.getDate()).padStart(2, "0")}`;
    const rows = db.viagens.filter((t) => t.date >= s && t.date <= e);
    const km = rows.reduce((a, t) => a + computeKm(t.km_start, t.km_end), 0);
    const hrs = rows.reduce((a, t) => a + computeHours(t.date, t.start_time, t.end_time), 0);
    kmByMonth.push({ month: m2, km });
    hoursByMonth.push({ month: m2, hours: hrs });
  }
  const tripsByDriver = db.motoristas.map((d) => ({ name: d.name, value: db.viagens.filter((t) => t.driver_id === d.id).length }));
  const monthCosts = db.custos.filter((c) => (c.dataRegistro || "").slice(0,10) >= start && (c.dataRegistro || "").slice(0,10) <= end);
  const totalCostsMonth = monthCosts.reduce((a, c) => a + Number(c.custoTotal || 0), 0);
  const totalDrivers = db.motoristas.length;
  const totalTrucks = db.caminhoes.length;
  const totalPranchas = db.pranchas.length;
  const totalCustos = db.custos.length;
  const costsByCategory = ["máquinas agrícolas","máquinas de construção","equipamentos industriais","veículos pesados","veículos leves"].map((name) => ({ name, value: db.custos.filter((c) => (c.categoria || "veículos pesados") === name).reduce((a, c) => a + Number(c.custoTotal || 0), 0) }));
  const costsByMonth = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(y, i, 1);
    const y2 = d.getFullYear();
    const m2 = String(i + 1).padStart(2, "0");
    const s = `${y2}-${m2}-01`;
    const eDate = new Date(y2, i + 1, 0);
    const e = `${y2}-${String(eDate.getDate()).padStart(2, "0")}`;
    const rows = db.custos.filter((c) => (c.dataRegistro || "").slice(0,10) >= s && (c.dataRegistro || "").slice(0,10) <= e);
    const total = rows.reduce((a, c) => a + Number(c.custoTotal || 0), 0);
    costsByMonth.push({ month: m2, total });
  }
  return { totalTrips, totalKm, totalHours, topDriver, topDestination, kmByMonth, hoursByMonth, tripsByDriver, totalCostsMonth, totalDrivers, totalTrucks, totalPranchas, totalCustos, costsByCategory, costsByMonth };
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

async function githubGetFileSha(token, owner, repo, path, branch) {
  try {
    const r = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`, { headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" } });
    if (r.status === 404) return null;
    if (!r.ok) return null;
    const j = await r.json();
    return j.sha || null;
  } catch { return null; }
}

async function githubPutFile(token, owner, repo, path, branch, contentStr, sha, message) {
  try {
    const body = { message, content: base64utf8(contentStr), branch, sha: sha || undefined };
    const r = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, { method: "PUT", headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

export async function commitAllData(token, repo, branch = "main") {
  await initLoad();
  const db = getDB();
  const [owner, reponame] = String(repo).split("/");
  const prefix = "frontend/public/";
  const entries = [
    { path: prefix + files.motoristas, content: db.motoristas },
    { path: prefix + files.viagens, content: db.viagens },
    { path: prefix + files.destinos, content: db.destinos },
    { path: prefix + files.tipos, content: db.tipos_servico },
    { path: prefix + files.usuarios, content: db.usuarios },
    { path: prefix + files.config, content: db.config },
    { path: prefix + files.caminhoes, content: db.caminhoes },
    { path: prefix + files.pranchas, content: db.pranchas },
    { path: prefix + files.custos, content: db.custos }
  ];
  const results = [];
  for (const e of entries) {
    const json = JSON.stringify(e.content ?? (Array.isArray(e.content) ? [] : {}), null, 2);
    const sha = await githubGetFileSha(token, owner, reponame, e.path, branch);
    const res = await githubPutFile(token, owner, reponame, e.path, branch, json, sha, `update ${e.path}`);
    results.push({ path: e.path, ok: !!(res && res.content && res.content.sha) });
  }
  const ok = results.every((x) => x.ok);
  return { ok, results };
}

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

async function migrateCostsFromTrips() {
  const db = getDB();
  if (!Array.isArray(db.custos)) db.custos = [];
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
        tempoHoras: Number(computeHours(t.date, t.start_time, t.end_time) || 0),
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
  const db = getDB();
  const { startDate, endDate, caminhaoId, pranchaId, driverId, aprovado, search, minCusto, maxCusto, page = 1, pageSize = 10 } = opts;
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

export async function getCustoById(id) { await initLoad(); const db = getDB(); return db.custos.find((c) => String(c.id) === String(id)) || null; }

export async function saveCusto(raw) {
  await initLoad();
  const db = getDB();
  const viagem = raw.viagemId ? db.viagens.find((v) => String(v.id) === String(raw.viagemId)) : null;
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
    tempoHoras: raw.tempoHoras != null ? Number(raw.tempoHoras) : (viagem ? Number(computeHours(viagem.date, viagem.start_time, viagem.end_time)) : 0),
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
  db.custos.push(row);
  setDB(db);
  return row;
}

export async function updateCusto(id, patch) {
  await initLoad();
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
  return after;
}

export async function deleteCusto(id) { await initLoad(); const db = getDB(); db.custos = db.custos.filter((c) => String(c.id) !== String(id)); setDB(db); return { ok: true }; }

export async function attachFileToCusto(id, fileMeta, fileContentBase64) {
  await initLoad();
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
  return att;
}

export async function approveCusto(id, usuario) {
  await initLoad();
  const db = getDB();
  const i = db.custos.findIndex((c) => String(c.id) === String(id));
  if (i < 0) return null;
  const user = usuario || JSON.parse(localStorage.getItem("user") || "{}");
  if ((user.role || "user") !== "admin") throw new Error("Acesso negado");
  const item = db.custos[i];
  item.aprovado = true;
  item.aprovadoPor = user.username || "";
  item.aprovadoEm = new Date().toISOString();
  item.audit = [...(item.audit || []), { when: item.aprovadoEm, who: item.aprovadoPor, what: "Custo aprovado" }];
  db.custos[i] = item;
  setDB(db);
  return item;
}

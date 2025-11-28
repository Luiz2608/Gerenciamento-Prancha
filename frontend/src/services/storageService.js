const KEY = "prancha_json_db";

const files = {
  motoristas: "data/motoristas.json",
  viagens: "data/viagens.json",
  destinos: "data/destinos.json",
  tipos: "data/tipos_servico.json",
  usuarios: "data/usuarios.json",
  config: "data/config.json",
  caminhoes: "data/caminhoes.json",
  pranchas: "data/pranchas.json"
};

const base64 = (s) => typeof btoa !== "undefined" ? btoa(s) : Buffer.from(s).toString("base64");

const getDB = () => JSON.parse(localStorage.getItem(KEY) || "null");
const setDB = (db) => localStorage.setItem(KEY, JSON.stringify(db));

async function fetchJson(path) { const r = await fetch(path); return r.json(); }

export async function initLoad() {
  if (getDB()) return getDB();
  const [motoristas, viagens, destinos, tipos, usuarios, config, caminhoes, pranchas] = await Promise.all([
    fetchJson(files.motoristas),
    fetchJson(files.viagens),
    fetchJson(files.destinos),
    fetchJson(files.tipos),
    fetchJson(files.usuarios),
    fetchJson(files.config),
    fetchJson(files.caminhoes),
    fetchJson(files.pranchas)
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
  return db;
}

const computeKm = (a, b) => (a == null || b == null ? 0 : Math.max(0, Number(b) - Number(a)));
const computeHours = (date, s, e) => { if (!date || !s || !e) return 0; const start = new Date(`${date}T${s}:00`); const end = new Date(`${date}T${e}:00`); const diff = Math.max(0, end - start); return Math.round((diff / 3600000) * 100) / 100; };
const computeStatus = (end_time, km_end) => (!end_time || end_time === "" || km_end == null || km_end === "" ? "Em andamento" : "Finalizada");

export async function login(username, password) {
  await initLoad();
  const db = getDB();
  const u = db.usuarios.find((x) => x.username === username);
  if (!u) throw new Error("Credenciais inválidas");
  const p = base64(password);
  if (u.password_base64 !== p) throw new Error("Credenciais inválidas");
  localStorage.setItem("token", "local-token");
  return { token: "local-token" };
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
export async function saveViagem(data) { await initLoad(); const db = getDB(); const id = db.seq.viagens++; const status = computeStatus(data.end_time, data.km_end); const t = { id, date: data.date, driver_id: Number(data.driver_id), truck_id: data.truck_id != null ? Number(data.truck_id) : null, prancha_id: data.prancha_id != null ? Number(data.prancha_id) : null, destination: data.destination || null, service_type: data.service_type || null, description: data.description || null, start_time: data.start_time || null, end_time: data.end_time || null, km_start: data.km_start != null ? Number(data.km_start) : null, km_end: data.km_end != null ? Number(data.km_end) : null, fuel_liters: data.fuel_liters != null ? Number(data.fuel_liters) : 0, fuel_price: data.fuel_price != null ? Number(data.fuel_price) : 0, other_costs: data.other_costs != null ? Number(data.other_costs) : 0, maintenance_cost: data.maintenance_cost != null ? Number(data.maintenance_cost) : 0, driver_daily: data.driver_daily != null ? Number(data.driver_daily) : 0, status }; db.viagens.push(t); setDB(db); return { ...t, km_rodado: computeKm(t.km_start, t.km_end), horas: computeHours(t.date, t.start_time, t.end_time), total_cost: Number(t.fuel_liters || 0) * Number(t.fuel_price || 0) + Number(t.other_costs || 0) + Number(t.maintenance_cost || 0) + Number(t.driver_daily || 0) }; }
export async function updateViagem(id, data) { await initLoad(); const db = getDB(); const i = db.viagens.findIndex((t) => t.id === Number(id)); const status = computeStatus(data.end_time, data.km_end); if (i>=0) db.viagens[i] = { id: Number(id), date: data.date, driver_id: Number(data.driver_id), truck_id: data.truck_id != null ? Number(data.truck_id) : null, prancha_id: data.prancha_id != null ? Number(data.prancha_id) : null, destination: data.destination || null, service_type: data.service_type || null, description: data.description || null, start_time: data.start_time || null, end_time: data.end_time || null, km_start: data.km_start != null ? Number(data.km_start) : null, km_end: data.km_end != null ? Number(data.km_end) : null, fuel_liters: data.fuel_liters != null ? Number(data.fuel_liters) : 0, fuel_price: data.fuel_price != null ? Number(data.fuel_price) : 0, other_costs: data.other_costs != null ? Number(data.other_costs) : 0, maintenance_cost: data.maintenance_cost != null ? Number(data.maintenance_cost) : 0, driver_daily: data.driver_daily != null ? Number(data.driver_daily) : 0, status }; setDB(db); const t = db.viagens[i]; return { ...t, km_rodado: computeKm(t.km_start, t.km_end), horas: computeHours(t.date, t.start_time, t.end_time), total_cost: Number(t.fuel_liters || 0) * Number(t.fuel_price || 0) + Number(t.other_costs || 0) + Number(t.maintenance_cost || 0) + Number(t.driver_daily || 0) }; }
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
export async function saveCaminhao(data) { await initLoad(); const db = getDB(); const id = db.seq.caminhoes++; const row = { id, plate: data.plate || null, model: data.model || null, year: data.year != null ? Number(data.year) : null, chassis: data.chassis || null, km_current: data.km_current != null ? Number(data.km_current) : null, status: data.status || "Ativo" }; db.caminhoes.push(row); setDB(db); return row; }
export async function updateCaminhao(id, data) { await initLoad(); const db = getDB(); const i = db.caminhoes.findIndex((d) => d.id === Number(id)); if (i>=0) db.caminhoes[i] = { id: Number(id), plate: data.plate || null, model: data.model || null, year: data.year != null ? Number(data.year) : null, chassis: data.chassis || null, km_current: data.km_current != null ? Number(data.km_current) : null, status: data.status || "Ativo" }; setDB(db); return db.caminhoes[i]; }
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
  return { totalTrips, totalKm, totalHours, topDriver, topDestination, kmByMonth, hoursByMonth, tripsByDriver };
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

import { jsPDF } from "jspdf";

const key = "prancha_local_db";

const init = () => {
  const db = JSON.parse(localStorage.getItem(key) || "null") || {
    users: [{ id: 1, username: "admin", password: "admin123", role: "admin" }],
    drivers: [],
    trips: [],
    destinations: [],
    service_types: [],
    truck: { id: 1, plate: null, model: null, year: null },
    seq: { drivers: 1, trips: 1, destinations: 1, service_types: 1 }
  };
  localStorage.setItem(key, JSON.stringify(db));
  return db;
};

const load = () => JSON.parse(localStorage.getItem(key));
const save = (db) => localStorage.setItem(key, JSON.stringify(db));

const ok = (data) => Promise.resolve({ data });
const computeKm = (a, b) => (a == null || b == null ? 0 : Math.max(0, Number(b) - Number(a)));
const computeHours = (date, s, e) => {
  if (!date || !s || !e) return 0;
  const start = new Date(`${date}T${s}:00`);
  const end = new Date(`${date}T${e}:00`);
  const diff = Math.max(0, end - start);
  return Math.round((diff / 3600000) * 100) / 100;
};
const computeStatus = (end_time, km_end) => (!end_time || end_time === "" || km_end == null || km_end === "" ? "Em andamento" : "Finalizada");

init();

const parse = (url) => {
  const [path, qs] = url.split("?");
  const parts = path.split("/").filter(Boolean);
  const params = Object.fromEntries(new URLSearchParams(qs || ""));
  return { parts, params };
};

const api = {
  get: (url, { params: q } = {}) => {
    const db = load();
    const { parts, params } = parse(url);
    const qp = { ...(q || {}), ...(params || {}) };
    if (parts[0] === "dashboard") {
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, "0");
      const start = `${y}-${m}-01`;
      const endDate = new Date(y, now.getMonth() + 1, 0);
      const end = `${y}-${String(endDate.getDate()).padStart(2, "0")}`;
      const monthTrips = db.trips.filter((t) => t.date >= start && t.date <= end);
      const totalTrips = monthTrips.length;
      const totalKm = monthTrips.reduce((a, t) => a + computeKm(t.km_start, t.km_end), 0);
      const totalHours = monthTrips.reduce((a, t) => a + computeHours(t.date, t.start_time, t.end_time), 0);
      const driverCounts = {};
      const destinationCounts = {};
      monthTrips.forEach((t) => {
        driverCounts[t.driver_id] = (driverCounts[t.driver_id] || 0) + 1;
        if (t.destination) destinationCounts[t.destination] = (destinationCounts[t.destination] || 0) + 1;
      });
      const topDriverId = Object.keys(driverCounts).sort((a, b) => driverCounts[b] - driverCounts[a])[0] || null;
      const topDriver = topDriverId ? db.drivers.find((d) => d.id === Number(topDriverId))?.name || null : null;
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
        const rows = db.trips.filter((t) => t.date >= s && t.date <= e);
        const km = rows.reduce((a, t) => a + computeKm(t.km_start, t.km_end), 0);
        const hrs = rows.reduce((a, t) => a + computeHours(t.date, t.start_time, t.end_time), 0);
        kmByMonth.push({ month: m2, km });
        hoursByMonth.push({ month: m2, hours: hrs });
      }
      const tripsByDriver = Object.values(db.drivers).map((d) => ({ name: d.name, value: db.trips.filter((t) => t.driver_id === d.id).length }));
      return ok({ totalTrips, totalKm, totalHours, topDriver, topDestination, kmByMonth, hoursByMonth, tripsByDriver });
    }
    if (parts[0] === "drivers") {
      if (parts.length === 1) return ok(db.drivers.slice().reverse());
      const id = Number(parts[1]);
      const row = db.drivers.find((d) => d.id === id);
      return row ? ok(row) : ok({});
    }
    if (parts[0] === "trips") {
      if (parts.length === 2) {
        const id = Number(parts[1]);
        const t = db.trips.find((x) => x.id === id);
        if (!t) return ok({});
        return ok({ ...t, km_rodado: computeKm(t.km_start, t.km_end), horas: computeHours(t.date, t.start_time, t.end_time) });
      }
      const { startDate, endDate, driverId, destination, status, search } = qp;
      let rows = db.trips.slice().reverse();
      if (startDate) rows = rows.filter((t) => t.date >= startDate);
      if (endDate) rows = rows.filter((t) => t.date <= endDate);
      if (driverId) rows = rows.filter((t) => t.driver_id === Number(driverId));
      if (destination) rows = rows.filter((t) => (t.destination || "").toLowerCase().includes(destination.toLowerCase()));
      if (status) rows = rows.filter((t) => t.status === status);
      if (search) rows = rows.filter((t) => (t.description || "").toLowerCase().includes(search.toLowerCase()) || (t.service_type || "").toLowerCase().includes(search.toLowerCase()));
      rows = rows.map((t) => ({ ...t, km_rodado: computeKm(t.km_start, t.km_end), horas: computeHours(t.date, t.start_time, t.end_time) }));
      const page = Number(qp.page || 1);
      const pageSize = Number(qp.pageSize || 10);
      const total = rows.length;
      const offset = (page - 1) * pageSize;
      const data = rows.slice(offset, offset + pageSize);
      return ok({ data, total, page, pageSize });
    }
    if (parts[0] === "admin") {
      if (parts[1] === "destinations") return ok(db.destinations);
      if (parts[1] === "service-types") return ok(db.service_types);
      if (parts[1] === "truck") return ok(db.truck);
      if (parts[1] === "backup") return ok(new Blob([JSON.stringify(db)], { type: "application/json" }));
    }
    if (parts[0] === "export" && parts[1] === "csv") {
      const rows = db.trips.slice().reverse();
      const header = ["id","data","motorista_id","destino","tipo_servico","descricao","hora_saida","hora_retorno","km_inicial","km_final","status","km_rodado","horas_trabalhadas"];
      const lines = rows.map((t) => [t.id,t.date,t.driver_id,t.destination || "",t.service_type || "",t.description || "",t.start_time || "",t.end_time || "",t.km_start ?? "",t.km_end ?? "",t.status,computeKm(t.km_start, t.km_end),computeHours(t.date, t.start_time, t.end_time)]);
      const csv = [header.join(","), ...lines.map((l) => l.join(","))].join("\n");
      return ok(new Blob([csv], { type: "text/csv" }));
    }
    if (parts[0] === "export" && parts[1] === "pdf") {
      const rows = db.trips.slice().sort((a,b)=> (a.date> b.date ? 1 : -1));
      const doc = new jsPDF();
      doc.setFontSize(16);
      doc.text("Relatório de Viagens", 105, 15, { align: "center" });
      doc.setFontSize(10);
      let y = 25;
      rows.forEach((t) => {
        const km = computeKm(t.km_start, t.km_end);
        const h = computeHours(t.date, t.start_time, t.end_time);
        const driver = db.drivers.find((d) => d.id === t.driver_id)?.name || t.driver_id;
        const line = `Data: ${t.date} | Motorista: ${driver} | Destino: ${t.destination || ""} | Tipo: ${t.service_type || ""} | Status: ${t.status} | KM: ${km} | Horas: ${h}`;
        doc.text(line, 10, y);
        y += 6;
        if (y > 280) { doc.addPage(); y = 15; }
      });
      return ok(doc.output("blob"));
    }
    return ok({});
  },
  post: (url, data) => {
    const db = load();
    const { parts } = parse(url);
    if (parts[0] === "auth" && parts[1] === "login") {
      const user = db.users.find((u) => u.username === data.username && u.password === data.password);
      if (!user) return Promise.reject({ response: { data: { error: "Invalid credentials" } } });
      return ok({ token: "local-token" });
    }
    if (parts[0] === "drivers") {
      const id = db.seq.drivers++;
      const row = { id, name: data.name, cpf: data.cpf || null, cnh_category: data.cnh_category || null, status: data.status || "Ativo" };
      db.drivers.push(row);
      save(db);
      return ok(row);
    }
    if (parts[0] === "trips") {
      const id = db.seq.trips++;
      const status = computeStatus(data.end_time, data.km_end);
      const t = { id, date: data.date, driver_id: Number(data.driver_id), destination: data.destination || null, service_type: data.service_type || null, description: data.description || null, start_time: data.start_time || null, end_time: data.end_time || null, km_start: data.km_start != null ? Number(data.km_start) : null, km_end: data.km_end != null ? Number(data.km_end) : null, status };
      db.trips.push(t);
      save(db);
      return ok({ ...t, km_rodado: computeKm(t.km_start, t.km_end), horas: computeHours(t.date, t.start_time, t.end_time) });
    }
    if (parts[0] === "admin" && parts[1] === "destinations") {
      const id = db.seq.destinations++;
      const row = { id, name: data.name };
      db.destinations.push(row);
      save(db);
      return ok(row);
    }
    if (parts[0] === "admin" && parts[1] === "service-types") {
      const id = db.seq.service_types++;
      const row = { id, name: data.name };
      db.service_types.push(row);
      save(db);
      return ok(row);
    }
    return ok({});
  },
  put: (url, data) => {
    const db = load();
    const { parts } = parse(url);
    if (parts[0] === "drivers") {
      const id = Number(parts[1]);
      const i = db.drivers.findIndex((d) => d.id === id);
      if (i >= 0) db.drivers[i] = { id, name: data.name, cpf: data.cpf || null, cnh_category: data.cnh_category || null, status: data.status || "Ativo" };
      save(db);
      return ok(db.drivers[i]);
    }
    if (parts[0] === "trips") {
      const id = Number(parts[1]);
      const i = db.trips.findIndex((t) => t.id === id);
      const status = computeStatus(data.end_time, data.km_end);
      if (i >= 0) db.trips[i] = { id, date: data.date, driver_id: Number(data.driver_id), destination: data.destination || null, service_type: data.service_type || null, description: data.description || null, start_time: data.start_time || null, end_time: data.end_time || null, km_start: data.km_start != null ? Number(data.km_start) : null, km_end: data.km_end != null ? Number(data.km_end) : null, status };
      save(db);
      const t = db.trips[i];
      return ok({ ...t, km_rodado: computeKm(t.km_start, t.km_end), horas: computeHours(t.date, t.start_time, t.end_time) });
    }
    if (parts[0] === "admin" && parts[1] === "truck") {
      db.truck = { id: 1, plate: data.plate || null, model: data.model || null, year: data.year != null ? Number(data.year) : null };
      save(db);
      return ok(db.truck);
    }
    return ok({});
  },
  delete: (url) => {
    const db = load();
    const { parts } = parse(url);
    if (parts[0] === "drivers") {
      const id = Number(parts[1]);
      db.drivers = db.drivers.filter((d) => d.id !== id);
      save(db);
      return ok({ ok: true });
    }
    if (parts[0] === "trips") {
      const id = Number(parts[1]);
      db.trips = db.trips.filter((t) => t.id !== id);
      save(db);
      return ok({ ok: true });
    }
    if (parts[0] === "admin" && parts[1] === "destinations") {
      const id = Number(parts[2]);
      db.destinations = db.destinations.filter((d) => d.id !== id);
      save(db);
      return ok({ ok: true });
    }
    if (parts[0] === "admin" && parts[1] === "service-types") {
      const id = Number(parts[2]);
      db.service_types = db.service_types.filter((d) => d.id !== id);
      save(db);
      return ok({ ok: true });
    }
    return ok({ ok: true });
  }
};

export default api;


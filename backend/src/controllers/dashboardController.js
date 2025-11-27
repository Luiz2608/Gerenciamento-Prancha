import { db } from "../database/db.js";

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

export const dashboard = (req, res) => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const start = `${y}-${m}-01`;
  const endDate = new Date(y, now.getMonth() + 1, 0);
  const end = `${y}-${String(endDate.getDate()).padStart(2, "0")}`;
  const monthTrips = db.prepare("SELECT * FROM trips WHERE date >= ? AND date <= ?").all(start, end);
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
  const topDriver = topDriverId ? db.prepare("SELECT name FROM drivers WHERE id = ?").get(Number(topDriverId))?.name || null : null;
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
    const rows = db.prepare("SELECT * FROM trips WHERE date >= ? AND date <= ?").all(s, e);
    const km = rows.reduce((a, t) => a + computeKm(t.km_start, t.km_end), 0);
    const hrs = rows.reduce((a, t) => a + computeHours(t.date, t.start_time, t.end_time), 0);
    kmByMonth.push({ month: m2, km });
    hoursByMonth.push({ month: m2, hours: hrs });
  }
  const tripsByDriver = db
    .prepare("SELECT d.name as name, COUNT(*) as count FROM trips t JOIN drivers d ON d.id = t.driver_id GROUP BY t.driver_id")
    .all()
    .map((r) => ({ name: r.name, value: r.count }));
  res.json({ totalTrips, totalKm, totalHours, topDriver, topDestination, kmByMonth, hoursByMonth, tripsByDriver });
};


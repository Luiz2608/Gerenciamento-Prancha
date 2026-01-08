import { useEffect, useState } from "react";
import { getMotoristas, getPranchas, getViagemByPrancha } from "../services/storageService.js";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

export default function HistoryPrancha() {
  const [drivers, setDrivers] = useState([]);
  const [pranchas, setPranchas] = useState([]);
  const [items, setItems] = useState([]);
  const [totalKm, setTotalKm] = useState(0);
  const [totalHours, setTotalHours] = useState(0);
  const [count, setCount] = useState(0);
  const [filters, setFilters] = useState(() => {
    const saved = localStorage.getItem("history_prancha_filters");
    return saved ? JSON.parse(saved) : { pranchaId: "", startDate: "", endDate: "", driverId: "", destination: "", status: "" };
  });

  useEffect(() => {
    localStorage.setItem("history_prancha_filters", JSON.stringify(filters));
  }, [filters]);

  const load = async () => {
    const d = await getMotoristas();
    const p = await getPranchas();
    setDrivers(d);
    setPranchas(p.filter((x) => x.status === "Ativo"));
  };
  const query = async () => {
    if (!filters.pranchaId) { setItems([]); setTotalKm(0); setTotalHours(0); setCount(0); return; }
    const r = await getViagemByPrancha(Number(filters.pranchaId), filters);
    setItems(r.data);
    setCount(r.total);
    setTotalKm(r.data.reduce((a, it) => a + (it.km_rodado || 0), 0));
    setTotalHours(r.data.reduce((a, it) => a + (it.horas || 0), 0));
  };
  useEffect(() => { load(); }, []);
  useEffect(() => { query(); }, [filters]);
  const series = items.reduce((acc, it) => { const m = it.date?.slice(0,7) || ""; const f = acc.find((x) => x.month === m) || { month: m, km: 0 }; f.km += it.km_rodado || 0; if (!acc.find((x) => x.month === m)) acc.push(f); return acc; }, []);
  return (
    <div className="space-y-8">
      <div className="card p-6 grid grid-cols-1 md:grid-cols-6 gap-4">
        <select className="select" value={filters.pranchaId} onChange={(e) => setFilters({ ...filters, pranchaId: e.target.value })}>
          <option value="" disabled>Prancha</option>
          {pranchas.map((p) => <option key={p.id} value={p.id}>{p.asset_number || "Reboque"} {p.is_set && p.asset_number2 ? `/ ${p.asset_number2}` : ""}</option>)}
        </select>
        <input className="input" placeholder="Início" value={filters.startDate} onChange={(e) => setFilters({ ...filters, startDate: e.target.value })} />
        <input className="input" placeholder="Fim" value={filters.endDate} onChange={(e) => setFilters({ ...filters, endDate: e.target.value })} />
        <select className="select" value={filters.driverId} onChange={(e) => setFilters({ ...filters, driverId: e.target.value })}>
          <option value="" disabled>Motorista</option>
          {drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <input className="input" placeholder="Destino" value={filters.destination} onChange={(e) => setFilters({ ...filters, destination: e.target.value })} />
        <select className="select" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
          <option value="" disabled>Status</option>
          <option>Pendente</option>
          <option>Em andamento</option>
          <option>Finalizada</option>
        </select>
      </div>
      <div className="card p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <div className="card p-4"><div className="text-sm">KM total</div><div className="text-2xl font-bold">{totalKm}</div></div>
          <div className="card p-4"><div className="text-sm">Horas totais</div><div className="text-2xl font-bold">{totalHours}</div></div>
          <div className="card p-4"><div className="text-sm">Viagens</div><div className="text-2xl font-bold">{count}</div></div>
        </div>
        <table className="table min-w-[1100px] hidden md:table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Data</th>
              <th>Motorista</th>
              <th>Destino</th>
              <th>Status</th>
              <th>KM</th>
              <th>Horas</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, idx) => (
              <tr key={it.id} className={`${idx % 2 === 0 ? 'bg-slate-50 dark:bg-slate-800' : 'bg-white dark:bg-slate-700'} hover:bg-slate-100 dark:hover:bg-slate-600`}>
                <td>{it.id}</td>
                <td>{it.date}</td>
                <td>{drivers.find((d) => d.id === it.driver_id)?.name || it.driver_id}</td>
                <td>{it.destination || ""}</td>
                <td>{it.status}</td>
                <td>{it.km_rodado}</td>
                <td>{it.horas}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="space-y-3 md:hidden">
          {items.map((it) => (
            <div key={it.id} className="card p-4">
              <div className="flex justify-between items-center">
                <div className="font-semibold">#{it.id} • {it.date}</div>
                <div className="text-sm">{it.status}</div>
              </div>
              <div className="text-sm text-slate-600 dark:text-slate-300">Motorista: {drivers.find((d) => d.id === it.driver_id)?.name || it.driver_id}</div>
              <div className="text-sm text-slate-600 dark:text-slate-300">Destino: {it.destination || "-"}</div>
              <div className="mt-1 flex gap-4 text-sm"><span>KM: {it.km_rodado}</span><span>Horas: {it.horas}</span></div>
            </div>
          ))}
        </div>
      </div>
      <div className="card p-6">
        <div className="h-72">
          <ResponsiveContainer>
            <BarChart data={series}>
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="km" fill="#2563eb" radius={[8,8,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

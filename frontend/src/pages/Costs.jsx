import { useEffect, useState } from "react";
import { getMotoristas, getCaminhoes, getPranchas, getViagens, exportCsv, exportPdf } from "../services/storageService.js";
import { useToast } from "../components/ToastProvider.jsx";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";

const colors = ["#2563eb", "#38bdf8", "#22c55e", "#a78bfa", "#f59e0b", "#ef4444", "#14b8a6", "#0ea5e9"];

export default function Costs() {
  const toast = useToast();
  const [drivers, setDrivers] = useState([]);
  const [trucks, setTrucks] = useState([]);
  const [pranchas, setPranchas] = useState([]);
  const [items, setItems] = useState([]);
  const [filters, setFilters] = useState({ startDate: "", endDate: "", driverId: "", truckId: "", pranchaId: "" });
  const [total, setTotal] = useState(0);
  const [avgKm, setAvgKm] = useState(0);
  const [avgHour, setAvgHour] = useState(0);
  const loadRefs = async () => {
    setDrivers(await getMotoristas());
    setTrucks((await getCaminhoes()).filter((x) => x.status === "Ativo"));
    setPranchas((await getPranchas()).filter((x) => x.status === "Ativo"));
  };
  const load = async () => {
    const r = await getViagens({ ...filters, page: 1, pageSize: 1000 });
    setItems(r.data);
    const sum = r.data.reduce((a, it) => a + (it.total_cost || 0), 0);
    setTotal(sum);
    const km = r.data.reduce((a, it) => a + (it.km_rodado || 0), 0);
    const hrs = r.data.reduce((a, it) => a + (it.horas || 0), 0);
    setAvgKm(km ? (sum / km) : 0);
    setAvgHour(hrs ? (sum / hrs) : 0);
  };
  useEffect(() => { loadRefs(); }, []);
  useEffect(() => { load(); }, [filters]);
  const barData = items.map((it) => ({ id: it.id, total: it.total_cost || 0 }));
  const pieData = [
    { name: "Combustível", value: items.reduce((a, it) => a + ((it.fuel_liters || 0) * (it.fuel_price || 0)), 0) },
    { name: "Outros", value: items.reduce((a, it) => a + (it.other_costs || 0), 0) }
  ];
  const lineData = items.reduce((acc, it) => { const m = it.date?.slice(0,7) || ""; const f = acc.find((x) => x.month === m) || { month: m, total: 0 }; f.total += it.total_cost || 0; if (!acc.find((x) => x.month === m)) acc.push(f); return acc; }, []);
  return (
    <div className="space-y-8">
      <div className="card p-6 grid grid-cols-1 md:grid-cols-5 gap-4">
        <input className="input" placeholder="Início" value={filters.startDate} onChange={(e) => setFilters({ ...filters, startDate: e.target.value })} />
        <input className="input" placeholder="Fim" value={filters.endDate} onChange={(e) => setFilters({ ...filters, endDate: e.target.value })} />
        <select className="select" value={filters.driverId} onChange={(e) => setFilters({ ...filters, driverId: e.target.value })}>
          <option value="">Motorista</option>
          {drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <select className="select" value={filters.truckId} onChange={(e) => setFilters({ ...filters, truckId: e.target.value })}>
          <option value="">Caminhão</option>
          {trucks.map((t) => <option key={t.id} value={t.id}>{t.plate || t.model || t.id}</option>)}
        </select>
        <select className="select" value={filters.pranchaId} onChange={(e) => setFilters({ ...filters, pranchaId: e.target.value })}>
          <option value="">Prancha</option>
          {pranchas.map((p) => <option key={p.id} value={p.id}>{p.identifier || p.model || p.id}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card p-6">
          <div className="font-semibold mb-2">Total gasto</div>
          <div className="text-3xl font-bold">R$ {total.toFixed(2)}</div>
        </div>
        <div className="card p-6">
          <div className="font-semibold mb-2">Média custo/km</div>
          <div className="text-3xl font-bold">R$ {avgKm.toFixed(2)}</div>
        </div>
        <div className="card p-6">
          <div className="font-semibold mb-2">Média custo/hora</div>
          <div className="text-3xl font-bold">R$ {avgHour.toFixed(2)}</div>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card p-6">
          <div className="font-semibold mb-4">Custo total por viagem</div>
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={barData}>
                <XAxis dataKey="id" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="total" fill="#2563eb" radius={[8,8,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card p-6">
          <div className="font-semibold mb-4">Distribuição dos custos</div>
          <div className="h-72">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={110}>
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={colors[i % colors.length]} stroke="#ffffff" />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card p-6">
          <div className="font-semibold mb-4">Custo por mês</div>
          <div className="h-72">
            <ResponsiveContainer>
              <LineChart data={lineData}>
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="total" stroke="#38bdf8" strokeWidth={3} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      <div className="card p-6 overflow-x-auto">
        <table className="table min-w-[1100px]">
          <thead>
            <tr>
              <th>ID</th>
              <th>Data</th>
              <th>Motorista</th>
              <th>Caminhão</th>
              <th>Prancha</th>
              <th>KM</th>
              <th>Horas</th>
              <th>Combustível</th>
              <th>Valor/litro</th>
              <th>Outros</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, idx) => (
              <tr key={it.id} className={`${idx % 2 === 0 ? 'bg-slate-50' : 'bg-white'} hover:bg-slate-100`}>
                <td>{it.id}</td>
                <td>{it.date}</td>
                <td>{drivers.find((d) => d.id === it.driver_id)?.name || it.driver_id}</td>
                <td>{trucks.find((t) => t.id === it.truck_id)?.plate || it.truck_id || ""}</td>
                <td>{pranchas.find((p) => p.id === it.prancha_id)?.identifier || it.prancha_id || ""}</td>
                <td>{it.km_rodado}</td>
                <td>{it.horas}</td>
                <td>{it.fuel_liters ?? 0}</td>
                <td>{it.fuel_price ?? 0}</td>
                <td>{it.other_costs ?? 0}</td>
                <td>{(it.total_cost ?? 0).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
  const exportCsvAction = async () => { const blob = await exportCsv(filters); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "custos.csv"; a.click(); URL.revokeObjectURL(url); toast?.show("CSV exportado", "success"); };
  const exportPdfAction = async () => { const blob = await exportPdf(filters); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "custos.pdf"; a.click(); URL.revokeObjectURL(url); toast?.show("PDF exportado", "success"); };
      <div className="flex items-center gap-3">
        <button className="btn btn-primary" onClick={exportCsvAction}><span className="material-icons">download</span> CSV</button>
        <button className="btn btn-secondary" onClick={exportPdfAction}><span className="material-icons">picture_as_pdf</span> PDF</button>
      </div>

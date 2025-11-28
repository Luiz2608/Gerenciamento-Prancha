import { useEffect, useState } from "react";
import { getMotoristas, getCaminhoes, getPranchas, getViagens, exportCsv, exportPdf } from "../services/storageService.js";
import { useToast } from "../components/ToastProvider.jsx";

export default function HistoryUnified() {
  const toast = useToast();
  const [drivers, setDrivers] = useState([]);
  const [trucks, setTrucks] = useState([]);
  const [pranchas, setPranchas] = useState([]);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalCount, setTotalCount] = useState(0);
  const [filters, setFilters] = useState({ startDate: "", endDate: "", vehicleType: "both", plate: "", driverId: "", destination: "", status: "" });
  const loadRefs = async () => {
    setDrivers(await getMotoristas());
    setTrucks((await getCaminhoes()).filter((x) => x.status !== "Inativo"));
    setPranchas((await getPranchas()).filter((x) => x.status !== "Inativo"));
  };
  const load = async () => {
    const r = await getViagens({ ...filters, page, pageSize });
    setItems(r.data);
    setTotalCount(r.total);
    setTotal(r.data.reduce((a, it) => a + (it.total_cost || 0), 0));
  };
  useEffect(() => { loadRefs(); }, []);
  useEffect(() => { load(); }, [filters, page, pageSize]);
  const exportCsvAction = async () => { const blob = await exportCsv(filters); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "historico.csv"; a.click(); URL.revokeObjectURL(url); toast?.show("CSV exportado", "success"); };
  const exportPdfAction = async () => { const blob = await exportPdf(filters); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "historico.pdf"; a.click(); URL.revokeObjectURL(url); toast?.show("PDF exportado", "success"); };
  return (
    <div className="space-y-6">
      <div className="card p-6 grid grid-cols-1 md:grid-cols-6 gap-4">
        <input className="input" placeholder="Início (YYYY-MM-DD)" value={filters.startDate} onChange={(e) => setFilters({ ...filters, startDate: e.target.value })} />
        <input className="input" placeholder="Fim (YYYY-MM-DD)" value={filters.endDate} onChange={(e) => setFilters({ ...filters, endDate: e.target.value })} />
        <select className="select" value={filters.vehicleType} onChange={(e) => setFilters({ ...filters, vehicleType: e.target.value })}>
          <option value="both">Veículo: Ambos</option>
          <option value="truck">Caminhão</option>
          <option value="prancha">Prancha</option>
        </select>
        <input className="input" placeholder="Placa" value={filters.plate} onChange={(e) => setFilters({ ...filters, plate: e.target.value })} />
        <select className="select" value={filters.driverId} onChange={(e) => setFilters({ ...filters, driverId: e.target.value })}>
          <option value="">Motorista</option>
          {drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <input className="input" placeholder="Destino" value={filters.destination} onChange={(e) => setFilters({ ...filters, destination: e.target.value })} />
        <select className="select" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
          <option value="">Status</option>
          <option>Pendente</option>
          <option>Em andamento</option>
          <option>Finalizada</option>
        </select>
        <div className="flex items-center gap-3 md:col-span-6">
          <button className="btn btn-primary" onClick={exportCsvAction}><span className="material-icons">download</span> CSV</button>
          <button className="btn btn-secondary" onClick={exportPdfAction}><span className="material-icons">picture_as_pdf</span> PDF</button>
        </div>
      </div>
      <div className="card p-6 overflow-x-auto">
        <table className="table min-w-[1200px]">
          <thead>
            <tr>
              <th>ID</th>
              <th>Data</th>
              <th>Motorista</th>
              <th>Caminhão</th>
              <th>Prancha</th>
              <th>Destino</th>
              <th>Status</th>
              <th>KM</th>
              <th>Horas</th>
              <th>Custo</th>
              <th>Detalhes</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, idx) => (
              <tr key={it.id} className={`${idx % 2 === 0 ? 'bg-slate-50' : 'bg-white'} hover:bg-slate-100`}>
                <td>{it.id}</td>
                <td>{it.date}</td>
                <td>{drivers.find((d) => d.id === it.driver_id)?.name || it.driver_id}</td>
                <td>{trucks.find((t) => t.id === it.truck_id)?.plate || it.truck_id || ""}</td>
                <td>{pranchas.find((p) => p.id === it.prancha_id)?.asset_number || it.prancha_id || ""}</td>
                <td>{it.destination || ""}</td>
                <td>{it.status}</td>
                <td>{it.km_rodado}</td>
                <td>{it.horas}</td>
                <td>{(it.total_cost ?? 0).toFixed(2)}</td>
                <td>
                  <details>
                    <summary className="cursor-pointer text-primary">Ver</summary>
                    <div className="mt-2 text-sm">
                      <div>Serviço: {it.service_type || ""}</div>
                      <div>Descrição: {it.description || ""}</div>
                      <div>Horários: {it.start_time || ""} - {it.end_time || ""}</div>
                      <div>KM: {it.km_start ?? ""} → {it.km_end ?? ""}</div>
                      <div>Custos: Comb {it.fuel_liters ?? 0}L x R${it.fuel_price ?? 0} + Manut R${it.maintenance_cost ?? 0} + Diária R${it.driver_daily ?? 0} + Outros R${it.other_costs ?? 0}</div>
                    </div>
                  </details>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex justify-end items-center gap-3 mt-4">
          <button className="btn" onClick={() => setPage(Math.max(1, page-1))}><span className="material-icons">chevron_left</span></button>
          <div className="text-sm">Página {page}</div>
          <button className="btn" onClick={() => setPage(page+1)} disabled={items.length < pageSize}><span className="material-icons">chevron_right</span></button>
          <select className="select w-28" value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
        </div>
        <div className="mt-4 text-sm">Registros: {totalCount} • Total gasto no período: R$ {total.toFixed(2)}</div>
      </div>
    </div>
  );
}

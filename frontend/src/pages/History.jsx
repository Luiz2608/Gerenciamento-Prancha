import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getMotoristas, getViagens, exportCsv, exportPdf } from "../services/storageService.js";

export default function History() {
  const nav = useNavigate();
  const [drivers, setDrivers] = useState([]);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [filters, setFilters] = useState(() => {
    const saved = localStorage.getItem("history_filters");
    return saved ? JSON.parse(saved) : { startDate: "", endDate: "", driverId: "", destination: "", status: "", search: "" };
  });

  useEffect(() => {
    localStorage.setItem("history_filters", JSON.stringify(filters));
  }, [filters]);

  const [viewItem, setViewItem] = useState(null);

  const loadDrivers = () => getMotoristas().then((r) => setDrivers(r));
  const load = () => getViagens({ ...filters, page, pageSize }).then((r) => { setItems(r.data); setTotal(r.total); });
  useEffect(() => { loadDrivers(); }, []);
  useEffect(() => { load(); }, [filters, page, pageSize]);

  const doExportCsv = async () => {
    const blob = await exportCsv(filters);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "viagens.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const doExportPdf = async () => {
    const blob = await exportPdf(filters);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "relatorio.pdf";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8 animate-fade overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch', overscrollBehaviorX: 'contain', touchAction: 'pan-x' }}>
      <div className="card p-6 grid grid-cols-1 md:grid-cols-6 gap-4">
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
        <input className="input" placeholder="Busca" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} />
        <div className="md:col-span-6 flex gap-2">
          <button className="btn btn-primary" onClick={doExportCsv}>Exportar CSV</button>
          <button className="btn btn-secondary" onClick={doExportPdf}>Exportar PDF</button>
        </div>
      </div>
      <div className="card p-6 overflow-x-auto hidden md:block">
        <table className="table min-w-[900px]">
          <thead>
            <tr>
              <th>ID</th>
              <th>Data</th>
              <th>Motorista</th>
              <th>Destino</th>
              <th>Tipo</th>
              <th>Status</th>
              <th>KM</th>
              <th>Horas</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, idx) => (
              <tr key={it.id} className={`${idx % 2 === 0 ? 'bg-slate-50' : 'bg-white'} hover:bg-slate-100`}>
                <td>{it.id}</td>
                <td>{it.date}</td>
                <td>{drivers.find((d) => d.id === it.driver_id)?.name || it.driver_id}</td>
                <td>{it.destination || ""}</td>
                <td>{it.service_type || ""}</td>
                <td>{it.status}</td>
                <td>{it.km_rodado}</td>
                <td>{it.horas}</td>
                <td className="space-x-2">
                  <button className="btn border border-slate-300" onClick={() => setViewItem(it)}>Ver</button>
                  <button className="btn border border-slate-300" onClick={() => nav(`/viagens?editId=${it.id}`)}>Editar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-4 flex items-center gap-2">
          <button className="btn border border-slate-300" disabled={page === 1} onClick={() => setPage(page - 1)}>Anterior</button>
          <span>{page}</span>
          <button className="btn border border-slate-300" disabled={(page * pageSize) >= total} onClick={() => setPage(page + 1)}>Próximo</button>
          <select className="select ml-auto !py-2 !px-2" value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
        </div>
      </div>
      <div className="space-y-3 md:hidden">
        {items.map((it) => (
          <div key={it.id} className="card p-4">
            <div className="flex justify-between items-center">
              <div className="font-semibold">#{it.id} • {it.date}</div>
              <div className="text-sm">{it.status}</div>
            </div>
            <div className="text-sm text-slate-600 dark:text-slate-300">Motorista: {drivers.find((d) => d.id === it.driver_id)?.name || it.driver_id}</div>
            <div className="text-sm text-slate-600 dark:text-slate-300">Destino: {it.destination || "-"}</div>
            <div className="text-sm">Tipo: {it.service_type || "-"}</div>
            <div className="mt-1 flex gap-4 text-sm"><span>KM: {it.km_rodado}</span><span>Horas: {it.horas}</span></div>
            <div className="mt-2 flex flex-wrap gap-2">
              <button className="btn" onClick={() => setViewItem(it)}>Ver</button>
              <button className="btn border border-slate-300" onClick={() => nav(`/viagens?editId=${it.id}`)}>Editar</button>
            </div>
          </div>
        ))}
        <div className="mt-2 flex items-center gap-2">
          <button className="btn border border-slate-300" disabled={page === 1} onClick={() => setPage(page - 1)}>Anterior</button>
          <span>{page}</span>
          <button className="btn border border-slate-300" disabled={(page * pageSize) >= total} onClick={() => setPage(page + 1)}>Próximo</button>
        </div>
      </div>
      {viewItem && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center">
          <div className="card p-6 w-full max-w-lg">
            <div className="font-semibold mb-4 text-secondary">Viagem #{viewItem.id}</div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="font-medium">Data:</span> {viewItem.date}</div>
              <div><span className="font-medium">Motorista:</span> {drivers.find((d) => d.id === viewItem.driver_id)?.name || viewItem.driver_id}</div>
              <div><span className="font-medium">Destino:</span> {viewItem.destination || ""}</div>
              <div><span className="font-medium">Tipo:</span> {viewItem.service_type || ""}</div>
              <div><span className="font-medium">Saída:</span> {viewItem.start_time || ""}</div>
              <div><span className="font-medium">Retorno:</span> {viewItem.end_time || ""}</div>
              <div><span className="font-medium">KM início:</span> {viewItem.km_start ?? ""}</div>
              <div><span className="font-medium">KM fim:</span> {viewItem.km_end ?? ""}</div>
              <div><span className="font-medium">Status:</span> {viewItem.status}</div>
              <div><span className="font-medium">KM rodado:</span> {viewItem.km_rodado}</div>
              <div><span className="font-medium">Horas:</span> {viewItem.horas}</div>
              <div className="md:col-span-2"><span className="font-medium">Descrição:</span> {viewItem.description || ""}</div>
            </div>
            <div className="mt-4 text-right">
              <button className="btn border border-slate-300" onClick={() => setViewItem(null)}>Fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

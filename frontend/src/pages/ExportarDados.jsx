import { useEffect, useMemo, useState } from "react";
import { getCaminhoes, getPranchas, getMotoristas, getViagemByCaminhao, getViagemByPrancha, getViagens } from "../services/storageService.js";

export default function ExportarDados() {
  const [trucks, setTrucks] = useState([]);
  const [pranchas, setPranchas] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [sel, setSel] = useState({ truckId: "", pranchaId: "", driverId: "" });
  const [truckTrips, setTruckTrips] = useState([]);
  const [pranchaTrips, setPranchaTrips] = useState([]);
  const [driverTrips, setDriverTrips] = useState([]);

  useEffect(() => {
    getCaminhoes().then(setTrucks);
    getPranchas().then(setPranchas);
    getMotoristas().then(setDrivers);
  }, []);

  useEffect(() => {
    if (sel.truckId) { getViagemByCaminhao(Number(sel.truckId), { page: 1, pageSize: 1000 }).then((r) => setTruckTrips(r.data)); }
    else setTruckTrips([]);
  }, [sel.truckId]);
  useEffect(() => {
    if (sel.pranchaId) { getViagemByPrancha(String(sel.pranchaId), { page: 1, pageSize: 1000 }).then((r) => setPranchaTrips(r.data)); }
    else setPranchaTrips([]);
  }, [sel.pranchaId]);
  useEffect(() => {
    if (sel.driverId) { getViagens({ driverId: Number(sel.driverId), page: 1, pageSize: 1000 }).then((r) => setDriverTrips(r.data)); }
    else setDriverTrips([]);
  }, [sel.driverId]);

  const truckInfo = useMemo(() => trucks.find((t) => String(t.id) === String(sel.truckId)) || null, [trucks, sel.truckId]);
  const pranchaInfo = useMemo(() => pranchas.find((p) => String(p.id) === String(sel.pranchaId) || String(p.asset_number) === String(sel.pranchaId)) || null, [pranchas, sel.pranchaId]);
  const driverInfo = useMemo(() => drivers.find((d) => String(d.id) === String(sel.driverId)) || null, [drivers, sel.driverId]);

  const InfoCard = ({ title, children }) => (
    <div className="card p-6">
      <div className="font-semibold mb-3 text-secondary">{title}</div>
      <div className="space-y-1 text-sm">{children}</div>
    </div>
  );
  const TripsTable = ({ items }) => (
    <div className="card p-6 animate-fade overflow-x-auto">
      <table className="table min-w-[900px]">
        <thead>
          <tr>
            <th>ID</th>
            <th>Data</th>
            <th>Destino</th>
            <th>Tipo</th>
            <th>Status</th>
            <th>KM</th>
            <th>Horas</th>
            <th>Custo</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, idx) => (
            <tr key={it.id} className={`${idx % 2 === 0 ? 'bg-slate-50 dark:bg-slate-800' : 'bg-white dark:bg-slate-700'} hover:bg-slate-100 dark:hover:bg-slate-600`}>
              <td>{it.id}</td>
              <td>{it.date}{it.end_date ? ` → ${it.end_date}` : ''}</td>
              <td>{it.destination || ''}</td>
              <td>{it.service_type || ''}</td>
              <td>{it.status}</td>
              <td>{it.km_rodado}</td>
              <td>{it.horas}</td>
              <td>{(it.total_cost ?? 0).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-8 overflow-x-auto overflow-y-auto min-h-screen page" style={{ WebkitOverflowScrolling: 'touch', overscrollBehaviorX: 'contain', overscrollBehaviorY: 'contain', touchAction: 'pan-y' }}>
      <div className="card p-6 animate-fade">
        <div className="font-semibold mb-4 text-secondary text-xl">Exportar Dados</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <select className="select" value={sel.truckId} onChange={(e) => setSel({ ...sel, truckId: e.target.value })}>
            <option value="">Selecione Caminhão</option>
            {trucks.map((t) => <option key={t.id} value={t.id}>{t.fleet || t.plate || t.model || t.id}</option>)}
          </select>
          <select className="select" value={sel.pranchaId} onChange={(e) => setSel({ ...sel, pranchaId: e.target.value })}>
            <option value="">Selecione Prancha</option>
            {pranchas.map((p) => <option key={p.id} value={p.id}>{p.asset_number || p.identifier || p.model || p.id}</option>)}
          </select>
          <select className="select" value={sel.driverId} onChange={(e) => setSel({ ...sel, driverId: e.target.value })}>
            <option value="">Selecione Motorista</option>
            {drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
      </div>

      {truckInfo && (
        <InfoCard title="Caminhão Selecionado">
          <div>Frota: {truckInfo.fleet || '-'}</div>
          <div>Placa: {truckInfo.plate || '-'}</div>
          <div>Modelo: {truckInfo.model || '-'}</div>
          <div>Ano: {truckInfo.year || '-'}</div>
          <div>Status: {truckInfo.status || '-'}</div>
          <div>KM atual: {truckInfo.km_current ?? '-'}</div>
        </InfoCard>
      )}
      {truckInfo && <TripsTable items={truckTrips} />}

      {pranchaInfo && (
        <InfoCard title="Prancha Selecionada">
          <div>Frota: {pranchaInfo.asset_number || '-'}</div>
          <div>Identificador: {pranchaInfo.identifier || '-'}</div>
          <div>Tipo: {pranchaInfo.type || '-'}</div>
          <div>Capacidade: {pranchaInfo.capacity || '-'}</div>
          <div>Ano: {pranchaInfo.year || '-'}</div>
          <div>Status: {pranchaInfo.status || '-'}</div>
        </InfoCard>
      )}
      {pranchaInfo && <TripsTable items={pranchaTrips} />}

      {driverInfo && (
        <InfoCard title="Motorista Selecionado">
          <div>Nome: {driverInfo.name || '-'}</div>
          <div>CPF: {driverInfo.cpf || '-'}</div>
          <div>CNH: {driverInfo.cnh_category || '-'}</div>
          <div>Status: {driverInfo.status || '-'}</div>
        </InfoCard>
      )}
      {driverInfo && <TripsTable items={driverTrips} />}
    </div>
  );
}


import { useEffect, useMemo, useState } from "react";
import { getCaminhoes, getPranchas, getMotoristas } from "../services/storageService.js";

export default function ExportarDados() {
  const [trucks, setTrucks] = useState([]);
  const [pranchas, setPranchas] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [sel, setSel] = useState({ truckId: "", pranchaId: "", driverId: "" });

  useEffect(() => {
    getCaminhoes().then(setTrucks);
    getPranchas().then(setPranchas);
    getMotoristas().then(setDrivers);
  }, []);

  // Não listar viagens nesta aba; apenas informações de cadastro

  const truckInfo = useMemo(() => trucks.find((t) => String(t.id) === String(sel.truckId)) || null, [trucks, sel.truckId]);
  const pranchaInfo = useMemo(() => pranchas.find((p) => String(p.id) === String(sel.pranchaId) || String(p.asset_number) === String(sel.pranchaId)) || null, [pranchas, sel.pranchaId]);
  const driverInfo = useMemo(() => drivers.find((d) => String(d.id) === String(sel.driverId)) || null, [drivers, sel.driverId]);

  const InfoCard = ({ title, children }) => (
    <div className="card p-6">
      <div className="font-semibold mb-3 text-secondary">{title}</div>
      <div className="space-y-1 text-sm">{children}</div>
    </div>
  );
  // Sem tabela de viagens; foco em dados cadastrais

  return (
    <div className="space-y-8 overflow-x-auto overflow-y-auto min-h-screen page" style={{ WebkitOverflowScrolling: 'touch', overscrollBehaviorX: 'contain', overscrollBehaviorY: 'contain', touchAction: 'pan-y' }}>
      <div className="card p-6 animate-fade">
        <div className="font-semibold mb-4 text-secondary text-xl">Exportar Dados</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <select className="select" value={sel.truckId} onChange={(e) => setSel({ ...sel, truckId: e.target.value })}>
            <option value="" disabled>Selecione Caminhão</option>
            {trucks.map((t) => <option key={t.id} value={t.id}>{t.fleet || t.plate || t.model || t.id}</option>)}
          </select>
          <select className="select" value={sel.pranchaId} onChange={(e) => setSel({ ...sel, pranchaId: e.target.value })}>
            <option value="" disabled>Selecione Prancha</option>
            {pranchas.map((p) => <option key={p.id} value={p.id}>{p.asset_number || p.identifier || p.model || p.id}</option>)}
          </select>
          <select className="select" value={sel.driverId} onChange={(e) => setSel({ ...sel, driverId: e.target.value })}>
            <option value="" disabled>Selecione Motorista</option>
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

      {driverInfo && (
        <InfoCard title="Motorista Selecionado">
          <div>Nome: {driverInfo.name || '-'}</div>
          <div>CPF: {driverInfo.cpf || '-'}</div>
          <div>CNH: {driverInfo.cnh_category || '-'}</div>
          <div>Status: {driverInfo.status || '-'}</div>
        </InfoCard>
      )}
    </div>
  );
}

import { useEffect, useState } from "react";
import { getMotoristas, getCaminhoes, getPranchas, getViagens, exportCsv, exportPdf } from "../services/storageService.js";
import { useToast } from "../components/ToastProvider.jsx";
import useAuth from "../hooks/useAuth.js";

export default function HistoryUnified() {
  const toast = useToast();
  const { user } = useAuth();
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

  const handlePrintTrip = (trip) => {
    const driver = drivers.find((d) => d.id === trip.driver_id) || {};
    const truck = trucks.find((t) => t.id === trip.truck_id) || {};
    const prancha = pranchas.find((p) => p.id === trip.prancha_id) || {};
    const userName = user?.username || "Usuário do Sistema";
    
    const printWindow = window.open("", "_blank");
    printWindow.document.write(\`
      <html>
        <head>
          <title>Relatório de Viagem #\${trip.id}</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 20px; max-width: 210mm; margin: 0 auto; color: #333; }
            h1, h2, h3 { margin: 0 0 10px 0; }
            .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #333; padding-bottom: 10px; }
            .section { margin-bottom: 20px; border: 1px solid #ddd; padding: 15px; border-radius: 4px; }
            .section-title { font-weight: bold; font-size: 1.1em; margin-bottom: 10px; background: #f5f5f5; padding: 5px 10px; border-radius: 4px; border-left: 4px solid #333; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
            .field { margin-bottom: 5px; }
            .label { font-weight: bold; font-size: 0.9em; color: #555; }
            .value { font-size: 1em; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f5f5f5; }
            .footer { margin-top: 40px; font-size: 0.8em; text-align: center; border-top: 1px solid #ddd; padding-top: 10px; }
            .signatures { display: flex; justify-content: space-between; margin-top: 50px; }
            .signature-box { width: 40%; border-top: 1px solid #333; text-align: center; padding-top: 5px; }
            @media print {
              body { padding: 0; }
              .section { break-inside: avoid; }
              button { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Gerenciamento de Prancha</h1>
            <h2>Relatório de Viagem #\${trip.id}</h2>
            <div>Status: <strong>\${trip.status}</strong> | Emissão: \${new Date().toLocaleString()}</div>
          </div>

          <div class="section">
            <div class="section-title">🚚 Dados da Viagem</div>
            <div class="grid">
              <div class="field"><span class="label">Data Início:</span> <span class="value">\${trip.date}</span></div>
              <div class="field"><span class="label">Data Término:</span> <span class="value">\${trip.end_date || "-"}</span></div>
              <div class="field"><span class="label">Destino:</span> <span class="value">\${trip.destination || "-"}</span></div>
              <div class="field"><span class="label">Tipo de Carga/Serviço:</span> <span class="value">\${trip.service_type || "-"}</span></div>
              <div class="field" style="grid-column: span 2"><span class="label">Observações:</span> <span class="value">\${trip.description || "-"}</span></div>
            </div>
          </div>

          <div class="section">
            <div class="section-title">🚛 Dados do Veículo</div>
            <div class="grid">
              <div class="field"><span class="label">Caminhão:</span> <span class="value">\${truck.plate || trip.truck_id || "-"}</span></div>
              <div class="field"><span class="label">Modelo:</span> <span class="value">\${truck.model || "-"}</span></div>
              <div class="field"><span class="label">Frota:</span> <span class="value">\${truck.fleet || "-"}</span></div>
              <div class="field"><span class="label">Prancha:</span> <span class="value">\${prancha.asset_number || trip.prancha_id || "-"}</span></div>
            </div>
          </div>

          <div class="section">
            <div class="section-title">👨‍✈️ Dados do Motorista</div>
            <div class="grid">
              <div class="field"><span class="label">Nome:</span> <span class="value">\${driver.name || trip.driver_id || "-"}</span></div>
              <div class="field"><span class="label">CPF:</span> <span class="value">\${driver.cpf || "-"}</span></div>
              <div class="field"><span class="label">CNH:</span> <span class="value">\${driver.cnh_category || "-"}</span></div>
              <div class="field"><span class="label">Contato:</span> <span class="value">\${driver.contact || "-"}</span></div>
            </div>
          </div>

          <div class="section">
            <div class="section-title">⏱️ Informações Operacionais</div>
            <div class="grid">
              <div class="field"><span class="label">Hora Saída:</span> <span class="value">\${trip.start_time || "-"}</span></div>
              <div class="field"><span class="label">Hora Chegada:</span> <span class="value">\${trip.end_time || "-"}</span></div>
              <div class="field"><span class="label">KM Inicial:</span> <span class="value">\${trip.km_start || "-"}</span></div>
              <div class="field"><span class="label">KM Final:</span> <span class="value">\${trip.km_end || "-"}</span></div>
              <div class="field"><span class="label">KM Total:</span> <span class="value">\${trip.km_rodado || "0"} km</span></div>
              <div class="field"><span class="label">Horas Totais:</span> <span class="value">\${trip.horas || "0"} h</span></div>
            </div>
          </div>

          <div class="section">
            <div class="section-title">⛽ Consumo e Custos</div>
            <table class="table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Valor / Qtd</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Combustível (\${trip.fuel_liters || 0} L)</td>
                  <td>R$ \${Number(trip.fuel_price || 0).toFixed(2)} / L</td>
                  <td>R$ \${(Number(trip.fuel_liters || 0) * Number(trip.fuel_price || 0)).toFixed(2)}</td>
                </tr>
                <tr>
                  <td>Manutenção</td>
                  <td>-</td>
                  <td>R$ \${Number(trip.maintenance_cost || 0).toFixed(2)}</td>
                </tr>
                <tr>
                  <td>Diária Motorista</td>
                  <td>-</td>
                  <td>R$ \${Number(trip.driver_daily || 0).toFixed(2)}</td>
                </tr>
                <tr>
                  <td>Outros Custos</td>
                  <td>-</td>
                  <td>R$ \${Number(trip.other_costs || 0).toFixed(2)}</td>
                </tr>
                <tr style="font-weight: bold; background-color: #eee;">
                  <td colspan="2">Custo Total</td>
                  <td>R$ \${(trip.total_cost || 0).toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          
          <div class="section">
             <div class="section-title">📌 Histórico e Registros</div>
             <div class="grid">
               <div class="field"><span class="label">Solicitante:</span> <span class="value">\${trip.requester || "-"}</span></div>
               <div class="field"><span class="label">Responsável:</span> <span class="value">Sistema</span></div>
             </div>
          </div>

          <div class="signatures">
            <div class="signature-box">Assinatura do Motorista</div>
            <div class="signature-box">Assinatura do Supervisor</div>
          </div>

          <div class="footer">
            <p>Relatório gerado em \${new Date().toLocaleString()} por \${userName}</p>
            <p>Gerenciamento de Prancha - Página 1 de 1</p>
          </div>
          <script>
            window.onload = function() { setTimeout(function(){ window.print(); }, 500); }
          </script>
        </body>
      </html>
    \`);
    printWindow.document.close();
  };
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
        <div className="flex items-center gap-3 md:col-span-6">
          <button className="btn btn-primary" onClick={exportCsvAction}><span className="material-icons">download</span> CSV</button>
          <button className="btn btn-secondary" onClick={exportPdfAction}><span className="material-icons">picture_as_pdf</span> PDF</button>
        </div>
      </div>
      <div className="card p-6 overflow-x-auto hidden md:block">
        <table className="table md:min-w-[1200px] min-w-full">
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
              <tr key={it.id} className={`${idx % 2 === 0 ? 'bg-slate-50 dark:bg-slate-800' : 'bg-white dark:bg-slate-700'} hover:bg-slate-100 dark:hover:bg-slate-600`}>
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
                    <summary className="cursor-pointer text-primary font-medium">Ver Detalhes</summary>
                    <div className="mt-2 text-sm p-3 bg-slate-50 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
                        <div><span className="font-semibold">Serviço:</span> {it.service_type || "-"}</div>
                        <div><span className="font-semibold">Descrição:</span> {it.description || "-"}</div>
                        <div><span className="font-semibold">Horários:</span> {it.start_time || "-"} - {it.end_time || "-"}</div>
                        <div><span className="font-semibold">KM:</span> {it.km_start ?? "-"} → {it.km_end ?? "-"}</div>
                        <div className="md:col-span-2"><span className="font-semibold">Custos:</span> Comb {it.fuel_liters ?? 0}L x R${it.fuel_price ?? 0} + Manut R${it.maintenance_cost ?? 0} + Diária R${it.driver_daily ?? 0} + Outros R${it.other_costs ?? 0}</div>
                      </div>
                      <button 
                        onClick={() => handlePrintTrip(it)}
                        className="btn btn-secondary w-full flex items-center justify-center gap-2 py-1"
                      >
                        <span className="material-icons text-sm">print</span> Imprimir Relatório Completo
                      </button>
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
      <div className="space-y-3 md:hidden">
        {items.map((it) => (
          <div key={it.id} className="card p-4">
            <div className="flex justify-between items-center">
              <div className="font-semibold">#{it.id} • {it.date}</div>
              <div className="text-sm">{it.status}</div>
            </div>
            <div className="text-sm text-slate-600 dark:text-slate-300">Motorista: {drivers.find((d) => d.id === it.driver_id)?.name || it.driver_id}</div>
            <div className="text-sm text-slate-600 dark:text-slate-300">Caminhão: {trucks.find((t) => t.id === it.truck_id)?.plate || it.truck_id || ""}</div>
            <div className="text-sm text-slate-600 dark:text-slate-300">Prancha: {pranchas.find((p) => p.id === it.prancha_id)?.asset_number || it.prancha_id || ""}</div>
            <div className="text-sm">Destino: {it.destination || "-"}</div>
            <div className="mt-1 flex gap-4 text-sm"><span>KM: {it.km_rodado}</span><span>Horas: {it.horas}</span><span>Custo: R$ {(it.total_cost ?? 0).toFixed(2)}</span></div>
          </div>
        ))}
        <div className="mt-2 flex items-center gap-2">
          <button className="btn" onClick={() => setPage(Math.max(1, page-1))}><span className="material-icons">chevron_left</span></button>
          <div className="text-sm">Página {page}</div>
          <button className="btn" onClick={() => setPage(page+1)} disabled={items.length < pageSize}><span className="material-icons">chevron_right</span></button>
        </div>
        <div className="mt-2 text-sm">Registros: {totalCount} • Total: R$ {total.toFixed(2)}</div>
      </div>
    </div>
  );
}

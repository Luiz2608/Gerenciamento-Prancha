import { useEffect, useMemo, useState, useRef } from "react";
import { useToast } from "../components/ToastProvider.jsx";
import { getMotoristas, getCaminhoes, getPranchas, getViagens, getCustos, saveCusto, updateCusto, deleteCusto, approveCusto } from "../services/storageService.js";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";
import useAuth from "../hooks/useAuth.js";

const colors = ["#2563eb", "#38bdf8", "#22c55e", "#a78bfa", "#f59e0b", "#ef4444", "#14b8a6", "#0ea5e9"];

export default function Costs() {
  const toast = useToast();
  const { user } = useAuth();
  const [tab, setTab] = useState("lista");
  const [drivers, setDrivers] = useState([]);
  const [trucks, setTrucks] = useState([]);
  const [pranchas, setPranchas] = useState([]);
  const [custos, setCustos] = useState([]);
  const [totalRows, setTotalRows] = useState(0);
  const [filters, setFilters] = useState({ startDate: "", endDate: "", caminhaoId: "", pranchaId: "", driverId: "", location: "", aprovado: "", search: "", page: 1, pageSize: 20 });
  const [total, setTotal] = useState(0);
  const [avgKm, setAvgKm] = useState(0);
  const [avgHour, setAvgHour] = useState(0);
  const [form, setForm] = useState(() => {
    const saved = localStorage.getItem("costs_form_draft");
    return saved ? JSON.parse(saved) : { viagemId: "", dataRegistro: "", consumoLitros: "", valorLitro: "", diariaMotorista: "", pedagios: "", manutencao: "", outrosCustos: [], observacoes: "", anexos: [] };
  });

  const [addingOther, setAddingOther] = useState({ descricao: "", valor: "" });
  const [trips, setTrips] = useState([]);
  const [viewing, setViewing] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [calc, setCalc] = useState(null);
  const lastSubmitTime = useRef(0);

  useEffect(() => {
    if (!editingId) {
      localStorage.setItem("costs_form_draft", JSON.stringify(form));
    }
  }, [form, editingId]);


  const loadRefs = async () => {
    setDrivers(await getMotoristas());
    setTrucks((await getCaminhoes()).filter((x) => x.status === "Ativo"));
    setPranchas((await getPranchas()).filter((x) => x.status === "Ativo"));
    const r = await getViagens({ page: 1, pageSize: 20000 });
    setTrips(r.data);
  };
  const loadList = async () => {
    const f = { ...filters, aprovado: filters.aprovado === "" ? undefined : filters.aprovado === "true" };
    if (filters.startDate && isValidDate(filters.startDate)) f.startDate = toIsoDate(filters.startDate);
    if (filters.endDate && isValidDate(filters.endDate)) f.endDate = toIsoDate(filters.endDate);
    const r = await getCustos(f);
    if (r.data) {
      setCustos(r.data);
      setTotalRows(r.total);
    } else {
      setCustos(r);
      setTotalRows(r.length || 0);
    }
  };
  useEffect(() => { loadRefs(); }, []);
  useEffect(() => { if (tab === "lista" || tab === "relatorios") loadList(); }, [filters, tab]);

  const maskDate = (v) => {
    const digits = v.replace(/\D/g, "").slice(0,8);
    const p1 = digits.slice(0,2);
    const p2 = digits.slice(2,4);
    const p3 = digits.slice(4,8);
    return [p1, p2, p3].filter(Boolean).join("/");
  };
  const isValidDate = (ddmmyyyy) => {
    const m = ddmmyyyy.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!m) return false;
    const d = Number(m[1]); const mo = Number(m[2]) - 1; const y = Number(m[3]);
    const dt = new Date(y, mo, d);
    return dt.getFullYear() === y && dt.getMonth() === mo && dt.getDate() === d;
  };
  const toIsoDate = (ddmmyyyy) => {
    const [d, m, y] = ddmmyyyy.split("/").map(Number);
    return `${y}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
  };
  const fromIsoDate = (iso) => {
    const [y, m, d] = String(iso || "").split("-").map(Number);
    if (!y || !m || !d) return "";
    return `${String(d).padStart(2,"0")}/${String(m).padStart(2,"0")}/${y}`;
  };

  const handleTripLink = (id) => {
    setForm({ ...form, viagemId: id });
    const t = trips.find((x) => String(x.id) === String(id));
    if (t) setForm((prev) => ({ ...prev, kmRodado: t.km_rodado || 0, tempoHoras: t.horas || 0 }));
  };

  const addOther = () => {
    if (!addingOther.descricao || !addingOther.valor) { toast?.show("Informe descrição e valor", "error"); return; }
    const v = Number(addingOther.valor);
    if (isNaN(v) || v < 0) { toast?.show("Valor inválido", "error"); return; }
    setForm({ ...form, outrosCustos: [...(form.outrosCustos || []), { descricao: addingOther.descricao, valor: v }] });
    setAddingOther({ descricao: "", valor: "" });
  };

  const handleFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    const items = await Promise.all(files.map((f) => new Promise((res) => { const r = new FileReader(); r.onload = () => res({ nome: f.name, base64: String(r.result).split(",")[1] }); r.readAsDataURL(f); })));
    setForm({ ...form, anexos: [ ...(form.anexos || []), ...items ] });
  };

  const handleEnterInContainer = (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const root = e.currentTarget;
    const focusables = Array.from(root.querySelectorAll("input, select, textarea, button")).filter((el) => !el.disabled && el.tabIndex !== -1 && el.type !== "hidden");
    const idx = focusables.indexOf(document.activeElement);
    const next = focusables[idx + 1];
    if (next) next.focus();
  };

  const validate = (payload) => {
    const errs = [];
    if (!payload.viagemId) errs.push("Vincule uma viagem");
    if (!payload.dataRegistro) errs.push("Informe data de registro");
    const consumoLitros = Number(payload.consumoLitros || 0);
    const valorLitro = Number(payload.valorLitro || 0);
    const diariaMotorista = Number(payload.diariaMotorista || 0);
    const pedagios = Number(payload.pedagios || 0);
    const manutencao = Number(payload.manutencao || 0);
    const outrosSum = (payload.outrosCustos || []).reduce((a, it) => a + Number(it.valor || 0), 0);
    if ([consumoLitros, valorLitro, diariaMotorista, pedagios, manutencao].some((n) => n < 0)) errs.push("Valores não podem ser negativos");
    const custoTotal = consumoLitros * valorLitro + diariaMotorista + pedagios + manutencao + outrosSum;
    if (!(custoTotal >= 0)) errs.push("Cálculo inválido");
    return { ok: errs.length === 0, errs, custoTotal };
  };

  const submit = async (e) => {
    e.preventDefault();
    const payload = {
      viagemId: form.viagemId || null,
      dataRegistro: form.dataRegistro || new Date().toISOString().slice(0,10),
      registradoPor: "",
      caminhaoId: undefined,
      pranchaId: undefined,
      consumoLitros: form.consumoLitros ? Number(form.consumoLitros) : 0,
      valorLitro: form.valorLitro ? Number(form.valorLitro) : 0,
      kmRodado: form.kmRodado ? Number(form.kmRodado) : 0,
      tempoHoras: form.tempoHoras ? Number(form.tempoHoras) : 0,
      diariaMotorista: form.diariaMotorista ? Number(form.diariaMotorista) : 0,
      pedagios: form.pedagios ? Number(form.pedagios) : 0,
      manutencao: form.manutencao ? Number(form.manutencao) : 0,
      outrosCustos: form.outrosCustos || [],
      observacoes: form.observacoes || ""
    };
    const v = validate(payload);
    if (!v.ok) { toast?.show(v.errs[0], "error"); return; }

    const now = Date.now();
    if (now - lastSubmitTime.current < 3000) {
      toast?.show("Aguarde um momento antes de enviar novamente", "warning");
      return;
    }
    lastSubmitTime.current = now;

    try {
      if (editingId) {
        await updateCusto(editingId, payload);
        toast?.show("Custo atualizado", "success");
      } else {
        await saveCusto({ ...payload, anexos: form.anexos || [] });
        toast?.show("Custo salvo", "success");
      }
      localStorage.removeItem("costs_form_draft");
      setForm({ viagemId: "", dataRegistro: "", consumoLitros: "", valorLitro: "", diariaMotorista: "", pedagios: "", manutencao: "", outrosCustos: [], observacoes: "", anexos: [] });
      setEditingId(null);
      setTab("lista");
      loadList();
    } catch (err) {
      toast?.show("Erro ao salvar", "error");
    }
  };

  const approve = async (id) => {
    try { await approveCusto(id); toast?.show("Custo aprovado", "success"); loadList(); } catch (e) { toast?.show("Acesso negado", "error"); }
  };

  const del = async (id) => { await deleteCusto(id); toast?.show("Custo excluído", "success"); loadList(); };
  const delConfirm = async (id) => { if (!window.confirm("Confirma excluir este custo?")) return; await del(id); };

  const calcCost = (t) => Number(t.fuel_liters || 0) * Number(t.fuel_price || 0) + Number(t.other_costs || 0) + Number(t.maintenance_cost || 0) + Number(t.driver_daily || 0);

  const filteredTrips = useMemo(() => {
    return trips.filter((t) => {
        if (filters.startDate && isValidDate(filters.startDate) && t.date < toIsoDate(filters.startDate)) return false;
        if (filters.endDate && isValidDate(filters.endDate) && t.date > toIsoDate(filters.endDate)) return false;
        if (filters.caminhaoId && String(t.truck_id) !== String(filters.caminhaoId)) return false;
        if (filters.pranchaId && String(t.prancha_id) !== String(filters.pranchaId)) return false;
        if (filters.driverId && String(t.driver_id) !== String(filters.driverId)) return false;
        if (filters.location && t.location !== filters.location) return false;
        if (filters.search) {
             const s = filters.search.toLowerCase();
             const match = (t.description || "").toLowerCase().includes(s) || (t.destination || "").toLowerCase().includes(s);
             if (!match) return false;
        }
        return true;
    }).map(t => ({ ...t, totalCost: calcCost(t) }));
  }, [trips, filters]);

  const summary = useMemo(() => {
    const total = filteredTrips.reduce((acc, t) => acc + t.totalCost, 0);
    const fuel = filteredTrips.reduce((acc, t) => {
        const lit = Number(t.fuel_liters || 0);
        const val = Number(t.fuel_price || 0);
        return acc + (lit * val);
    }, 0);
    const maintenance = filteredTrips.reduce((acc, t) => acc + Number(t.maintenance_cost || 0), 0);
    const other = filteredTrips.reduce((acc, t) => acc + Number(t.other_costs || 0) + Number(t.driver_daily || 0), 0);

    return { total, fuel, maintenance, other };
  }, [filteredTrips]);

  const lista = (
    <div className="space-y-6 overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch', overscrollBehaviorX: 'contain', touchAction: 'pan-x' }} onKeyDown={handleEnterInContainer}>
      
      {/* Dashboard Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card p-4 border-l-4 border-blue-500 bg-white dark:bg-slate-800 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <div className="text-slate-500 dark:text-slate-400 text-sm font-medium uppercase tracking-wider">Custo Total</div>
              <div className="text-2xl font-bold text-slate-800 dark:text-white mt-1">R$ {summary.total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>
            <span className="material-icons text-blue-500 bg-blue-100 dark:bg-blue-900/30 p-2 rounded-lg">attach_money</span>
          </div>
        </div>
        <div className="card p-4 border-l-4 border-orange-500 bg-white dark:bg-slate-800 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <div className="text-slate-500 dark:text-slate-400 text-sm font-medium uppercase tracking-wider">Combustível</div>
              <div className="text-2xl font-bold text-slate-800 dark:text-white mt-1">R$ {summary.fuel.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              <div className="text-xs text-slate-400 mt-1">{summary.total > 0 ? ((summary.fuel / summary.total) * 100).toFixed(1) : 0}% do total</div>
            </div>
            <span className="material-icons text-orange-500 bg-orange-100 dark:bg-orange-900/30 p-2 rounded-lg">local_gas_station</span>
          </div>
        </div>
        <div className="card p-4 border-l-4 border-red-500 bg-white dark:bg-slate-800 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <div className="text-slate-500 dark:text-slate-400 text-sm font-medium uppercase tracking-wider">Manutenção</div>
              <div className="text-2xl font-bold text-slate-800 dark:text-white mt-1">R$ {summary.maintenance.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              <div className="text-xs text-slate-400 mt-1">{summary.total > 0 ? ((summary.maintenance / summary.total) * 100).toFixed(1) : 0}% do total</div>
            </div>
            <span className="material-icons text-red-500 bg-red-100 dark:bg-red-900/30 p-2 rounded-lg">build</span>
          </div>
        </div>
        <div className="card p-4 border-l-4 border-green-500 bg-white dark:bg-slate-800 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <div className="text-slate-500 dark:text-slate-400 text-sm font-medium uppercase tracking-wider">Outros / Diárias</div>
              <div className="text-2xl font-bold text-slate-800 dark:text-white mt-1">R$ {summary.other.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              <div className="text-xs text-slate-400 mt-1">{summary.total > 0 ? ((summary.other / summary.total) * 100).toFixed(1) : 0}% do total</div>
            </div>
            <span className="material-icons text-green-500 bg-green-100 dark:bg-green-900/30 p-2 rounded-lg">account_balance_wallet</span>
          </div>
        </div>
      </div>

      <div className="card p-6 grid grid-cols-1 md:grid-cols-9 gap-4">
        <input className={`input ${filters.startDate && !isValidDate(filters.startDate) && 'ring-red-500 border-red-500'}`} placeholder="Início (DD/MM/YYYY)" value={filters.startDate} onChange={(e) => setFilters({ ...filters, startDate: maskDate(e.target.value) })} />
        <input className={`input ${filters.endDate && !isValidDate(filters.endDate) && 'ring-red-500 border-red-500'}`} placeholder="Fim (DD/MM/YYYY)" value={filters.endDate} onChange={(e) => setFilters({ ...filters, endDate: maskDate(e.target.value) })} />
        <select className="select" value={filters.caminhaoId} onChange={(e) => setFilters({ ...filters, caminhaoId: e.target.value })}>
          <option value="" disabled>Caminhão</option>
          {trucks.map((t) => <option key={t.id} value={t.id}>{t.plate || t.model || t.id}</option>)}
        </select>
        <select className="select" value={filters.pranchaId} onChange={(e) => setFilters({ ...filters, pranchaId: e.target.value })}>
          <option value="" disabled>Prancha</option>
          {pranchas.map((p) => <option key={p.id} value={p.id}>{p.identifier || p.model || p.id}</option>)}
        </select>
        <select className="select" value={filters.driverId} onChange={(e) => setFilters({ ...filters, driverId: e.target.value })}>
          <option value="" disabled>Motorista</option>
          {drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <select className="select" value={filters.location} onChange={(e) => setFilters({ ...filters, location: e.target.value })}>
          <option value="" disabled>Local</option>
          <option value="Cambuí">Cambuí</option>
          <option value="Vale">Vale</option>
          <option value="Panorama">Panorama</option>
          <option value="Floresta">Floresta</option>
        </select>
        <select className="select" value={filters.aprovado} onChange={(e) => setFilters({ ...filters, aprovado: e.target.value })}>
          <option value="" disabled>Aprovado?</option>
          <option value="true">Sim</option>
          <option value="false">Não</option>
        </select>
        <input className="input" placeholder="Pesquisa" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} />
        <input className="input" placeholder="Min custo" value={filters.minCusto || ""} onChange={(e) => setFilters({ ...filters, minCusto: e.target.value })} />
        <input className="input" placeholder="Max custo" value={filters.maxCusto || ""} onChange={(e) => setFilters({ ...filters, maxCusto: e.target.value })} />
      </div>
      <div className="flex items-center gap-3">
        <button className="btn btn-primary" onClick={async () => {
          const r = filteredTrips;
          const header = ["Data","Viagem","Motorista","Caminhão","Prancha","Combustível","Manutenção","Outros","Total"];
          const lines = r.map((t) => {
            const fuel = (Number(t.fuel_liters || 0) * Number(t.fuel_price || 0)).toFixed(2);
            const maint = Number(t.maintenance_cost || 0).toFixed(2);
            const other = (Number(t.other_costs || 0) + Number(t.driver_daily || 0)).toFixed(2);
            const total = t.totalCost.toFixed(2);
            return [t.date, t.id, drivers.find(d=>d.id===t.driver_id)?.name||t.driver_id, trucks.find(x=>x.id===t.truck_id)?.plate||t.truck_id, pranchas.find(p=>p.id===t.prancha_id)?.asset_number||t.prancha_id, fuel, maint, other, total];
          });
          const csv = [header.join(","), ...lines.map((l) => l.join(","))].join("\n");
          const blob = new Blob([csv], { type: "text/csv" });
          const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "custos_viagens.csv"; a.click(); URL.revokeObjectURL(url); toast?.show("CSV exportado", "success");
        }}><span className="material-icons">download</span> CSV</button>
        <button className="btn btn-secondary" onClick={async () => {
          const r = filteredTrips;
          const { jsPDF } = await import("jspdf");
          const doc = new jsPDF();
          doc.setFontSize(16);
          doc.text("Relatório de Custos de Viagens", 105, 15, { align: "center" });
          doc.setFontSize(10);
          let y = 25;
          r.forEach((t) => { 
            const line = `Data: ${t.date} | Viagem: ${t.id} | Total: R$ ${t.totalCost.toFixed(2)}`; 
            doc.text(line, 10, y); y += 6; if (y > 280) { doc.addPage(); y = 15; } 
          });
          const blob = doc.output("blob");
          const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "custos_viagens.pdf"; a.click(); URL.revokeObjectURL(url); toast?.show("PDF exportado", "success");
        }}><span className="material-icons">picture_as_pdf</span> PDF</button>
      </div>
      <div className="card p-6 animate-fade overflow-x-auto hidden md:block">
        <table className="table min-w-[1100px]">
          <thead>
            <tr>
              <th>Data</th>
              <th>Viagem</th>
              <th>Motorista</th>
              <th>Caminhão</th>
              <th>Prancha</th>
              <th>Combustível</th>
              <th>Manutenção</th>
              <th>Outros</th>
              <th>Total</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {filteredTrips.slice((filters.page - 1) * filters.pageSize, filters.page * filters.pageSize).map((t, idx) => {
              const fuelCost = Number(t.fuel_liters || 0) * Number(t.fuel_price || 0);
              const maintCost = Number(t.maintenance_cost || 0);
              const otherCost = Number(t.other_costs || 0) + Number(t.driver_daily || 0);
              return (
              <tr key={t.id} className={`${idx % 2 === 0 ? 'bg-slate-50 dark:bg-slate-800' : 'bg-white dark:bg-slate-700'} hover:bg-slate-100 dark:hover:bg-slate-600`}>
                <td>{t.date ? String(t.date).slice(0,10) : "-"}</td>
                <td>#{t.id}</td>
                <td>{drivers.find((d) => String(d.id) === String(t.driver_id))?.name || t.driver_id || ""}</td>
                <td>{trucks.find((x) => String(x.id) === String(t.truck_id))?.plate || t.truck_id || ""}</td>
                <td>{pranchas.find((p) => String(p.id) === String(t.prancha_id))?.asset_number || t.prancha_id || ""}</td>
                <td>R$ {fuelCost.toFixed(2)}</td>
                <td>R$ {maintCost.toFixed(2)}</td>
                <td>R$ {otherCost.toFixed(2)}</td>
                <td className="font-bold">R$ {t.totalCost.toFixed(2)}</td>
                <td className="space-x-2">
                  <button className="btn bg-slate-600 hover:bg-slate-700 text-white" onClick={() => setViewing(t)}>Ver</button>
                </td>
              </tr>
            )})}
            {filteredTrips.length === 0 && <tr><td colSpan="10" className="text-center p-4">Nenhum registro encontrado</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="space-y-3 md:hidden">
        {filteredTrips.slice((filters.page - 1) * filters.pageSize, filters.page * filters.pageSize).map((t) => {
          const fuelCost = Number(t.fuel_liters || 0) * Number(t.fuel_price || 0);
          return (
          <div key={t.id} className="card p-4">
            <div className="flex justify-between items-center">
              <div className="font-semibold">{t.date}</div>
              <div className="text-sm">Viagem #{t.id}</div>
            </div>
            <div className="text-sm text-slate-600 dark:text-slate-300">Motorista: {drivers.find((d) => String(d.id) === String(t.driver_id))?.name || t.driver_id || ""}</div>
            <div className="mt-2 font-bold text-lg">Total: R$ {t.totalCost.toFixed(2)}</div>
            <div className="text-xs text-slate-500">Combustível: R$ {fuelCost.toFixed(2)}</div>
            <div className="mt-2 flex flex-wrap gap-2">
              <button className="btn bg-slate-600 hover:bg-slate-700 text-white" onClick={() => setViewing(t)}>Ver Detalhes</button>
            </div>
          </div>
        )})}
      </div>
      <div className="flex items-center justify-between mt-4 p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-100 dark:border-slate-700">
        <div className="text-sm text-slate-500 dark:text-slate-400">
          Página {filters.page} de {Math.ceil(totalRows / filters.pageSize) || 1}
        </div>
        <div className="flex items-center gap-2">
          <button
            className="btn btn-sm border border-slate-300 dark:border-slate-600"
            disabled={filters.page <= 1}
            onClick={() => setFilters({ ...filters, page: Math.max(1, Number(filters.page) - 1) })}
          >
            Anterior
          </button>
          <button
            className="btn btn-sm border border-slate-300 dark:border-slate-600"
            disabled={filters.page * filters.pageSize >= totalRows}
            onClick={() => setFilters({ ...filters, page: Number(filters.page) + 1 })}
          >
            Próxima
          </button>
          <select
            className="select select-sm !py-1 dark:bg-slate-700 dark:border-slate-600"
            value={filters.pageSize}
            onChange={(e) => setFilters({ ...filters, pageSize: Number(e.target.value), page: 1 })}
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
        </div>
      </div>
    </div>
  );

  const relatoriosData = useMemo(() => {
    const rows = trips.map(t => {
      const fuel = Number(t.fuel_liters||0) * Number(t.fuel_price||0);
      const maint = Number(t.maintenance_cost||0);
      const driver = Number(t.driver_daily||0);
      const other = Number(t.other_costs||0);
      const total = fuel + maint + driver + other;
      return {
        ...t,
        custoTotal: total,
        custoCombustivel: fuel,
        manutencao: maint,
        diariaMotorista: driver,
        outros: other,
        kmRodado: Number(t.km_rodado||0),
        dataRegistro: t.date || "",
        caminhaoId: t.truck_id
      };
    });

    const totalPeriodo = rows.reduce((a, c) => a + c.custoTotal, 0);
    const kmTotal = rows.reduce((a, c) => a + c.kmRodado, 0);
    const horasTotal = rows.reduce((a, c) => a + Number(c.horas || 0), 0);
    const mediaKm = kmTotal ? totalPeriodo / kmTotal : 0;
    const mediaHora = horasTotal ? totalPeriodo / horasTotal : 0;
    const meses = rows.reduce((acc, c) => { const m = String(c.dataRegistro).slice(0,7); const f = acc.find((x) => x.month === m) || { month: m, total: 0, km: 0 }; f.total += c.custoTotal; f.km += c.kmRodado; if (!acc.find((x) => x.month === m)) acc.push(f); return acc; }, []);
    meses.sort((a,b) => a.month.localeCompare(b.month));
    
    const dist = [
      { name: "Combustível", value: rows.reduce((a, c) => a + c.custoCombustivel, 0) },
      { name: "Manutenção", value: rows.reduce((a, c) => a + c.manutencao, 0) },
      { name: "Diárias", value: rows.reduce((a, c) => a + c.diariaMotorista, 0) },
      { name: "Outros", value: rows.reduce((a, c) => a + c.outros, 0) }
    ];
    const porCaminhao = trucks.map((t) => ({ truck: t.plate || t.model || String(t.id), total: rows.filter((c) => String(c.caminhaoId || "") === String(t.id)).reduce((a, c) => a + c.custoTotal, 0) })).sort((a,b)=> b.total - a.total).slice(0,10);
    return { totalPeriodo, mediaKm, mediaHora, meses, dist, porCaminhao };
  }, [trips, trucks]);

  const relatorios = (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card p-6"><div className="text-sm">Total no período</div><div className="text-3xl font-bold">R$ {relatoriosData.totalPeriodo.toFixed(2)}</div></div>
        <div className="card p-6"><div className="text-sm">Média custo/km</div><div className="text-3xl font-bold">R$ {relatoriosData.mediaKm.toFixed(2)}</div></div>
        <div className="card p-6"><div className="text-sm">Média custo/hora</div><div className="text-3xl font-bold">R$ {relatoriosData.mediaHora.toFixed(2)}</div></div>
        <div className="card p-6"><div className="text-sm">Registros</div><div className="text-3xl font-bold">{custos.length}</div></div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card p-6">
          <div className="font-semibold mb-4">Custo total por mês</div>
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={relatoriosData.meses}>
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="total" fill="#2563eb" radius={[8,8,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card p-6">
          <div className="font-semibold mb-4">Custo médio por km</div>
          <div className="h-72">
            <ResponsiveContainer>
              <LineChart data={relatoriosData.meses.map((m) => ({ month: m.month, value: m.km ? m.total / m.km : 0 }))}>
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="value" stroke="#38bdf8" strokeWidth={3} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card p-6">
          <div className="font-semibold mb-4">Distribuição de custos</div>
          <div className="h-72">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={relatoriosData.dist} dataKey="value" nameKey="name" outerRadius={110}>
                  {relatoriosData.dist.map((_, i) => (
                    <Cell key={i} fill={colors[i % colors.length]} stroke="#ffffff" />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      <div className="card p-6">
        <div className="font-semibold mb-4">Custo por caminhão (top 10)</div>
        <div className="h-72">
          <ResponsiveContainer>
            <BarChart data={relatoriosData.porCaminhao}>
              <XAxis dataKey="truck" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="total" fill="#22c55e" radius={[8,8,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );

  const novo = (
    <div className="space-y-6" onKeyDown={handleEnterInContainer}>
      <div className="card p-6">
        <div className="font-semibold mb-4 text-secondary text-xl">Novo custo</div>
        <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-4 gap-4" onKeyDown={handleEnterInContainer}>
          <select className="select" value={form.viagemId} onChange={(e) => handleTripLink(e.target.value)}>
            <option value="" disabled>Vincular viagem</option>
            {trips.map((t) => <option key={t.id} value={t.id}>{t.id} - {t.date}</option>)}
          </select>
          <input className={`input ${form.dataRegistro && !isValidDate(form.dataRegistro) && 'ring-red-500 border-red-500'}`} placeholder="Data registro (DD/MM/YYYY)" value={form.dataRegistro} onChange={(e) => setForm({ ...form, dataRegistro: maskDate(e.target.value) })} />
          <select className="select" value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })}>
            <option>Máquinas Agrícolas</option>
            <option>Máquinas de Construção</option>
            <option>Equipamentos Industriais</option>
            <option>Veículos Pesados</option>
            <option>Veículos Leves</option>
          </select>
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.noFuel} onChange={(e) => setForm({ ...form, noFuel: e.target.checked, consumoLitros: e.target.checked ? 0 : form.consumoLitros, valorLitro: e.target.checked ? 0 : form.valorLitro })} /> <span>Não houve gasto de combustível</span></label>
          <input className="input" disabled={form.noFuel} placeholder="Consumo (litros)" value={form.consumoLitros} onChange={(e) => setForm({ ...form, consumoLitros: e.target.value })} />
          <input className="input" disabled={form.noFuel} placeholder="Valor por litro" value={form.valorLitro} onChange={(e) => setForm({ ...form, valorLitro: e.target.value })} />
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.noDaily} onChange={(e) => setForm({ ...form, noDaily: e.target.checked, diariaMotorista: e.target.checked ? 0 : form.diariaMotorista })} /> <span>Não houve diária</span></label>
          <input className="input" disabled={form.noDaily} placeholder="Diária motorista" value={form.diariaMotorista} onChange={(e) => setForm({ ...form, diariaMotorista: e.target.value })} />
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.noToll} onChange={(e) => setForm({ ...form, noToll: e.target.checked, pedagios: e.target.checked ? 0 : form.pedagios })} /> <span>Não houve pedágios</span></label>
          <input className="input" disabled={form.noToll} placeholder="Pedágios" value={form.pedagios} onChange={(e) => setForm({ ...form, pedagios: e.target.value })} />
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.noMaint} onChange={(e) => setForm({ ...form, noMaint: e.target.checked, manutencao: e.target.checked ? 0 : form.manutencao })} /> <span>Não houve manutenção</span></label>
          <input className="input" disabled={form.noMaint} placeholder="Manutenção" value={form.manutencao} onChange={(e) => setForm({ ...form, manutencao: e.target.value })} />
          <input className="input" placeholder="KM rodado" value={form.kmRodado || ""} onChange={(e) => setForm({ ...form, kmRodado: e.target.value })} />
          <input className="input" placeholder="Tempo (horas)" value={form.tempoHoras || ""} onChange={(e) => setForm({ ...form, tempoHoras: e.target.value })} />
          <div className="md:col-span-4">
            <div className="flex gap-2">
              <input className="input" placeholder="Descrição" value={addingOther.descricao} onChange={(e) => setAddingOther({ ...addingOther, descricao: e.target.value })} />
              <input className="input" placeholder="Valor" value={addingOther.valor} onChange={(e) => setAddingOther({ ...addingOther, valor: e.target.value })} />
              <button type="button" className="btn btn-secondary" onClick={addOther}>Adicionar</button>
            </div>
          <div className="mt-2">
            {(form.outrosCustos || []).map((o, i) => (
              <div key={i} className="flex items-center justify-between py-2">
                <div>{o.descricao}</div>
                <div>R$ {Number(o.valor).toFixed(2)}</div>
              </div>
            ))}
          </div>
        </div>
          <textarea className="input md:col-span-4" placeholder="Observações" value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
          <div className="md:col-span-4">
            <div className="font-medium mb-2">Anexos</div>
            <input type="file" multiple onChange={handleFiles} />
            <div className="mt-2 text-sm">{(form.anexos||[]).length} arquivo(s) selecionado(s)</div>
          </div>
          <div className="md:col-span-4 flex gap-2">
            <button type="button" className="btn" onClick={() => {
              const consumoLitros = Number(form.noFuel ? 0 : form.consumoLitros || 0);
              const valorLitro = Number(form.noFuel ? 0 : form.valorLitro || 0);
              const diariaMotorista = Number(form.noDaily ? 0 : form.diariaMotorista || 0);
              const pedagios = Number(form.noToll ? 0 : form.pedagios || 0);
              const manutencao = Number(form.noMaint ? 0 : form.manutencao || 0);
              const outros = (form.outrosCustos || []).reduce((a, it) => a + Number(it.valor || 0), 0);
              const custoCombustivel = consumoLitros * valorLitro;
              const subtotal = custoCombustivel + diariaMotorista + pedagios + manutencao + outros;
              const km = Number(form.kmRodado || 0);
              const porKm = km > 0 ? subtotal / km : 0;
              setCalc({ custoCombustivel, subtotal, porKm });
              toast?.show("Cálculo atualizado", "success");
            }}>Calcular</button>
            <button className="btn btn-primary">{editingId ? "Salvar" : "Cadastrar"}</button>
            <button type="button" className="btn bg-gray-500 hover:bg-gray-600 text-white" onClick={() => { setForm({ viagemId: "", dataRegistro: "", consumoLitros: "", valorLitro: "", diariaMotorista: "", pedagios: "", manutencao: "", outrosCustos: [], observacoes: "", anexos: [] }); setEditingId(null); localStorage.removeItem("costs_form_draft"); setTab("lista"); }}>Cancelar</button>
            <button type="button" className="btn btn-secondary" onClick={() => { toast?.show("Solicitação de aprovação registrada", "success"); setTab("lista"); }}>Solicitar aprovação</button>
          </div>
        </form>
      </div>
      {calc && (
        <div className="card p-6">
          <div className="font-semibold mb-2">Passo-a-passo</div>
          <div>Combustível: R$ {Number(calc.custoCombustivel).toFixed(2)}</div>
          <div>Subtotal: R$ {Number(calc.subtotal).toFixed(2)}</div>
          <div>Custo por km: R$ {Number(calc.porKm).toFixed(4)}</div>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-8 min-h-screen page">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-accent rounded-xl flex items-center justify-center text-white">💸</div>
        <button className={`btn ${tab === "lista" ? "btn-primary" : "btn-secondary"}`} onClick={() => setTab("lista")}>Lista</button>
        <button className={`btn ${tab === "novo" ? "btn-primary" : "btn-secondary"}`} onClick={() => { setEditingId(null); setTab("novo"); }}>Novo custo</button>
        <button className={`btn ${tab === "relatorios" ? "btn-primary" : "btn-secondary"}`} onClick={() => setTab("relatorios")}>Relatórios</button>
      </div>
      {tab === "lista" && lista}
      {tab === "novo" && novo}
      {tab === "relatorios" && relatorios}

      {viewing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="card p-6 w-full max-w-2xl animate-fade">
            <div className="flex justify-between items-start mb-4">
               <h3 className="text-xl font-bold text-slate-800 dark:text-white">Detalhes do Custo da Viagem #{viewing.id}</h3>
               <button onClick={() => setViewing(null)} className="text-slate-500 hover:text-slate-700">
                 <span className="material-icons">close</span>
               </button>
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="block text-slate-500">Data</span>
                <span className="font-medium">{viewing.date ? String(viewing.date).slice(0,10) : "-"}</span>
              </div>
              <div>
                <span className="block text-slate-500">Viagem</span>
                <span className="font-medium">#{viewing.id}</span>
              </div>
              <div>
                <span className="block text-slate-500">Caminhão</span>
                <span className="font-medium">{trucks.find((t) => String(t.id) === String(viewing.truck_id))?.plate || viewing.truck_id || "-"}</span>
              </div>
              <div>
                <span className="block text-slate-500">Prancha</span>
                <span className="font-medium">{pranchas.find((p) => String(p.id) === String(viewing.prancha_id))?.asset_number || viewing.prancha_id || "-"}</span>
              </div>
              <div>
                <span className="block text-slate-500">Motorista</span>
                <span className="font-medium">{drivers.find((d) => String(d.id) === String(viewing.driver_id))?.name || viewing.driver_id || "-"}</span>
              </div>
              <div>
                <span className="block text-slate-500">KM Rodado</span>
                <span className="font-medium">{viewing.km_rodado || 0} km</span>
              </div>
            </div>

            <div className="my-4 border-t border-slate-200 dark:border-slate-700"></div>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="block text-slate-500">Combustível</span>
                <span className="font-medium">R$ {((Number(viewing.fuel_liters)||0) * (Number(viewing.fuel_price)||0)).toFixed(2)}</span>
                <div className="text-xs text-slate-400">{viewing.fuel_liters || 0} L x R$ {viewing.fuel_price || 0}</div>
              </div>
              <div>
                <span className="block text-slate-500">Manutenção</span>
                <span className="font-medium">R$ {Number(viewing.maintenance_cost||0).toFixed(2)}</span>
              </div>
              <div>
                <span className="block text-slate-500">Diária Motorista</span>
                <span className="font-medium">R$ {Number(viewing.driver_daily||0).toFixed(2)}</span>
              </div>
              <div>
                <span className="block text-slate-500">Outros</span>
                <span className="font-medium">R$ {Number(viewing.other_costs||0).toFixed(2)}</span>
              </div>
            </div>

            <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-700 rounded-lg flex justify-between items-center">
              <span className="font-bold text-slate-700 dark:text-slate-200">Custo Total</span>
              <span className="text-xl font-bold text-green-600 dark:text-green-400">R$ {Number(viewing.totalCost||0).toFixed(2)}</span>
            </div>

            {viewing.description && (
              <div className="mt-4">
                 <div className="font-medium mb-1">Descrição / Observações</div>
                 <div className="text-sm p-2 bg-slate-50 dark:bg-slate-800 rounded text-slate-600 dark:text-slate-400">{viewing.description}</div>
              </div>
            )}

            <div className="mt-6 flex justify-end gap-2">
              <button className="btn bg-slate-200 text-slate-800 hover:bg-slate-300" onClick={() => setViewing(null)}>Fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

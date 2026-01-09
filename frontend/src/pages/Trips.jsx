import { useEffect, useState, useRef } from "react";
import { useLocation } from "react-router-dom";
import { getMotoristas, getViagens, getViagem, saveViagem, updateViagem, deleteViagem, getCaminhoes, getPranchas, getCustos } from "../services/storageService.js";
import { useToast } from "../components/ToastProvider.jsx";

export default function Trips() {
  const toast = useToast();
  const location = useLocation();
  const [drivers, setDrivers] = useState([]);
  const [trucks, setTrucks] = useState([]);
  const [pranchas, setPranchas] = useState([]);
  const [items, setItems] = useState([]);
  const tipoOptions = ["Máquinas Agrícolas","Máquinas de Construção","Equipamentos Industriais","Veículos Pesados","Veículos Leves"];
  const [form, setForm] = useState(() => {
    const saved = localStorage.getItem("trips_form_draft");
    return saved ? JSON.parse(saved) : { date: "", end_date: "", requester: "", driver_id: "", truck_id: "", prancha_id: "", destination: "", service_type: "", status: "", description: "", start_time: "", end_time: "", km_start: "", km_end: "", km_trip: "", km_per_liter: "", noKmStart: false, noKmEnd: false, fuel_liters: "", noFuelLiters: false, fuel_price: "", noFuelPrice: false, other_costs: "", noOtherCosts: false, maintenance_cost: "", noMaintenanceCost: false, driver_daily: "", noDriverDaily: false };
  });
  
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [kmMode, setKmMode] = useState("");
  const [showValidation, setShowValidation] = useState(false);
  const formRef = useRef(null);
  const lastSubmitTime = useRef(0);

  useEffect(() => {
    if (!editing) {
      localStorage.setItem("trips_form_draft", JSON.stringify(form));
    }
  }, [form, editing]);

  // Force re-render/cache bust check
  useEffect(() => { console.log("Trips component loaded v1.0.1"); }, []);

  const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });
  const [statusFilter, setStatusFilter] = useState("");
  const statusFilterRef = useRef(statusFilter);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const pageSize = 20;

  const loadDrivers = () => getMotoristas().then((r) => setDrivers(r));
  const loadTrucks = () => getCaminhoes().then((r) => setTrucks(r.filter((x) => x.status === "Ativo")));
  const loadPranchas = () => getPranchas().then((r) => setPranchas(r.filter((x) => x.status === "Ativo")));

  const loadTrips = () => {
    const opts = { page, pageSize };
    if (statusFilterRef.current) opts.status = statusFilterRef.current;
    getViagens(opts).then((r) => {
      setItems(r.data);
      setTotalPages(Math.ceil(r.total / pageSize));
    });
  };
  
  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
    }
  };

  useEffect(() => {
    loadTrips();
  }, [page]);
  
  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedItems = [...items].sort((a, b) => {
    if (!sortConfig.key) return 0;
    
    let valA = a[sortConfig.key];
    let valB = b[sortConfig.key];
    
    if (sortConfig.key === 'id') {
        return sortConfig.direction === 'asc' ? Number(valA) - Number(valB) : Number(valB) - Number(valA);
    }
    
    if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
    if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  useEffect(() => {
    statusFilterRef.current = statusFilter;
    loadTrips();
  }, [statusFilter]);

  useEffect(() => {
    loadDrivers();
    loadTrucks();
    loadPranchas();
    loadTrips();

    let channels = [];
    const setupRealtime = async () => {
      const { supabase } = await import("../services/supabaseClient.js");
      if (!supabase) return;

      const ch1 = supabase
        .channel("public:viagens")
        .on("postgres_changes", { event: "*", schema: "public", table: "viagens" }, () => { loadTrips(); })
        .subscribe();
      const ch2 = supabase
        .channel("public:motoristas")
        .on("postgres_changes", { event: "*", schema: "public", table: "motoristas" }, () => { loadDrivers(); })
        .subscribe();
      const ch3 = supabase
        .channel("public:caminhoes")
        .on("postgres_changes", { event: "*", schema: "public", table: "caminhoes" }, () => { loadTrucks(); })
        .subscribe();
      const ch4 = supabase
        .channel("public:pranchas")
        .on("postgres_changes", { event: "*", schema: "public", table: "pranchas" }, () => { loadPranchas(); })
        .subscribe();
      
      channels = [ch1, ch2, ch3, ch4];
    };

    setupRealtime();

    const interval = setInterval(() => { loadTrips(); }, 10000);
    return () => {
      import("../services/supabaseClient.js").then(({ supabase }) => {
        if (supabase) {
           channels.forEach(ch => supabase.removeChannel(ch));
        }
      });
        clearInterval(interval);
      };
  }, []);
  useEffect(() => {
    const id = new URLSearchParams(location.search).get("editId");
    if (id) {
      getViagem(id).then((it) => {
        setEditing(it);
        setForm({
          date: it.date ? fromIsoDate(it.date) : "",
          end_date: it.end_date ? fromIsoDate(it.end_date) : "",
          requester: it.requester || "",
          driver_id: it.driver_id?.toString() || "",
          truck_id: it.truck_id?.toString() || "",
          prancha_id: it.prancha_id?.toString() || "",
          destination: it.destination || "",
          service_type: it.service_type || "",
          description: it.description || "",
          start_time: it.start_time || "",
          end_time: it.end_time || "",
          km_start: it.km_start?.toString() || "",
          km_end: it.km_end?.toString() || "",
          noKmStart: false,
          noKmEnd: false,
          fuel_liters: it.fuel_liters?.toString() || "",
          fuel_price: it.fuel_price?.toString() || "",
          other_costs: it.other_costs?.toString() || ""
        });
      });
    }
  }, [location.search]);

  const maskDate = (v) => {
    const digits = v.replace(/\D/g, "").slice(0,8);
    const p1 = digits.slice(0,2);
    const p2 = digits.slice(2,4);
    const p3 = digits.slice(4,8);
    return [p1, p2, p3].filter(Boolean).join("/");
  };
  const normalizeDate = (s) => {
    const m2 = (s || "").match(/^(\d{2})\/(\d{2})\/(\d{2})$/);
    if (m2) {
      const d = m2[1]; const mo = m2[2]; const yy = Number(m2[3]);
      const y = 2000 + yy;
      return `${d}/${mo}/${y}`;
    }
    const m4 = (s || "").match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (m4) return s;
    return null;
  };
  const isValidDate = (s) => {
    const full = normalizeDate(s);
    if (!full) return false;
    const m = full.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!m) return false;
    const d = Number(m[1]); const mo = Number(m[2]) - 1; const y = Number(m[3]);
    const dt = new Date(y, mo, d);
    return dt.getFullYear() === y && dt.getMonth() === mo && dt.getDate() === d;
  };
  const isValidTime = (hhmm) => /^([01]\d|2[0-3]):[0-5]\d$/.test(hhmm || "");
  const maskTime = (v) => {
    const d = String(v || "").replace(/\D/g, "").slice(0,4);
    const h = d.slice(0,2);
    const m = d.slice(2,4);
    return [h, m].filter(Boolean).join(":");
  };
  const toIsoDate = (s) => {
    const full = normalizeDate(s);
    if (!full) return "";
    const [d, m, y] = full.split("/").map(Number);
    return `${y}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
  };
  const fromIsoDate = (iso) => {
    const [y, m, d] = iso.split("-").map(Number);
    return `${String(d).padStart(2,"0")}/${String(m).padStart(2,"0")}/${y}`;
  };

  const getErrors = () => {
    const errs = {};
    if (!form.date) errs.date = "Campo obrigatório";
    else if (!isValidDate(form.date)) errs.date = "Data inválida";

    if (!form.requester) errs.requester = "Campo obrigatório";
    if (!form.driver_id) errs.driver_id = "Campo obrigatório";
    if (!form.truck_id) errs.truck_id = "Campo obrigatório";
    if (!form.prancha_id) errs.prancha_id = "Campo obrigatório";
    if (!form.destination) errs.destination = "Campo obrigatório";
    if (!form.service_type) errs.service_type = "Campo obrigatório";
    if (!form.status) errs.status = "Campo obrigatório";

    if (!form.start_time) errs.start_time = "Campo obrigatório";
    else if (!isValidTime(form.start_time)) errs.start_time = "Hora inválida";

    if (!form.noKmStart && form.km_start === "") errs.km_start = "Campo obrigatório";
    
    if (form.end_time && !isValidTime(form.end_time)) errs.end_time = "Hora inválida";
    
    if (form.end_date && !isValidDate(form.end_date)) errs.end_date = "Data inválida";
    
    if (form.km_trip !== "") {
       const vkm = Number(form.km_trip);
       if (!(vkm >= 0)) errs.km_trip = "Não pode ser negativo";
    }
    
    if (!errs.km_start && !errs.km_end && !form.noKmStart && !form.noKmEnd && form.km_end !== "" && form.km_start !== "") {
        if (Number(form.km_end) < Number(form.km_start)) {
            errs.km_end = "Menor que KM inicial";
        }
    }
    return errs;
  };
  const validationErrors = showValidation ? getErrors() : {};

  const submit = async (e) => {
    e.preventDefault();
    
    setShowValidation(true);
    const errs = getErrors();
    if (Object.keys(errs).length > 0) {
        toast?.show("Verifique os campos obrigatórios", "error");
        if (formRef.current) formRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
    }

    const now = Date.now();
    if (now - lastSubmitTime.current < 3000) {
      toast?.show("Aguarde um momento antes de enviar novamente", "warning");
      return;
    }
    lastSubmitTime.current = now;

    const payload = {
      ...form,
      date: isValidDate(form.date) ? toIsoDate(form.date) : "",
      end_date: isValidDate(form.end_date) ? toIsoDate(form.end_date) : (isValidDate(form.date) ? toIsoDate(form.date) : ""),
      driver_id: form.driver_id ? Number(form.driver_id) : null,
      truck_id: form.truck_id ? Number(form.truck_id) : null,
      prancha_id: form.prancha_id ? (pranchas.find((p) => String(p.asset_number || "") === String(form.prancha_id))?.id ?? null) : null,
      km_start: form.noKmStart ? null : (form.km_start !== "" ? Number(form.km_start) : null),
      km_end: form.noKmEnd ? null : (form.km_end !== "" ? Number(form.km_end) : null),
      fuel_liters: form.fuel_liters !== "" ? Number(form.fuel_liters) : 0,
      fuel_price: form.fuel_price !== "" ? Number(form.fuel_price) : 0,
      other_costs: form.other_costs !== "" ? Number(form.other_costs) : 0
    };
    if (form.km_trip !== "" && form.km_per_liter !== "") {
      const kmTripNum = Number(form.km_trip);
      const perLNum = Number(String(form.km_per_liter).replace(",", "."));
      if (perLNum > 0) payload.fuel_liters = Number((kmTripNum / perLNum).toFixed(2));
      else toast?.show("KM por litro inválido", "warning");
    }
    
    payload.requester = form.requester;
    payload.status = form.status;
    if (editing) {
      await updateViagem(editing.id, payload);
    } else {
      if (payload.truck_id && payload.km_start) {
        const { data: activeTrips } = await getViagens({ truckId: payload.truck_id, status: "Em Andamento" });
        if (activeTrips && activeTrips.length > 0) {
          const lastTrip = activeTrips[0];
          const lastKmStart = lastTrip.km_start != null ? Number(lastTrip.km_start) : 0;
          if (lastTrip.km_start != null && payload.km_start < lastKmStart) {
            toast?.show(`KM inicial (${payload.km_start}) não pode ser menor que o KM inicial da viagem pendente (${lastKmStart})`, "error");
            return;
          }
          await updateViagem(lastTrip.id, {
            ...lastTrip,
            km_end: payload.km_start,
            status: "Finalizado",
            end_date: payload.date
          });
          toast?.show("Viagem anterior finalizada e KM atualizado", "info");
        }
      }
      await saveViagem(payload);
    }
    toast?.show(editing ? "Viagem atualizada" : "Viagem cadastrada", "success");
    localStorage.removeItem("trips_form_draft");
    setForm({ date: "", end_date: "", requester: "", driver_id: "", truck_id: "", prancha_id: "", destination: "", service_type: "", status: "", description: "", start_time: "", end_time: "", km_start: "", km_end: "", km_trip: "", km_per_liter: "", noKmStart: false, noKmEnd: false, fuel_liters: "", noFuelLiters: false, fuel_price: "", noFuelPrice: false, other_costs: "", noOtherCosts: false, maintenance_cost: "", noMaintenanceCost: false, driver_daily: "", noDriverDaily: false });
    setEditing(null);
    setShowForm(false);
    setShowValidation(false);
    loadTrips();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleFormKeyDown = (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const formEl = e.currentTarget;
    const focusables = Array.from(formEl.querySelectorAll("input, select, textarea, button")).filter((el) => !el.disabled && el.tabIndex !== -1 && el.type !== "hidden");
    const idx = focusables.indexOf(document.activeElement);
    const next = focusables[idx + 1];
    if (next) next.focus();
  };

  const edit = (it) => {
    setEditing(it);
    setShowForm(true);
    setShowValidation(true);
    
    // Determinar modo de KM
    if (it.km_start != null || it.km_end != null) {
      setKmMode("KM Caminhão");
    } else if (it.km_rodado != null && it.km_rodado > 0) {
      setKmMode("KM da Viagem");
    } else {
      setKmMode("KM Caminhão"); // Default
    }

    setForm({
      date: it.date ? fromIsoDate(it.date) : "",
      end_date: it.end_date ? fromIsoDate(it.end_date) : "",
      requester: it.requester || "",
      driver_id: it.driver_id?.toString() || "",
      truck_id: it.truck_id?.toString() || "",
      prancha_id: (pranchas.find((p) => p.id === it.prancha_id)?.asset_number?.toString()) || "",
      destination: it.destination || "",
      service_type: it.service_type || "",
      status: it.status || "",
      description: it.description || "",
      start_time: it.start_time || "",
      end_time: it.end_time || "",
      km_start: it.km_start != null ? String(it.km_start) : "",
      km_end: it.km_end != null ? String(it.km_end) : "",
      km_trip: (it.km_rodado != null ? String(it.km_rodado) : ((it.km_start != null && it.km_end != null) ? String(Math.max(0, Number(it.km_end) - Number(it.km_start))) : "")),
      noKmStart: it.km_start === null,
      noKmEnd: it.km_end === null,
      fuel_liters: it.fuel_liters ? String(it.fuel_liters) : "",
      noFuelLiters: !it.fuel_liters,
      fuel_price: it.fuel_price ? String(it.fuel_price) : "",
      noFuelPrice: !it.fuel_price,
      other_costs: it.other_costs ? String(it.other_costs) : "",
      noOtherCosts: !it.other_costs,
      maintenance_cost: it.maintenance_cost ? String(it.maintenance_cost) : "",
      noMaintenanceCost: !it.maintenance_cost,
      driver_daily: it.driver_daily ? String(it.driver_daily) : "",
      noDriverDaily: !it.driver_daily
    });
    toast?.show("Edição carregada", "info");
    setTimeout(() => {
      if (formRef.current) formRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      else window.scrollTo({ top: 0, behavior: "smooth" });
    }, 100);
  };

  const del = async (id) => { await deleteViagem(id); toast?.show("Viagem excluída", "success"); loadTrips(); };
  const delConfirm = async (id) => { if (!window.confirm("Confirma excluir esta viagem?")) return; await del(id); };

  useEffect(() => {
    if (!editing) {
      localStorage.setItem("trips_form_draft", JSON.stringify(form));
    }
  }, [form, editing]);

  return (
    <div className="space-y-8 overflow-x-auto overflow-y-auto min-h-screen page" style={{ WebkitOverflowScrolling: 'touch', overscrollBehaviorX: 'contain', overscrollBehaviorY: 'contain', touchAction: 'pan-y' }}>
      
      {!showForm && !editing && (
        <div className="flex flex-col md:flex-row justify-between items-center mb-4 gap-4">
          <div className="flex items-center gap-2 w-full md:w-auto">
             <select 
               className="select w-full md:w-48" 
               value={statusFilter} 
               onChange={(e) => setStatusFilter(e.target.value)}
             >
               <option value="">Todos os Status</option>
               <option value="Em Andamento">Em Andamento</option>
               <option value="Finalizado">Finalizado</option>
               <option value="Previsto">Previsto</option>
             </select>
          </div>
          <button className="btn btn-primary w-full md:w-auto" onClick={() => setShowForm(true)}>Novo</button>
        </div>
      )}

      {(showForm || editing) && (
      <div ref={formRef} className="card p-6 animate-fade">
        <div className="font-semibold mb-4 text-secondary text-xl">Cadastro de Viagens</div>
        <form onSubmit={submit} onKeyDown={handleFormKeyDown} className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="flex flex-col">
            <input className={`input ${validationErrors.date ? 'ring-red-500 border-red-500' : ''}`} placeholder="Data (DD/MM/YY) *" value={form.date} onChange={(e) => setForm({ ...form, date: maskDate(e.target.value) })} />
            {validationErrors.date && <span className="text-red-500 text-xs mt-1">{validationErrors.date}</span>}
          </div>
          <div className="flex flex-col">
            <input className={`input ${validationErrors.requester ? 'ring-red-500 border-red-500' : ''}`} placeholder="Solicitante *" value={form.requester} onChange={(e) => setForm({ ...form, requester: e.target.value })} />
            {validationErrors.requester && <span className="text-red-500 text-xs mt-1">{validationErrors.requester}</span>}
          </div>
          <div className="flex flex-col">
            <select className={`select ${validationErrors.driver_id ? 'ring-red-500 border-red-500' : ''}`} value={form.driver_id} onChange={(e) => setForm({ ...form, driver_id: e.target.value })}>
              <option value="" disabled>Motorista *</option>
              {drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            {validationErrors.driver_id && <span className="text-red-500 text-xs mt-1">{validationErrors.driver_id}</span>}
          </div>
          <div className="flex flex-col">
            <select className={`select ${validationErrors.truck_id ? 'ring-red-500 border-red-500' : ''}`} value={form.truck_id} onChange={(e) => {
              const val = e.target.value;
              const tr = trucks.find((t) => t.id === Number(val));
              setForm({ ...form, truck_id: val, km_start: tr && tr.km_current != null ? String(tr.km_current).slice(0, 10) : form.km_start });
            }}>
              <option value="" disabled>Caminhão (Frota) *</option>
              {trucks.map((t) => <option key={t.id} value={t.id}>{t.fleet || t.plate || t.model || t.id}</option>)}
            </select>
            {validationErrors.truck_id && <span className="text-red-500 text-xs mt-1">{validationErrors.truck_id}</span>}
          </div>
          <div className="flex flex-col">
            <select className={`select ${validationErrors.prancha_id ? 'ring-red-500 border-red-500' : ''}`} value={form.prancha_id} onChange={(e) => setForm({ ...form, prancha_id: e.target.value })}>
              <option value="" disabled>Prancha *</option>
              {pranchas.map((p) => <option key={p.id} value={p.asset_number || ''}>{p.asset_number || "Reboque"}{p.is_set && p.asset_number2 ? ` / ${p.asset_number2}` : ""}</option>)}
            </select>
            {validationErrors.prancha_id && <span className="text-red-500 text-xs mt-1">{validationErrors.prancha_id}</span>}
          </div>
          <div className="flex flex-col">
            <input className={`input ${validationErrors.destination ? 'ring-red-500 border-red-500' : ''}`} placeholder="Destino *" value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} />
            {validationErrors.destination && <span className="text-red-500 text-xs mt-1">{validationErrors.destination}</span>}
          </div>
          <div className="flex flex-col">
            <select className={`select ${validationErrors.service_type ? 'ring-red-500 border-red-500' : ''}`} value={form.service_type} onChange={(e) => setForm({ ...form, service_type: e.target.value })}>
              <option value="" disabled>Tipo *</option>
              {tipoOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
            </select>
            {validationErrors.service_type && <span className="text-red-500 text-xs mt-1">{validationErrors.service_type}</span>}
          </div>
          <div className="flex flex-col">
            <select className={`select ${validationErrors.status ? 'ring-red-500 border-red-500' : ''}`} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="" disabled>Status *</option>
              <option value="Previsto">Previsto</option>
              <option value="Em Andamento">Em Andamento</option>
              <option value="Finalizado">Finalizado</option>
            </select>
            {validationErrors.status && <span className="text-red-500 text-xs mt-1">{validationErrors.status}</span>}
          </div>
          <div className="flex flex-col md:col-span-4">
            <input className="input" placeholder="Descrição" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="flex flex-col">
            <input className={`input ${validationErrors.start_time ? 'ring-red-500 border-red-500' : ''}`} placeholder="Hora saída (HH:MM) *" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: maskTime(e.target.value), end_date: (!form.end_date && isValidDate(form.date)) ? form.date : form.end_date })} />
            {validationErrors.start_time && <span className="text-red-500 text-xs mt-1">{validationErrors.start_time}</span>}
          </div>
          <div className="flex flex-col">
            <input className={`input ${validationErrors.end_date ? 'ring-red-500 border-red-500' : (!form.end_date || !isValidDate(form.end_date) ? 'ring-yellow-500 border-yellow-500' : '')}`} placeholder="Data retorno (DD/MM/YY)" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: maskDate(e.target.value) })} />
            {validationErrors.end_date && <span className="text-red-500 text-xs mt-1">{validationErrors.end_date}</span>}
          </div>
          <div className="flex flex-col">
            <input className={`input ${validationErrors.end_time ? 'ring-red-500 border-red-500' : ''}`} placeholder="Hora retorno (HH:MM)" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: maskTime(e.target.value), end_date: (!form.end_date && isValidDate(form.date)) ? form.date : form.end_date })} />
            {validationErrors.end_time && <span className="text-red-500 text-xs mt-1">{validationErrors.end_time}</span>}
          </div>
          <div className="md:col-span-4">
            <select className="select w-full max-w-sm" value={kmMode} onChange={(e) => setKmMode(e.target.value)}>
              <option value="" disabled>Tipo de KM</option>
              <option value="KM Caminhão">KM Caminhão</option>
              <option value="KM da Viagem">KM da Viagem</option>
            </select>
            {kmMode === 'KM Caminhão' && (
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <input className={`input flex-1 disabled:bg-slate-200 dark:disabled:bg-slate-700 disabled:text-slate-500 ${validationErrors.km_start ? 'ring-red-500 border-red-500' : ''}`} placeholder="KM inicial *" inputMode="decimal" maxLength={10} value={form.km_start} onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9.,]/g, '').slice(0, 10);
                      const kmEndNum = Number((form.km_end || '').replace(',', '.'));
                      const kmStartNum = Number(val.replace(',', '.') || '');
                      const autoTrip = (form.km_trip === '' && form.km_end !== '') ? String(Math.max(0, kmEndNum - kmStartNum)) : form.km_trip;
                      setForm({ ...form, km_start: val, km_trip: autoTrip });
                    }} disabled={form.noKmStart} />
                    <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={form.noKmStart} onChange={(e) => setForm({ ...form, noKmStart: e.target.checked, km_start: e.target.checked ? '' : form.km_start })} /> Não registrado</label>
                  </div>
                  {validationErrors.km_start && <span className="text-red-500 text-xs mt-1">{validationErrors.km_start}</span>}
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <input className={`input flex-1 disabled:bg-slate-200 dark:disabled:bg-slate-700 disabled:text-slate-500 ${validationErrors.km_end ? 'ring-red-500 border-red-500' : ''}`} placeholder="KM final" inputMode="decimal" maxLength={10} value={form.km_end} onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9.,]/g, '').slice(0, 10);
                      const kmStartNum = Number((form.km_start || '').replace(',', '.'));
                      const kmEndNum = Number(val.replace(',', '.') || '');
                      const autoTrip = (val === '' || form.km_trip === '') && (form.km_start !== '' && val !== '') ? String(Math.max(0, kmEndNum - kmStartNum)) : form.km_trip;
                      setForm({ ...form, km_end: val, km_trip: autoTrip });
                    }} disabled={form.noKmEnd || !(form.status === 'Em Andamento' || form.status === 'Finalizado')} />
                    <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={form.noKmEnd} onChange={(e) => setForm({ ...form, noKmEnd: e.target.checked, km_end: e.target.checked ? '' : form.km_end })} /> Não registrado</label>
                  </div>
                  {validationErrors.km_end && <span className="text-red-500 text-xs mt-1">{validationErrors.km_end}</span>}
                </div>
              </div>
            )}
            {kmMode === 'KM da Viagem' && (
              <div className="mt-3 space-y-3">
                <div className="flex flex-col">
                  <input className={`input ${validationErrors.km_trip ? 'ring-red-500 border-red-500' : ''}`} placeholder="KM da Viagem" inputMode="decimal" maxLength={10} value={form.km_trip} onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9.,]/g, '').slice(0, 10);
                    const kmStartNum = Number((form.km_start || '').replace(',', '.'));
                    const vNum = Number(val.replace(',', '.') || '');
                    const newEnd = form.km_start !== '' ? String(kmStartNum + vNum) : form.km_end;
                    const perLNum = Number(String(form.km_per_liter || '').replace(',', '.'));
                    const autoLiters = perLNum > 0 && vNum >= 0 ? String((vNum / perLNum).toFixed(2)) : form.fuel_liters;
                    setForm({ ...form, km_trip: val, km_end: newEnd, fuel_liters: autoLiters });
                  }} />
                  {validationErrors.km_trip && <span className="text-red-500 text-xs mt-1">{validationErrors.km_trip}</span>}
                </div>
                <input className="input" placeholder="KM por Litro (Consumo do Caminhão)" inputMode="decimal" value={form.km_per_liter} onChange={(e) => {
                  const raw = e.target.value.replace(/[^0-9.,]/g, '');
                  const norm = raw.replace(',', '.');
                  const kmTripNum = Number(form.km_trip || 0);
                  const perLNum = Number(norm || 0);
                  const autoLiters = perLNum > 0 && kmTripNum >= 0 ? String((kmTripNum / perLNum).toFixed(2)) : form.fuel_liters;
                  setForm({ ...form, km_per_liter: raw, fuel_liters: autoLiters });
                }} onBlur={() => { const v = Number(String(form.km_per_liter || '').replace(',', '.')); if (!(v > 0)) toast?.show("KM por litro inválido", "warning"); }} />
              </div>
            )}
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <input className="input flex-1 disabled:bg-slate-200 dark:disabled:bg-slate-700 disabled:text-slate-500" placeholder="Combustível (litros)" value={form.fuel_liters} onChange={(e) => setForm({ ...form, fuel_liters: e.target.value })} disabled={form.noFuelLiters} />
              <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={form.noFuelLiters} onChange={(e) => setForm({ ...form, noFuelLiters: e.target.checked, fuel_liters: e.target.checked ? '' : form.fuel_liters })} /> Não registrado</label>
            </div>
          </div>
          <div className="flex flex-col">
            <div className="flex gap-2">
              <div className="flex-1 flex items-center gap-2">
                <input className="input flex-1 disabled:bg-slate-200 dark:disabled:bg-slate-700 disabled:text-slate-500" placeholder="Valor combustível (R$/litro)" value={form.fuel_price} onChange={(e) => setForm({ ...form, fuel_price: e.target.value })} disabled={form.noFuelPrice} />
                <label className="flex items-center gap-1 text-sm whitespace-nowrap"><input type="checkbox" checked={form.noFuelPrice} onChange={(e) => setForm({ ...form, noFuelPrice: e.target.checked, fuel_price: e.target.checked ? '' : form.fuel_price })} /> N/R</label>
              </div>
              <button type="button" className="btn btn-secondary" onClick={async () => {
                try {
                  const petroUrl = "https://precos.petrobras.com.br/sele%C3%A7%C3%A3o-de-estados-diesel";
                  const extract = (html) => {
                    const txt = String(html || "");
                    const m = txt.match(/Pre\s?ço\s?M[ée]dio\s?do\s?Brasil[^\n]*?R\$\s*([0-9]{1,2}[\.,][0-9]{2})/i);
                    if (m) return Number(m[1].replace(/\./g, "").replace(",", "."));
                    const m2 = txt.match(/Diesel\s*S-?10[^\n]*?R\$\s*([0-9]{1,2}[\.,][0-9]{2})/i);
                    if (m2) return Number(m2[1].replace(/\./g, "").replace(",", "."));
                    return 0;
                  };
                  let v = 0;
                  try {
                    const rJina = `https://r.jina.ai/http://${petroUrl.replace(/^https?:\/\//, "")}`;
                    const r1 = await fetch(rJina);
                    if (r1.ok) { const t1 = await r1.text(); v = extract(t1) || 0; }
                  } catch {}
                  if (!v) {
                    try {
                      const proxyGet = `https://api.allorigins.win/get?url=${encodeURIComponent(petroUrl)}`;
                      const r2 = await fetch(proxyGet);
                      if (r2.ok) { const j2 = await r2.json(); v = extract(j2.contents) || 0; }
                    } catch {}
                  }
                  if (!v) {
                    try {
                      const proxyRaw = `https://api.allorigins.win/raw?url=${encodeURIComponent(petroUrl)}`;
                      const r3 = await fetch(proxyRaw);
                      if (r3.ok) { const t3 = await r3.text(); v = extract(t3) || 0; }
                    } catch {}
                  }
                  if (v > 0) { setForm({ ...form, fuel_price: String(v.toFixed(2)) }); toast?.show("Preço obtido do site da Petrobras", "success"); return; }
                  const apiUrl = import.meta?.env?.VITE_FUEL_API_URL;
                  if (apiUrl) {
                    const resp = await fetch(apiUrl);
                    const json = await resp.json();
                    const v2 = Number(json?.diesel ?? json?.gasolina ?? json?.fuel_price ?? 0);
                    if (v2 > 0) { setForm({ ...form, fuel_price: String(v2.toFixed(2)) }); toast?.show("Preço obtido pela API", "success"); return; }
                  }
                  const custos = await getCustos({ page: 1, pageSize: 200 });
                  const lastCusto = custos.data.find((c) => Number(c.valorLitro || 0) > 0);
                  if (lastCusto) { setForm({ ...form, fuel_price: String(Number(lastCusto.valorLitro).toFixed(2)) }); toast?.show("Preço preenchido com último custo", "info"); return; }
                  const r = await getViagens({ page: 1, pageSize: 1000 });
                  const lastTrip = r.data.find((t) => Number(t.fuel_price || 0) > 0);
                  if (lastTrip) { setForm({ ...form, fuel_price: String(Number(lastTrip.fuel_price).toFixed(2)) }); toast?.show("Preço preenchido com última viagem", "info"); return; }
                  setForm({ ...form, fuel_price: String(Number(6.0).toFixed(2)) });
                  toast?.show("Preço padrão aplicado (R$ 6,00)", "info");
                } catch { toast?.show("Não foi possível obter preço", "error"); }
              }}>Buscar preço</button>
            </div>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <input className="input flex-1 disabled:bg-slate-200 dark:disabled:bg-slate-700 disabled:text-slate-500" placeholder="Outros custos (R$)" value={form.other_costs} onChange={(e) => setForm({ ...form, other_costs: e.target.value })} disabled={form.noOtherCosts} />
              <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={form.noOtherCosts} onChange={(e) => setForm({ ...form, noOtherCosts: e.target.checked, other_costs: e.target.checked ? '' : form.other_costs })} /> Não registrado</label>
            </div>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <input className="input flex-1 disabled:bg-slate-200 dark:disabled:bg-slate-700 disabled:text-slate-500" placeholder="Manutenção (R$)" value={form.maintenance_cost} onChange={(e) => setForm({ ...form, maintenance_cost: e.target.value })} disabled={form.noMaintenanceCost} />
              <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={form.noMaintenanceCost} onChange={(e) => setForm({ ...form, noMaintenanceCost: e.target.checked, maintenance_cost: e.target.checked ? '' : form.maintenance_cost })} /> Não registrado</label>
            </div>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <input className="input flex-1 disabled:bg-slate-200 dark:disabled:bg-slate-700 disabled:text-slate-500" placeholder="Diária do motorista (R$)" value={form.driver_daily} onChange={(e) => setForm({ ...form, driver_daily: e.target.value })} disabled={form.noDriverDaily} />
              <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={form.noDriverDaily} onChange={(e) => setForm({ ...form, noDriverDaily: e.target.checked, driver_daily: e.target.checked ? '' : form.driver_daily })} /> Não registrado</label>
            </div>
          </div>
          <div className="md:col-span-4 flex gap-4">
             <button type="submit" className="btn btn-primary">{editing ? "Salvar" : "Adicionar"}</button>
             <button type="button" className="btn bg-gray-500 hover:bg-gray-600 text-white" onClick={() => {
               setEditing(null);
               setShowForm(false);
               setShowValidation(false);
               setForm({
                 date: "", end_date: "", requester: "", driver_id: "", truck_id: "", prancha_id: "", destination: "", service_type: "", status: "", description: "",
                 start_time: "", end_time: "", km_start: "", km_end: "", km_trip: "", km_per_liter: "", noKmStart: false, noKmEnd: false,
                 fuel_liters: "", noFuelLiters: false, fuel_price: "", noFuelPrice: false, other_costs: "", noOtherCosts: false,
                 maintenance_cost: "", noMaintenanceCost: false, driver_daily: "", noDriverDaily: false
               });
             }}>Cancelar</button>
          </div>
        </form>
      </div>
      )}
      
      <div className="card p-6 animate-fade overflow-x-auto hidden md:block">
        <table className="table min-w-[1100px]">
          <thead>
            <tr>
              <th className="cursor-pointer select-none hover:text-blue-500 transition-colors" onClick={() => handleSort('id')}>
                ID {sortConfig.key === 'id' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </th>
              <th className="cursor-pointer select-none hover:text-blue-500 transition-colors" onClick={() => handleSort('date')}>
                Data {sortConfig.key === 'date' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </th>
              <th>Motorista</th>
              <th>Caminhão</th>
              <th>Prancha</th>
              <th>Destino</th>
              <th>Tipo</th>
              <th>Status</th>
              <th>KM</th>
              <th>Horas</th>
              <th>Custo</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {sortedItems.length === 0 && (
              <tr>
                <td colSpan="12" className="text-center p-4 text-gray-500">Nenhuma viagem encontrada.</td>
              </tr>
            )}
            {sortedItems.map((it, idx) => (
              <tr key={it.id} className={`${idx % 2 === 0 ? 'bg-slate-50 dark:bg-slate-800' : 'bg-white dark:bg-slate-700'} hover:bg-slate-100 dark:hover:bg-slate-600`}>
                <td>{it.id}</td>
                <td>{it.date}{it.end_date ? ` → ${it.end_date}` : ''}</td>
                <td>{drivers.find((d) => d.id === it.driver_id)?.name || it.driver_id}</td>
                <td>{trucks.find((t) => t.id === it.truck_id)?.fleet || trucks.find((t) => t.id === it.truck_id)?.plate || it.truck_id || ""}</td>
                <td>{pranchas.find((p) => p.id === it.prancha_id)?.asset_number || pranchas.find((p) => p.id === it.prancha_id)?.identifier || it.prancha_id || ""}</td>
                <td>{it.destination || ""}</td>
                <td>{it.service_type || ""}</td>
                <td>{it.status}</td>
                <td>{it.km_rodado}</td>
                <td>{it.horas}</td>
                <td>{(it.total_cost ?? 0).toFixed(2)}</td>
                <td className="space-x-2">
                  <button className="btn bg-yellow-500 hover:bg-yellow-600 text-white" onClick={() => edit(it)}>Editar</button>
                  <button className="btn bg-red-600 hover:bg-red-700 text-white" onClick={() => delConfirm(it.id)}>Excluir</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="space-y-3 md:hidden">
        <div className="flex justify-between items-center px-1">
          <span className="text-sm font-semibold text-gray-600 dark:text-gray-300">Ordenar por:</span>
          <div className="flex gap-2">
            <button className={`px-3 py-1 rounded text-sm border ${sortConfig.key === 'id' ? 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900 dark:text-blue-100 dark:border-blue-700 font-bold' : 'bg-white text-gray-600 border-gray-200 dark:bg-slate-700 dark:text-gray-300 dark:border-slate-600'}`} onClick={() => handleSort('id')}>
              ID {sortConfig.key === 'id' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
            </button>
            <button className={`px-3 py-1 rounded text-sm border ${sortConfig.key === 'date' ? 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900 dark:text-blue-100 dark:border-blue-700 font-bold' : 'bg-white text-gray-600 border-gray-200 dark:bg-slate-700 dark:text-gray-300 dark:border-slate-600'}`} onClick={() => handleSort('date')}>
              Data {sortConfig.key === 'date' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
            </button>
          </div>
        </div>
        {sortedItems.length === 0 && (
          <div className="text-center p-4 text-gray-500 card">Nenhuma viagem encontrada.</div>
        )}
        {sortedItems.map((it) => (
          <div key={it.id} className="card p-4">
            <div className="flex justify-between items-center">
              <div className="font-semibold">#{it.id} • {it.date}{it.end_date ? ` → ${it.end_date}` : ''}</div>
              <div className="text-sm">{it.status}</div>
            </div>
            <div className="text-sm text-slate-600 dark:text-slate-300">Motorista: {drivers.find((d) => d.id === it.driver_id)?.name || it.driver_id}</div>
            <div className="text-sm text-slate-600 dark:text-slate-300">Caminhão: {trucks.find((t) => t.id === it.truck_id)?.fleet || trucks.find((t) => t.id === it.truck_id)?.plate || it.truck_id || ""}</div>
            <div className="text-sm text-slate-600 dark:text-slate-300">Prancha: {pranchas.find((p) => p.id === it.prancha_id)?.identifier || it.prancha_id || ""}</div>
            <div className="mt-1 text-sm">Destino: {it.destination || "-"}</div>
            <div className="mt-1 text-sm">Tipo: {it.service_type || "-"}</div>
            <div className="mt-1 flex gap-4 text-sm"><span>KM: {it.km_rodado}</span><span>Horas: {it.horas}</span></div>
            <div className="mt-2 flex flex-wrap gap-2">
              <button className="btn bg-yellow-500 hover:bg-yellow-600 text-white" onClick={() => edit(it)}>Editar</button>
              <button className="btn bg-red-600 hover:bg-red-700 text-white" onClick={() => delConfirm(it.id)}>Excluir</button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between mt-4 p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-100 dark:border-slate-700">
        <div className="text-sm text-slate-500 dark:text-slate-400">
          Página {page} de {totalPages || 1}
        </div>
        <div className="flex items-center gap-2">
          <button
            className="btn btn-sm border border-slate-300 dark:border-slate-600"
            disabled={page <= 1}
            onClick={() => handlePageChange(page - 1)}
          >
            Anterior
          </button>
          <button
            className="btn btn-sm border border-slate-300 dark:border-slate-600"
            disabled={page >= totalPages}
            onClick={() => handlePageChange(page + 1)}
          >
            Próxima
          </button>
          <select
            className="select select-sm !py-1 dark:bg-slate-700 dark:border-slate-600"
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
        </div>
      </div>
      <div className="flex items-center justify-between mt-4 p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-100 dark:border-slate-700">
        <div className="text-sm text-slate-500 dark:text-slate-400">
          Página {page} de {totalPages || 1}
        </div>
        <div className="flex items-center gap-2">
          <button
            className="btn btn-sm border border-slate-300 dark:border-slate-600"
            disabled={page <= 1}
            onClick={() => handlePageChange(page - 1)}
          >
            Anterior
          </button>
          <button
            className="btn btn-sm border border-slate-300 dark:border-slate-600"
            disabled={page >= totalPages}
            onClick={() => handlePageChange(page + 1)}
          >
            Próxima
          </button>
          <select
            className="select select-sm !py-1 dark:bg-slate-700 dark:border-slate-600"
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
        </div>
      </div>
    </div>
  );
}

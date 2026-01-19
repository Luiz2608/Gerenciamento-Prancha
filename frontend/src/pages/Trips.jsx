import { useEffect, useState, useRef } from "react";
import { useLocation } from "react-router-dom";
import { getMotoristas, getViagens, getViagem, saveViagem, updateViagem, deleteViagem, getCaminhoes, getPranchas, getCustos } from "../services/storageService.js";
import { useToast } from "../components/ToastProvider.jsx";
import { supabase } from "../services/supabaseClient.js";

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
    return saved ? JSON.parse(saved) : { date: "", end_date: "", requester: "", driver_id: "", truck_id: "", prancha_id: "", destination: "", location: "", service_type: "", status: "", description: "", start_time: "", end_time: "", km_start: "", km_end: "", km_trip: "", km_per_liter: "", noKmStart: false, noKmEnd: false, fuel_liters: "", noFuelLiters: false, fuel_price: "", noFuelPrice: false, other_costs: "", noOtherCosts: false, maintenance_cost: "", noMaintenanceCost: false, driver_daily: "", noDriverDaily: false };
  });
  
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [kmMode, setKmMode] = useState("");
  const [showValidation, setShowValidation] = useState(false);
  const formRef = useRef(null);
  const lastSubmitTime = useRef(0);

  const calculateDuration = (d1, t1, d2, t2) => {
    if (!d1 || !t1 || !d2 || !t2) return "-";
    const parseDate = (d, t) => {
      let dateObj;
      if (d.includes("-")) {
        const [y, m, day] = d.split("-").map(Number);
        dateObj = new Date(y, m - 1, day);
      } else if (d.includes("/")) {
        const [day, m, y] = d.split("/").map(Number);
        dateObj = new Date(y, m - 1, day);
      } else return null;
      const [h, min] = t.split(":").map(Number);
      dateObj.setHours(h, min, 0, 0);
      return dateObj;
    };
    const start = parseDate(d1, t1);
    const end = parseDate(d2, t2);
    if (!start || !end) return "-";
    const diffMs = end - start;
    if (diffMs < 0) return "-";
    const totalMinutes = Math.floor(diffMs / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h`;
    return `${minutes}m`;
  };

  const handlePrint = () => {
    if (!viewing) return;
    
    const driver = drivers.find((d) => d.id === viewing.driver_id);
    const truck = trucks.find((t) => t.id === viewing.truck_id);
    const prancha = pranchas.find((p) => p.id === viewing.prancha_id);

    const driverName = driver?.name || viewing.driver_id;
    const truckName = truck?.fleet || truck?.plate || viewing.truck_id;
    const pranchaName = prancha?.asset_number || prancha?.identifier || viewing.prancha_id;
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>Relatório de Viagem #${viewing.id}</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 40px; color: #333; line-height: 1.6; }
            h1 { text-align: center; border-bottom: 2px solid #2563eb; padding-bottom: 20px; margin-bottom: 30px; color: #1e293b; }
            .header-info { text-align: center; margin-bottom: 40px; color: #64748b; font-size: 0.9em; }
            .section { margin-bottom: 30px; background: #f8fafc; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; }
            .section-title { font-weight: bold; font-size: 1.2em; margin-bottom: 15px; color: #2563eb; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px; }
            .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; }
            .row { display: flex; justify-content: space-between; border-bottom: 1px dotted #cbd5e1; padding-bottom: 5px; }
            .label { font-weight: 600; color: #475569; }
            .value { font-weight: 400; color: #1e293b; text-align: right; }
            .total-cost-box { background: #dcfce7; padding: 15px; border-radius: 8px; margin-top: 10px; border: 1px solid #86efac; }
            .total-cost { font-size: 1.4em; font-weight: bold; color: #166534; text-align: right; }
            .total-label { font-size: 1.1em; font-weight: 600; color: #15803d; }
            .signature-section { margin-top: 60px; display: flex; justify-content: space-around; page-break-inside: avoid; }
            .signature-box { text-align: center; width: 40%; }
            .signature-line { border-top: 1px solid #333; margin-bottom: 10px; }
            @media print {
              body { margin: 0; padding: 20px; -webkit-print-color-adjust: exact; }
              .section { break-inside: avoid; border: 1px solid #ccc; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <h1>Relatório Detalhado de Viagem #${viewing.id}</h1>
          <div class="header-info">
            Gerado em ${new Date().toLocaleString('pt-BR')}
          </div>
          
          <div class="section">
            <div class="section-title">Informações Gerais</div>
            <div class="grid">
              <div class="row"><span class="label">Data de Saída:</span> <span class="value">${viewing.date} ${viewing.start_time}</span></div>
              <div class="row"><span class="label">Data de Retorno:</span> <span class="value">${viewing.end_date || "-"} ${viewing.end_time}</span></div>
              <div class="row"><span class="label">Status:</span> <span class="value">${viewing.status}</span></div>
              <div class="row"><span class="label">Solicitante:</span> <span class="value">${viewing.requester}</span></div>
              <div class="row"><span class="label">Unidade:</span> <span class="value">${viewing.location || "-"}</span></div>
              <div class="row"><span class="label">Destino:</span> <span class="value">${viewing.destination}</span></div>
              <div class="row"><span class="label">Tipo de Serviço:</span> <span class="value">${viewing.service_type}</span></div>
            </div>
          </div>

          <div class="section">
            <div class="section-title">Dados do Motorista</div>
            <div class="grid">
              <div class="row"><span class="label">Nome:</span> <span class="value">${driver?.name || viewing.driver_id}</span></div>
              <div class="row"><span class="label">CPF:</span> <span class="value">${driver?.cpf || "-"}</span></div>
              <div class="row"><span class="label">CNH:</span> <span class="value">${driver?.cnh || "-"}</span></div>
              <div class="row"><span class="label">Categoria:</span> <span class="value">${driver?.category || "-"}</span></div>
            </div>
          </div>

          <div class="section">
            <div class="section-title">Dados do Veículo (Caminhão)</div>
            <div class="grid">
              <div class="row"><span class="label">Frota:</span> <span class="value">${truck?.fleet || "-"}</span></div>
              <div class="row"><span class="label">Placa:</span> <span class="value">${truck?.plate || viewing.truck_id}</span></div>
              <div class="row"><span class="label">Modelo:</span> <span class="value">${truck?.model || "-"}</span></div>
              <div class="row"><span class="label">Marca:</span> <span class="value">${truck?.brand || "-"}</span></div>
            </div>
          </div>

          <div class="section">
            <div class="section-title">Dados do Reboque (Prancha)</div>
            <div class="grid">
              <div class="row"><span class="label">Ativo:</span> <span class="value">${prancha?.asset_number || viewing.prancha_id}</span></div>
              <div class="row"><span class="label">Placa:</span> <span class="value">${prancha?.plate || "-"}</span></div>
              <div class="row"><span class="label">Tipo:</span> <span class="value">${prancha?.type || "-"}</span></div>
            </div>
          </div>

          <div class="section">
            <div class="section-title">Quilometragem</div>
            <div class="grid">
              <div class="row"><span class="label">KM Inicial:</span> <span class="value">${viewing.km_start != null ? viewing.km_start : "N/R"}</span></div>
              <div class="row"><span class="label">KM Final:</span> <span class="value">${viewing.km_end != null ? viewing.km_end : "N/R"}</span></div>
              <div class="row"><span class="label">KM Total Percorrido:</span> <span class="value" style="font-weight: bold;">${viewing.km_rodado || 0} km</span></div>
            </div>
          </div>

          <div class="section">
            <div class="section-title">Detalhamento de Custos</div>
            <div class="grid">
              <div class="row">
                <span class="label">Combustível (${viewing.fuel_liters || 0} L):</span> 
                <span class="value">R$ ${((viewing.fuel_liters || 0) * (viewing.fuel_price || 0)).toFixed(2)}</span>
              </div>
              <div class="row"><span class="label">Manutenção:</span> <span class="value">R$ ${(viewing.maintenance_cost || 0).toFixed(2)}</span></div>
              <div class="row"><span class="label">Diária Motorista:</span> <span class="value">R$ ${(viewing.driver_daily || 0).toFixed(2)}</span></div>
              <div class="row"><span class="label">Outros Custos:</span> <span class="value">R$ ${(viewing.other_costs || 0).toFixed(2)}</span></div>
            </div>
            <div class="total-cost-box">
               <div style="display: flex; justify-content: space-between; align-items: center;">
                 <span class="total-label">Custo Total da Viagem:</span>
                 <span class="total-cost">R$ ${(viewing.total_cost || 0).toFixed(2)}</span>
               </div>
            </div>
          </div>

          ${viewing.description ? `
          <div class="section">
            <div class="section-title">Observações</div>
            <div style="white-space: pre-wrap; padding: 10px; background: #fff; border: 1px dashed #cbd5e1; border-radius: 4px;">${viewing.description}</div>
          </div>
          ` : ''}

          <div class="signature-section">
            <div class="signature-box">
              <div class="signature-line"></div>
              <div>${driverName}</div>
              <div style="font-size: 0.8em; color: #666;">Motorista</div>
            </div>
            <div class="signature-box">
              <div class="signature-line"></div>
              <div>Responsável / Gestor</div>
              <div style="font-size: 0.8em; color: #666;">Assinatura</div>
            </div>
          </div>

          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

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
  const [locationFilter, setLocationFilter] = useState("");
  const locationFilterRef = useRef(locationFilter);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const loadDrivers = () => getMotoristas().then((r) => setDrivers(r));
  const loadTrucks = () => getCaminhoes().then((r) => setTrucks(r.filter((x) => x.status === "Ativo")));
  const loadPranchas = () => getPranchas().then((r) => setPranchas(r.filter((x) => x.status === "Ativo")));

  const loadTrips = (p = page, ps = pageSize) => {
    const opts = { page: p, pageSize: ps };
    if (statusFilterRef.current) opts.status = statusFilterRef.current;
    if (locationFilterRef.current) opts.location = locationFilterRef.current;
    getViagens(opts).then((r) => {
      if (r.data) {
        setItems(r.data);
        setTotalPages(Math.ceil(r.total / ps));
      } else {
        setItems(r);
        setTotalPages(1);
      }
    });
  };

  const loadTripsRef = useRef(loadTrips);
  loadTripsRef.current = loadTrips;
  
  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
    }
  };

  useEffect(() => {
    loadTrips();
  }, [page, pageSize]);
  
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
    locationFilterRef.current = locationFilter;
    loadTrips();
  }, [statusFilter, locationFilter]);

  useEffect(() => {
    loadDrivers();
    loadTrucks();
    loadPranchas();
    loadTrips();

    let channels = [];
    const setupRealtime = async () => {
      // const { supabase } = await import("../services/supabaseClient.js");
      if (!supabase) return;

      const ch1 = supabase
        .channel("public:viagens")
        .on("postgres_changes", { event: "*", schema: "public", table: "viagens" }, () => { loadTripsRef.current(); })
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

    const interval = setInterval(() => { loadTripsRef.current(); }, 10000);
    return () => {
      if (supabase) {
          channels.forEach(ch => supabase.removeChannel(ch));
      }
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
    if (!form.location) errs.location = "Campo obrigatório";
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
    setForm({ date: "", end_date: "", requester: "", driver_id: "", truck_id: "", prancha_id: "", destination: "", location: "", service_type: "", status: "", description: "", start_time: "", end_time: "", km_start: "", km_end: "", km_trip: "", km_per_liter: "", noKmStart: false, noKmEnd: false, fuel_liters: "", noFuelLiters: false, fuel_price: "", noFuelPrice: false, other_costs: "", noOtherCosts: false, maintenance_cost: "", noMaintenanceCost: false, driver_daily: "", noDriverDaily: false });
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
      location: it.location || "",
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

  const exportCsvAction = async () => { 
    const blob = await exportCsv({ status: statusFilter, location: locationFilter }); 
    const url = URL.createObjectURL(blob); 
    const a = document.createElement("a"); 
    a.href = url; 
    a.download = "viagens.csv"; 
    a.click(); 
    URL.revokeObjectURL(url); 
    toast?.show("CSV exportado", "success"); 
  };
  
  const exportPdfAction = async () => { 
    const blob = await exportPdf({ status: statusFilter, location: locationFilter }); 
    const url = URL.createObjectURL(blob); 
    const a = document.createElement("a"); 
    a.href = url; 
    a.download = "viagens.pdf"; 
    a.click(); 
    URL.revokeObjectURL(url); 
    toast?.show("PDF exportado", "success"); 
  };



  useEffect(() => {
    if (!editing) {
      localStorage.setItem("trips_form_draft", JSON.stringify(form));
    }
  }, [form, editing]);

  return (
    <div className="p-4 max-w-6xl mx-auto pb-24">
      
      {!showForm && !editing && (
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
          <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
             <select 
               className="select w-full md:w-48" 
               value={locationFilter} 
               onChange={(e) => setLocationFilter(e.target.value)}
             >
               <option value="">Todas as Unidades</option>
               <option value="Cambuí">Cambuí</option>
               <option value="Vale">Vale</option>
               <option value="Panorama">Panorama</option>
               <option value="Floresta">Floresta</option>
             </select>
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
          <div className="flex gap-2 w-full md:w-auto">
            <button className="btn btn-secondary" onClick={exportCsvAction} title="Exportar CSV"><span className="material-icons">download</span></button>
            <button className="btn btn-secondary" onClick={exportPdfAction} title="Exportar PDF"><span className="material-icons">picture_as_pdf</span></button>
            <button className="btn btn-primary flex-1 flex items-center justify-center gap-2" onClick={() => setShowForm(true)}>
              <span className="material-icons text-sm">add</span> Novo
            </button>
          </div>
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
            <select className={`select ${validationErrors.location ? 'ring-red-500 border-red-500' : ''}`} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })}>
              <option value="" disabled>Unidade *</option>
              <option value="Cambuí">Cambuí</option>
              <option value="Vale">Vale</option>
              <option value="Panorama">Panorama</option>
              <option value="Floresta">Floresta</option>
            </select>
            {validationErrors.location && <span className="text-red-500 text-xs mt-1">{validationErrors.location}</span>}
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
                 date: "", end_date: "", requester: "", driver_id: "", truck_id: "", prancha_id: "", destination: "", location: "", service_type: "", status: "", description: "",
                 start_time: "", end_time: "", km_start: "", km_end: "", km_trip: "", km_per_liter: "", noKmStart: false, noKmEnd: false,
                 fuel_liters: "", noFuelLiters: false, fuel_price: "", noFuelPrice: false, other_costs: "", noOtherCosts: false,
                 maintenance_cost: "", noMaintenanceCost: false, driver_daily: "", noDriverDaily: false
               });
             }}>Cancelar</button>
          </div>
        </form>
      </div>
      )}
      
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
        {/* Mobile List */}
        <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-700">
          {sortedItems.length === 0 && (
            <div className="p-8 text-center text-slate-500 dark:text-slate-400">Nenhuma viagem encontrada.</div>
          )}
          {sortedItems.slice(0, pageSize).map((it) => (
            <div key={it.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="font-semibold text-slate-800 dark:text-slate-200">#{it.id} • {it.date}</h3>
                  <div className="text-sm text-slate-500 dark:text-slate-400">
                    {it.destination || "Sem destino"}
                    <span className="mx-2">•</span>
                    <span className="font-medium text-blue-600 dark:text-blue-400">
                      {calculateDuration(it.date, it.start_time, it.end_date, it.end_time)}
                    </span>
                  </div>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  it.status === 'Finalizado' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                  it.status === 'Em Andamento' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                  'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                }`}>
                  {it.status}
                </span>
              </div>
              
              <div className="space-y-1 text-sm text-slate-600 dark:text-slate-300 mb-3">
                <div className="flex items-center gap-2">
                  <span className="material-icons text-base text-slate-400">person</span>
                  {drivers.find((d) => d.id === it.driver_id)?.name || it.driver_id}
                </div>
                <div className="flex items-center gap-2">
                  <span className="material-icons text-base text-slate-400">local_shipping</span>
                  {trucks.find((t) => t.id === it.truck_id)?.fleet || trucks.find((t) => t.id === it.truck_id)?.plate || it.truck_id || "-"}
                </div>
              </div>

              <div className="flex items-center justify-between text-sm pt-2 border-t border-slate-100 dark:border-slate-700">
                <div className="font-medium text-slate-700 dark:text-slate-300">
                  R$ {(it.total_cost ?? 0).toFixed(2)}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setViewing(it)} className="p-2 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20 rounded-lg transition-colors" title="Ver Detalhes">
                    <span className="material-icons text-lg">visibility</span>
                  </button>
                  <button onClick={() => edit(it)} className="p-2 text-yellow-600 hover:bg-yellow-50 dark:text-yellow-400 dark:hover:bg-yellow-900/20 rounded-lg transition-colors" title="Editar">
                    <span className="material-icons text-lg">edit</span>
                  </button>
                  <button onClick={() => delConfirm(it.id)} className="p-2 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 rounded-lg transition-colors" title="Excluir">
                    <span className="material-icons text-lg">delete</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 dark:bg-slate-700/50 text-slate-600 dark:text-slate-400 font-semibold text-sm">
              <tr>
                <th className="p-4">ID</th>
                <th className="p-4">Data</th>
                <th className="p-4">Motorista</th>
                <th className="p-4">Caminhão</th>
                <th className="p-4">Prancha</th>
                <th className="p-4">Unidade</th>
                <th className="p-4">Destino</th>
                <th className="p-4">Duração</th>
                <th className="p-4">Status</th>
                <th className="p-4">Custo</th>
                <th className="p-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700 text-sm">
              {sortedItems.length === 0 && (
                <tr>
                  <td colSpan="9" className="text-center p-8 text-slate-500 dark:text-slate-400">Nenhuma viagem encontrada.</td>
                </tr>
              )}
              {sortedItems.slice(0, pageSize).map((it) => (
                <tr key={it.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                  <td className="p-4 font-medium text-slate-800 dark:text-slate-200">#{it.id}</td>
                  <td className="p-4 text-slate-600 dark:text-slate-400">{it.date}</td>
                  <td className="p-4 text-slate-600 dark:text-slate-400">{drivers.find((d) => d.id === it.driver_id)?.name || it.driver_id}</td>
                  <td className="p-4 text-slate-600 dark:text-slate-400">{trucks.find((t) => t.id === it.truck_id)?.fleet || trucks.find((t) => t.id === it.truck_id)?.plate || it.truck_id || ""}</td>
                  <td className="p-4 text-slate-600 dark:text-slate-400">{pranchas.find((p) => p.id === it.prancha_id)?.asset_number || pranchas.find((p) => p.id === it.prancha_id)?.identifier || it.prancha_id || ""}</td>
                  <td className="p-4 text-slate-600 dark:text-slate-400">{it.location || "-"}</td>
                  <td className="p-4 text-slate-600 dark:text-slate-400">{it.destination || "-"}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      it.status === 'Finalizado' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                      it.status === 'Em Andamento' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                      'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                    }`}>
                      {it.status}
                    </span>
                  </td>
                  <td className="p-4 font-medium text-slate-700 dark:text-slate-300">R$ {(it.total_cost ?? 0).toFixed(2)}</td>
                  <td className="p-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => setViewing(it)} className="p-2 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20 rounded-lg transition-colors" title="Ver Detalhes">
                        <span className="material-icons text-lg">visibility</span>
                      </button>
                      <button onClick={() => edit(it)} className="p-2 text-yellow-600 hover:bg-yellow-50 dark:text-yellow-400 dark:hover:bg-yellow-900/20 rounded-lg transition-colors" title="Editar">
                        <span className="material-icons text-lg">edit</span>
                      </button>
                      <button onClick={() => delConfirm(it.id)} className="p-2 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 rounded-lg transition-colors" title="Excluir">
                        <span className="material-icons text-lg">delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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

      {viewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto animate-fade">
            <div className="p-6 space-y-6">
              <div className="flex justify-between items-start">
                <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Detalhes da Viagem #{viewing.id}</h2>
                <button onClick={() => setViewing(null)} className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
                  <span className="material-icons">close</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="space-y-1">
                  <div className="text-sm font-medium text-slate-500 dark:text-slate-400">Data de Saída</div>
                  <div className="text-lg">{viewing.date} {viewing.start_time}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-sm font-medium text-slate-500 dark:text-slate-400">Data de Retorno</div>
                  <div className="text-lg">{viewing.end_date || "-"} {viewing.end_time}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-sm font-medium text-slate-500 dark:text-slate-400">Duração</div>
                  <div className="text-lg font-medium text-blue-600 dark:text-blue-400">
                    {calculateDuration(viewing.date, viewing.start_time, viewing.end_date, viewing.end_time)}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-sm font-medium text-slate-500 dark:text-slate-400">Status</div>
                  <div className="text-lg font-medium">{viewing.status}</div>
                </div>

                <div className="space-y-1">
                  <div className="text-sm font-medium text-slate-500 dark:text-slate-400">Solicitante</div>
                  <div className="text-lg">{viewing.requester}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-sm font-medium text-slate-500 dark:text-slate-400">Motorista</div>
                  <div className="text-lg">{drivers.find((d) => d.id === viewing.driver_id)?.name || viewing.driver_id}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-sm font-medium text-slate-500 dark:text-slate-400">Caminhão</div>
                  <div className="text-lg">{trucks.find((t) => t.id === viewing.truck_id)?.fleet || trucks.find((t) => t.id === viewing.truck_id)?.plate || viewing.truck_id}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-sm font-medium text-slate-500 dark:text-slate-400">Prancha</div>
                  <div className="text-lg">{pranchas.find((p) => p.id === viewing.prancha_id)?.asset_number || pranchas.find((p) => p.id === viewing.prancha_id)?.identifier || viewing.prancha_id}</div>
                </div>
                
                <div className="space-y-1">
                  <div className="text-sm font-medium text-slate-500 dark:text-slate-400">Unidade</div>
                  <div className="text-lg">{viewing.location || "-"}</div>
                </div>

                <div className="space-y-1">
                  <div className="text-sm font-medium text-slate-500 dark:text-slate-400">Destino</div>
                  <div className="text-lg">{viewing.destination}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-sm font-medium text-slate-500 dark:text-slate-400">Tipo de Serviço</div>
                  <div className="text-lg">{viewing.service_type}</div>
                </div>

                <div className="col-span-full border-t border-slate-200 dark:border-slate-700 pt-4">
                  <h3 className="font-semibold text-lg mb-4 text-secondary">Quilometragem</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-1">
                      <div className="text-sm font-medium text-slate-500 dark:text-slate-400">KM Inicial</div>
                      <div className="text-lg">{viewing.km_start != null ? viewing.km_start : "N/R"}</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-sm font-medium text-slate-500 dark:text-slate-400">KM Final</div>
                      <div className="text-lg">{viewing.km_end != null ? viewing.km_end : "N/R"}</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-sm font-medium text-slate-500 dark:text-slate-400">KM Total</div>
                      <div className="text-lg font-bold">{viewing.km_rodado || 0} km</div>
                    </div>
                  </div>
                </div>

                <div className="col-span-full border-t border-slate-200 dark:border-slate-700 pt-4">
                  <h3 className="font-semibold text-lg mb-4 text-secondary">Custos</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="space-y-1">
                      <div className="text-sm font-medium text-slate-500 dark:text-slate-400">Combustível</div>
                      <div className="text-lg">
                        {viewing.fuel_liters ? `${viewing.fuel_liters} L` : "0 L"} 
                        {viewing.fuel_price ? ` (R$ ${viewing.fuel_price}/L)` : ""}
                      </div>
                      <div className="text-sm text-slate-500">Total: R$ {((viewing.fuel_liters || 0) * (viewing.fuel_price || 0)).toFixed(2)}</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-sm font-medium text-slate-500 dark:text-slate-400">Manutenção</div>
                      <div className="text-lg">R$ {(viewing.maintenance_cost || 0).toFixed(2)}</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-sm font-medium text-slate-500 dark:text-slate-400">Diária Motorista</div>
                      <div className="text-lg">R$ {(viewing.driver_daily || 0).toFixed(2)}</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-sm font-medium text-slate-500 dark:text-slate-400">Outros</div>
                      <div className="text-lg">R$ {(viewing.other_costs || 0).toFixed(2)}</div>
                    </div>
                    <div className="space-y-1 col-span-full mt-2 bg-slate-50 dark:bg-slate-700 p-3 rounded">
                      <div className="text-sm font-bold text-slate-700 dark:text-slate-200">Custo Total da Viagem</div>
                      <div className="text-2xl font-bold text-green-600 dark:text-green-400">R$ {(viewing.total_cost || 0).toFixed(2)}</div>
                    </div>
                  </div>
                </div>

                {viewing.description && (
                  <div className="col-span-full border-t border-slate-200 dark:border-slate-700 pt-4">
                    <div className="space-y-1">
                      <div className="text-sm font-medium text-slate-500 dark:text-slate-400">Observações</div>
                      <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded text-sm whitespace-pre-wrap">{viewing.description}</div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-4 border-t border-slate-200 dark:border-slate-700 gap-2">
                <button className="btn bg-blue-600 hover:bg-blue-700 text-white" onClick={handlePrint}>Imprimir Relatório</button>
                <button className="btn bg-gray-500 hover:bg-gray-600 text-white" onClick={() => setViewing(null)}>Fechar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

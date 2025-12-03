import { useEffect, useState } from "react";
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
  const tipoOptions = ["máquinas agrícolas","máquinas de construção","equipamentos industriais","veículos pesados","veículos leves"];
  const [form, setForm] = useState({ date: "", end_date: "", requester: "", driver_id: "", truck_id: "", prancha_id: "", destination: "", service_type: "", status: "", description: "", start_time: "", end_time: "", km_start: "", km_end: "", km_trip: "", noKmStart: false, noKmEnd: false, fuel_liters: "", fuel_price: "", other_costs: "", maintenance_cost: "", driver_daily: "" });
  const [editing, setEditing] = useState(null);
  const [kmMode, setKmMode] = useState("");
  const [kmPickerOpen, setKmPickerOpen] = useState(false);

  const loadDrivers = () => getMotoristas().then((r) => setDrivers(r));
  const loadTrucks = () => getCaminhoes().then((r) => setTrucks(r.filter((x) => x.status === "Ativo")));
  const loadPranchas = () => getPranchas().then((r) => setPranchas(r.filter((x) => x.status === "Ativo")));
  const loadTrips = () => getViagens({ page: 1, pageSize: 20 }).then((r) => setItems(r.data));
  useEffect(() => {
    loadDrivers();
    loadTrucks();
    loadPranchas();
    loadTrips();
    if (supabase) {
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
      const interval = setInterval(() => { loadTrips(); }, 10000);
      return () => {
        supabase.removeChannel(ch1);
        supabase.removeChannel(ch2);
        supabase.removeChannel(ch3);
        supabase.removeChannel(ch4);
        clearInterval(interval);
      };
    }
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

  const submit = async (e) => {
    e.preventDefault();
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
    const todayIso = new Date().toISOString().slice(0,10);
    const missing = [];
    if (!payload.date) missing.push("Data");
    if (!form.requester) missing.push("Solicitante");
    if (!payload.driver_id) missing.push("Motorista");
    if (!payload.truck_id) missing.push("Caminhão (Frota)");
    if (!payload.prancha_id) missing.push("Prancha (Frota)");
    if (!form.destination) missing.push("Destino");
    if (!isValidTime(form.start_time)) missing.push("Hora saída");
    if (!form.noKmStart && form.km_start === "") missing.push("KM saída");
    if (!form.status) missing.push("Status da Viagem");
    if (missing.length) { toast?.show(`Erro → Aba Viagens → Campo ${missing[0]} obrigatório`, "error"); return; }
    if (form.km_trip !== "") { const vkm = Number(form.km_trip); if (!(vkm >= 0)) { toast?.show("KM da Viagem não pode ser negativo", "error"); return; } }
    if (payload.km_end != null && payload.km_start != null && payload.km_end < payload.km_start) { toast?.show("KM final não pode ser menor que o KM inicial", "error"); return; }
    if (form.km_trip !== "" && payload.km_start != null) { payload.km_end = Number(payload.km_start) + Number(form.km_trip); }
    payload.requester = form.requester;
    payload.status = form.status;
    if (editing) await updateViagem(editing.id, payload);
    else await saveViagem(payload);
    toast?.show(editing ? "Viagem atualizada" : "Viagem cadastrada", "success");
    setForm({ date: "", end_date: "", requester: "", driver_id: "", truck_id: "", prancha_id: "", destination: "", service_type: "", status: "", description: "", start_time: "", end_time: "", km_start: "", km_end: "", km_trip: "", noKmStart: false, noKmEnd: false, fuel_liters: "", fuel_price: "", other_costs: "", maintenance_cost: "", driver_daily: "" });
    setEditing(null);
    loadTrips();
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
      km_start: it.km_start?.toString() || "",
      km_end: it.km_end?.toString() || "",
      km_trip: (it.km_rodado != null ? String(it.km_rodado) : ((it.km_start != null && it.km_end != null) ? String(Math.max(0, Number(it.km_end) - Number(it.km_start))) : "")),
      noKmStart: false,
      noKmEnd: false,
      fuel_liters: it.fuel_liters?.toString() || "",
      fuel_price: it.fuel_price?.toString() || "",
      other_costs: it.other_costs?.toString() || ""
    });
    toast?.show("Edição carregada", "info");
  };

  const del = async (id) => { await deleteViagem(id); toast?.show("Viagem excluída", "success"); loadTrips(); };
  const delConfirm = async (id) => { if (!window.confirm("Confirma excluir esta viagem?")) return; await del(id); };

  return (
    <div className="space-y-8 overflow-x-auto overflow-y-auto min-h-screen page" style={{ WebkitOverflowScrolling: 'touch', overscrollBehaviorX: 'contain', overscrollBehaviorY: 'contain', touchAction: 'pan-y' }}>
      <div className="card p-6 animate-fade">
        <div className="font-semibold mb-4 text-secondary text-xl">Cadastro de Viagens</div>
        <form onSubmit={submit} onKeyDown={handleFormKeyDown} className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <input className={`input ${(!form.date || !isValidDate(form.date)) && 'ring-red-500 border-red-500'}`} placeholder="Data (DD/MM/YY ou DD/MM/YYYY)" value={form.date} onChange={(e) => setForm({ ...form, date: maskDate(e.target.value) })} />
          <input className={`input ${!form.requester && 'ring-red-500 border-red-500'}`} placeholder="Solicitante" value={form.requester} onChange={(e) => setForm({ ...form, requester: e.target.value })} />
          <select className={`select ${!form.driver_id && 'ring-red-500 border-red-500'}`} value={form.driver_id} onChange={(e) => setForm({ ...form, driver_id: e.target.value })}>
            <option value="" disabled>Motorista</option>
            {drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <select className={`select ${!form.truck_id && 'ring-red-500 border-red-500'}`} value={form.truck_id} onChange={(e) => {
            const val = e.target.value;
            const tr = trucks.find((t) => t.id === Number(val));
            setForm({ ...form, truck_id: val, km_start: tr && tr.km_current != null ? String(tr.km_current) : form.km_start });
          }}>
            <option value="" disabled>Caminhão (Frota)</option>
            {trucks.map((t) => <option key={t.id} value={t.id}>{t.fleet || t.plate || t.model || t.id}</option>)}
          </select>
          <select className={`select ${!form.prancha_id && 'ring-red-500 border-red-500'}`} value={form.prancha_id} onChange={(e) => setForm({ ...form, prancha_id: e.target.value })}>
            <option value="" disabled>Prancha</option>
            {pranchas.map((p) => <option key={p.id} value={p.asset_number || ''}>{p.asset_number || p.identifier || p.model || p.id}</option>)}
          </select>
          <input className={`input ${!form.destination && 'ring-red-500 border-red-500'}`} placeholder="Destino" value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} />
          <select className="select" value={form.service_type} onChange={(e) => setForm({ ...form, service_type: e.target.value })}>
            <option value="" disabled>Tipo</option>
            {tipoOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
          </select>
          <select className={`select ${!form.status && 'ring-red-500 border-red-500'}`} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            <option value="" disabled>Status</option>
            <option value="Previsto">Previsto</option>
            <option value="Em Andamento">Em Andamento</option>
            <option value="Finalizado">Finalizado</option>
          </select>
          <input className="input md:col-span-4" placeholder="Descrição" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <input className={`input ${(!form.start_time || !isValidTime(form.start_time)) && 'ring-red-500 border-red-500'}`} placeholder="Hora saída (HH:MM)" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: maskTime(e.target.value), end_date: (!form.end_date && isValidDate(form.date)) ? form.date : form.end_date })} />
          <input className={`input ${!form.end_date || !isValidDate(form.end_date) ? 'ring-yellow-500 border-yellow-500' : ''}`} placeholder="Data retorno (DD/MM/YY ou DD/MM/YYYY)" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: maskDate(e.target.value) })} />
          <input className={`input ${form.end_time && !isValidTime(form.end_time) && 'ring-red-500 border-red-500'}`} placeholder="Hora retorno (HH:MM)" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: maskTime(e.target.value), end_date: (!form.end_date && isValidDate(form.date)) ? form.date : form.end_date })} />
          <div className="md:col-span-4">
            <button type="button" className="btn btn-secondary" onClick={() => setKmPickerOpen(!kmPickerOpen)}>Selecionar Tipo de KM</button>
            {kmPickerOpen && (
              <div className="mt-2 card p-4 w-full max-w-sm">
                <div className="font-semibold mb-2">Tipo de KM</div>
                <div className="space-y-2">
                  <button type="button" className="btn w-full" onClick={() => { setKmMode('KM Inicial'); setKmPickerOpen(false); }}>KM Inicial</button>
                  <button type="button" className="btn w-full" onClick={() => { setKmMode('KM Final'); setKmPickerOpen(false); }}>KM Final</button>
                  <button type="button" className="btn w-full" onClick={() => { setKmMode('KM da Viagem'); setKmPickerOpen(false); }}>KM da Viagem</button>
                </div>
              </div>
            )}
            {kmMode === 'KM Inicial' && (
              <div className="mt-3 flex items-center gap-2">
                <input className={`input flex-1 ${(!form.noKmStart && form.km_start === '') && 'ring-red-500 border-red-500'}`} placeholder="KM inicial" value={form.km_start} onChange={(e) => {
                  const val = e.target.value.replace(/\\D/g, '');
                  const kmEndNum = Number((form.km_end || '').replace(/\\D/g, ''));
                  const kmStartNum = Number(val || '');
                  const autoTrip = (form.km_trip === '' && form.km_end !== '') ? String(Math.max(0, kmEndNum - kmStartNum)) : form.km_trip;
                  setForm({ ...form, km_start: val, km_trip: autoTrip });
                }} disabled={form.noKmStart} />
                <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={form.noKmStart} onChange={(e) => setForm({ ...form, noKmStart: e.target.checked, km_start: e.target.checked ? '' : form.km_start })} /> Não registrado</label>
              </div>
            )}
            {kmMode === 'KM Final' && (
              <div className="mt-3 flex items-center gap-2">
                <input className={`input flex-1 ${(form.km_end !== '' && form.km_start !== '' && Number(form.km_end) < Number(form.km_start)) && 'ring-red-500 border-red-500'}`} placeholder="KM final" value={form.km_end} onChange={(e) => {
                  const val = e.target.value.replace(/\\D/g, '');
                  const kmStartNum = Number((form.km_start || '').replace(/\\D/g, ''));
                  const kmEndNum = Number(val || '');
                  const autoTrip = (val === '' || form.km_trip === '') && (form.km_start !== '' && val !== '') ? String(Math.max(0, kmEndNum - kmStartNum)) : form.km_trip;
                  setForm({ ...form, km_end: val, km_trip: autoTrip });
                }} disabled={form.noKmEnd || !(form.status === 'Em Andamento' || form.status === 'Finalizado')} />
                <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={form.noKmEnd} onChange={(e) => setForm({ ...form, noKmEnd: e.target.checked, km_end: e.target.checked ? '' : form.km_end })} /> Não registrado</label>
              </div>
            )}
            {kmMode === 'KM da Viagem' && (
              <div className="mt-3">
                <input className="input" placeholder="KM da Viagem" value={form.km_trip} onChange={(e) => {
                  const val = e.target.value.replace(/\\D/g, '');
                  const kmStartNum = Number((form.km_start || '').replace(/\\D/g, ''));
                  const vNum = Number(val || '');
                  const newEnd = form.km_start !== '' ? String(kmStartNum + vNum) : form.km_end;
                  setForm({ ...form, km_trip: val, km_end: newEnd });
                }} />
              </div>
            )}
          </div>
          <input className="input" placeholder="Combustível (litros)" value={form.fuel_liters} onChange={(e) => setForm({ ...form, fuel_liters: e.target.value })} />
          <div className="flex gap-2">
            <input className="input flex-1" placeholder="Valor combustível (R$/litro)" value={form.fuel_price} onChange={(e) => setForm({ ...form, fuel_price: e.target.value })} />
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
          <input className="input" placeholder="Outros custos (R$)" value={form.other_costs} onChange={(e) => setForm({ ...form, other_costs: e.target.value })} />
          <input className="input" placeholder="Manutenção (R$)" value={form.maintenance_cost} onChange={(e) => setForm({ ...form, maintenance_cost: e.target.value })} />
          <input className="input" placeholder="Diária do motorista (R$)" value={form.driver_daily} onChange={(e) => setForm({ ...form, driver_daily: e.target.value })} />
          <button className="btn btn-primary">{editing ? "Salvar" : "Adicionar"}</button>
        </form>
      </div>
      <div className="card p-6 animate-fade overflow-x-auto hidden md:block">
        <table className="table min-w-[1100px]">
          <thead>
            <tr>
              <th>ID</th>
              <th>Data</th>
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
            {items.map((it, idx) => (
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
        {items.map((it) => (
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
    </div>
  );
}

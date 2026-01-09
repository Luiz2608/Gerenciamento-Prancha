import { useEffect, useState, useRef } from "react";
import { getCaminhoes, saveCaminhao, updateCaminhao, deleteCaminhao } from "../services/storageService.js";
import { useToast } from "../components/ToastProvider.jsx";

export default function FleetTrucks() {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(() => {
    const saved = localStorage.getItem("trucks_form_draft");
    return saved ? JSON.parse(saved) : { plate: "", model: "", year: "", chassis: "", km_current: "", fleet: "", status: "Ativo" };
  });
  
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const formRef = useRef(null);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(0);

  const maskPlate = (v) => {
    const s = String(v || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0,7);
    return s;
  };
  const isValidPlateBr = (s) => /^[A-Z]{3}[0-9][A-Z][0-9]{2}$/.test(String(s)) || /^[A-Z]{3}[0-9]{4}$/.test(String(s));
  const maskChassis = (v) => String(v || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0,17);
  
  const load = () => {
    getCaminhoes({ page, pageSize }).then((r) => {
      if (r.data) {
        setItems(r.data);
        setTotalPages(Math.ceil(r.total / pageSize));
      } else {
        setItems(r);
        setTotalPages(1);
      }
    });
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
    }
  };

  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    load();
  }, [page, pageSize]);

  useEffect(() => {
    const interval = setInterval(() => { loadRef.current(); }, 10000);
    
    let channel = null;
    const initRealtime = async () => {
      const { supabase } = await import("../services/supabaseClient.js");
      if (supabase) {
        channel = supabase
          .channel("public:caminhoes")
          .on("postgres_changes", { event: "*", schema: "public", table: "caminhoes" }, () => { loadRef.current(); })
          .subscribe();
      }
    };
    initRealtime();

    return () => { 
      if (channel) {
         import("../services/supabaseClient.js").then(({ supabase }) => {
            if(supabase) supabase.removeChannel(channel);
         });
      }
      clearInterval(interval); 
    };
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    const yearNum = form.year ? Number(form.year) : null;
    const nowYear = new Date().getFullYear();
    if (!isValidPlateBr(form.plate)) { toast?.show("Erro → Aba Caminhão → Campo Placa inválida", "error"); return; }
    if (yearNum && (yearNum < 1950 || yearNum > (nowYear + 2))) { toast?.show("Erro → Aba Caminhão → Campo Ano fora do limite (1950 até ano atual + 2)", "error"); return; }
    const payload = {
      plate: form.plate || null,
      model: form.model || null,
      year: form.year ? Number(form.year) : null,
      chassis: form.chassis || null,
      asset_number: form.asset_number || null,
      capacity: form.capacity ? Number(form.capacity) : null,
      km_current: form.km_current ? Number(form.km_current) : null,
      fleet: form.fleet || null,
      status: form.status || "Ativo"
    };
    if (!payload.plate || !payload.model || !payload.year) { const field = !payload.plate ? "Placa" : (!payload.model ? "Modelo" : "Ano"); toast?.show(`Erro → Aba Caminhão → Campo ${field} obrigatório`, "error"); return; }
    if (editing) await updateCaminhao(editing.id, payload);
    else await saveCaminhao(payload);
    localStorage.removeItem("trucks_form_draft");
    toast?.show(editing ? "Caminhão atualizado" : "Caminhão cadastrado", "success");
    setForm({ plate: "", model: "", year: "", asset_number: "", capacity: "", km_current: "", fleet: "", status: "Ativo" });
    setEditing(null);
    setShowForm(false);
    load();
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
    setForm({ plate: it.plate || "", model: it.model || "", year: it.year?.toString() || "", chassis: it.chassis || "", km_current: it.km_current?.toString() || "", fleet: it.fleet || "", status: it.status }); 
    setShowForm(true);
    toast?.show("Edição carregada", "info"); 
    setTimeout(() => {
      if (formRef.current) formRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      else window.scrollTo({ top: 0, behavior: "smooth" });
    }, 100);
  };
  const del = async (id) => { await deleteCaminhao(id); toast?.show("Caminhão excluído", "success"); load(); };
  const delConfirm = async (id) => { if (!window.confirm("Confirma excluir este caminhão?")) return; await del(id); };

  useEffect(() => {
    if (!editing) {
      localStorage.setItem("trucks_form_draft", JSON.stringify(form));
    }
  }, [form, editing]);

  return (
    <div className="space-y-8 overflow-x-auto overflow-y-auto min-h-screen page" style={{ WebkitOverflowScrolling: 'touch', overscrollBehaviorX: 'contain', overscrollBehaviorY: 'contain', touchAction: 'pan-y' }}>
      {!showForm && !editing && (
        <div className="flex justify-end mb-4">
          <button className="btn btn-primary w-full md:w-auto" onClick={() => setShowForm(true)}>Novo</button>
        </div>
      )}

      {(showForm || editing) && (
        <div ref={formRef} className="card p-6 animate-fade">
          <div className="font-semibold mb-4 text-secondary text-xl">Cadastro de Caminhão</div>
          <form onSubmit={submit} onKeyDown={handleFormKeyDown} className="grid grid-cols-1 md:grid-cols-6 gap-4">
            <input className={`input ${form.plate && !isValidPlateBr(form.plate) && 'ring-red-500 border-red-500'}`} placeholder="Placa" value={form.plate} onChange={(e) => setForm({ ...form, plate: maskPlate(e.target.value) })} />
            <input className="input" placeholder="Modelo" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
            <input className="input" placeholder="Ano" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value.replace(/[^0-9]/g, '').slice(0,4) })} />
            <input className={`input ${form.chassis && form.chassis.length > 17 && 'ring-red-500 border-red-500'}`} placeholder="Chassi" value={form.chassis} onChange={(e) => setForm({ ...form, chassis: maskChassis(e.target.value) })} />
            <input className="input" placeholder="KM atual" value={form.km_current} onChange={(e) => setForm({ ...form, km_current: e.target.value })} />
            <input className="input" placeholder="Frota" value={form.fleet} maxLength={7} onChange={(e) => setForm({ ...form, fleet: e.target.value.replace(/\D/g, "").slice(0,7) })} />
            <select className="select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option>Ativo</option>
              <option>Manutenção</option>
            </select>
            <div className="flex gap-2 md:col-span-6">
              <button className="btn btn-primary flex-1">{editing ? "Salvar" : "Adicionar"}</button>
              <button type="button" className="btn bg-gray-500 hover:bg-gray-600 text-white" onClick={() => { setShowForm(false); setEditing(null); localStorage.removeItem("trucks_form_draft"); setForm({ plate: "", model: "", year: "", asset_number: "", capacity: "", km_current: "", fleet: "", status: "Ativo" }); }}>Cancelar</button>
            </div>
          </form>
        </div>
      )}

      <div className="card p-6 animate-fade overflow-x-auto hidden md:block">
        <table className="table min-w-[1000px]">
          <thead>
            <tr>
              <th>ID</th>
              <th>Placa</th>
              <th>Modelo</th>
              <th>Ano</th>
              <th>Chassi</th>
              <th>KM atual</th>
              <th>Frota</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, idx) => (
              <tr key={it.id} className={`${idx % 2 === 0 ? 'bg-slate-50 dark:bg-slate-800' : 'bg-white dark:bg-slate-700'} hover:bg-slate-100 dark:hover:bg-slate-600`}>
                <td>{it.id}</td>
                <td>{it.plate || ""}</td>
                <td>{it.model || ""}</td>
                <td>{it.year ?? ""}</td>
                <td title={it.chassis}>{it.chassis || ""}</td>
                <td>{it.km_current ?? ""}</td>
                <td>{it.fleet || ""}</td>
                <td>{it.status}</td>
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
        {items.slice(0, pageSize).map((it) => (
          <div key={it.id} className="card p-4">
            <div className="flex justify-between items-center">
              <div className="font-semibold">{it.model || "Caminhão"}</div>
              <div className="text-sm">{it.status}</div>
            </div>
            <div className="text-sm text-slate-600 dark:text-slate-300">Placa: {it.plate || ""}</div>
            <div className="text-sm text-slate-600 dark:text-slate-300">Chassi: {it.chassis || ""}</div>
            <div className="text-sm text-slate-600 dark:text-slate-300">Frota: {it.fleet || ""}</div>
            <div className="text-sm text-slate-600 dark:text-slate-300">KM: {it.km_current ?? ""}</div>
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
            onClick={() => handlePageChange(page - 1)}
            disabled={page <= 1}
          >
            Anterior
          </button>
          <button 
            className="btn btn-sm border border-slate-300 dark:border-slate-600" 
            onClick={() => handlePageChange(page + 1)}
            disabled={page >= totalPages}
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

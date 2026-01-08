import { useEffect, useState, useRef } from "react";
import { getPranchas, savePrancha, updatePrancha, deletePrancha } from "../services/storageService.js";
import { useToast } from "../components/ToastProvider.jsx";

export default function FleetPranchas() {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(() => {
    const saved = localStorage.getItem("pranchas_form_draft");
    return saved ? JSON.parse(saved) : { asset_number: "", type: "", capacity: "", year: "", plate: "", chassis: "", status: "Ativo", fleet: "", conjunto: "", is_set: false, asset_number2: "", plate2: "", chassis2: "" };
  });

  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const formRef = useRef(null);

  useEffect(() => {
    if (!editing) {
      localStorage.setItem("pranchas_form_draft", JSON.stringify(form));
    }
  }, [form, editing]);
  const typeCap = { "Prancha 2 eixos": 20000, "Prancha 3 eixos": 30000, "Prancha 4 eixos": 45000, "Reboque 30 metros": 50000, "Reboque 26 metros": 40000 };
  const load = () => getPranchas().then((r) => setItems(r));
  useEffect(() => {
    load();
    const interval = setInterval(load, 10000);
    
    let channel = null;
    const initRealtime = async () => {
      const { supabase } = await import("../services/supabaseClient.js");
      if (supabase) {
        channel = supabase
          .channel("public:pranchas")
          .on("postgres_changes", { event: "*", schema: "public", table: "pranchas" }, () => { load(); })
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
  const maskPlate = (v) => String(v || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0,7);
  const maskChassis = (v) => String(v || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0,17);
  const submit = async (e) => {
    e.preventDefault();
    const payload = {
      asset_number: form.asset_number || null,
      type: form.type || null,
      capacity: form.capacity ? Number(form.capacity) : null,
      year: form.year ? Number(form.year) : null,
      plate: form.plate || null,
      chassis: form.chassis || null,
      status: form.status || "Ativo",
      fleet: form.fleet || null,
      conjunto: form.conjunto || null,
      is_set: form.is_set || false,
      asset_number2: form.is_set ? (form.asset_number2 || null) : null,
      plate2: form.is_set ? (form.plate2 || null) : null,
      chassis2: form.is_set ? (form.chassis2 || null) : null
    };
    if (!payload.asset_number || !payload.type || !payload.year) { const field = !payload.asset_number ? "Nº Ativo" : (!payload.type ? "Tipo" : "Ano"); toast?.show(`Erro → Aba Reboques → Campo ${field} obrigatório`, "error"); return; }
    if (editing) await updatePrancha(editing.id, payload);
    else await savePrancha(payload);
    localStorage.removeItem("pranchas_form_draft");
    setForm({ asset_number: "", type: "", capacity: "", year: "", plate: "", chassis: "", status: "Ativo", fleet: "", conjunto: "", is_set: false, asset_number2: "", plate2: "", chassis2: "" });
    toast?.show(editing ? "Reboque atualizado" : "Reboque cadastrado", "success");
    setEditing(null);
    setShowForm(false);
    load();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const edit = (it) => {
    setEditing(it);
    setForm({
      asset_number: it.asset_number || "",
      type: it.type || "",
      capacity: it.capacity?.toString() || "",
      year: it.year?.toString() || "",
      plate: it.plate || "",
      chassis: it.chassis || "",
      status: it.status,
      fleet: it.fleet || "",
      conjunto: it.conjunto || "",
      is_set: it.is_set || false,
      asset_number2: it.asset_number2 || "",
      plate2: it.plate2 || "",
      chassis2: it.chassis2 || ""
    });
    setShowForm(true);
    toast?.show("Edição carregada", "info");
    setTimeout(() => {
      if (formRef.current) formRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      else window.scrollTo({ top: 0, behavior: "smooth" });
    }, 100);
  };
  const del = async (id) => { await deletePrancha(id); toast?.show("Reboque excluído", "success"); load(); };
  const delConfirm = async (id) => { if (!window.confirm("Confirma excluir este reboque?")) return; await del(id); };

  useEffect(() => {
    if (!editing) {
      localStorage.setItem("pranchas_form_draft", JSON.stringify(form));
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
          <div className="font-semibold mb-4 text-secondary text-xl">Cadastro de Reboque</div>
          <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-6 gap-4">
            <select className="select md:col-span-2" value={form.type} onChange={(e) => { const tp = e.target.value; setForm({ ...form, type: tp, capacity: typeCap[tp] || "" }); }}>
              <option value="">Tipo de Reboque</option>
              <option>Prancha 2 eixos</option>
              <option>Prancha 3 eixos</option>
              <option>Prancha 4 eixos</option>
              <option>Reboque 30 metros</option>
              <option>Reboque 26 metros</option>
            </select>
            <input className="input" placeholder="Conjunto" value={form.conjunto} onChange={(e) => setForm({ ...form, conjunto: e.target.value })} />
            <input className="input" placeholder="Capacidade" value={form.capacity} readOnly />
            <input className="input" placeholder="Ano" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} />
            <select className="select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option>Ativo</option>
              <option>Manutenção</option>
            </select>

            {(form.type === "Reboque 30 metros" || form.type === "Reboque 26 metros") && (
              <div className="md:col-span-6 flex items-center gap-2 mt-2 p-2 bg-slate-100 dark:bg-slate-700 rounded">
                <input type="checkbox" id="is_set" className="w-5 h-5" checked={form.is_set} onChange={(e) => setForm({ ...form, is_set: e.target.checked })} />
                <label htmlFor="is_set" className="font-semibold cursor-pointer">Faz parte de um conjunto?</label>
              </div>
            )}

            <div className="md:col-span-6 grid grid-cols-1 md:grid-cols-3 gap-4 border p-4 rounded bg-slate-50 dark:bg-slate-800">
              <div className="font-semibold md:col-span-3 mb-2">{form.is_set ? "Reboque 1" : "Dados do Reboque"}</div>
              <input className="input" placeholder="Frota / Nº Ativo" value={form.asset_number} onChange={(e) => setForm({ ...form, asset_number: e.target.value })} />
              <input className="input" placeholder="Placa" value={form.plate} onChange={(e) => setForm({ ...form, plate: maskPlate(e.target.value) })} />
              <input className="input" placeholder="Chassi" value={form.chassis} onChange={(e) => setForm({ ...form, chassis: maskChassis(e.target.value) })} />
            </div>

            {form.is_set && (
              <div className="md:col-span-6 grid grid-cols-1 md:grid-cols-3 gap-4 border p-4 rounded bg-slate-50 dark:bg-slate-800 mt-2">
                <div className="font-semibold md:col-span-3 mb-2">Reboque 2</div>
                <input className="input" placeholder="Nº Ativo 2" value={form.asset_number2} onChange={(e) => setForm({ ...form, asset_number2: e.target.value })} />
                <input className="input" placeholder="Placa 2" value={form.plate2} onChange={(e) => setForm({ ...form, plate2: maskPlate(e.target.value) })} />
                <input className="input" placeholder="Chassi 2" value={form.chassis2} onChange={(e) => setForm({ ...form, chassis2: maskChassis(e.target.value) })} />
              </div>
            )}

            <div className="flex gap-2 md:col-span-6 mt-4">
              <button className="btn btn-primary flex-1">{editing ? "Salvar" : "Adicionar"}</button>
              <button type="button" className="btn bg-gray-500 hover:bg-gray-600 text-white" onClick={() => { setShowForm(false); setEditing(null); localStorage.removeItem("pranchas_form_draft"); setForm({ asset_number: "", type: "", capacity: "", year: "", plate: "", chassis: "", status: "Ativo", fleet: "", conjunto: "", is_set: false, asset_number2: "", plate2: "", chassis2: "" }); }}>Cancelar</button>
            </div>
          </form>
        </div>
      )}
      <div className="card p-6 animate-fade overflow-x-auto hidden md:block">
        <table className="table md:min-w-[1100px] min-w-full">
          <thead>
            <tr>
              <th>ID</th>
              <th>Nº Ativo</th>
              <th>Conjunto</th>
              <th>Tipo</th>
              <th>Ano</th>
              <th>Capacidade</th>
              <th>Placa</th>
              <th>Chassi</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, idx) => (
              <tr key={it.id} className={`${idx % 2 === 0 ? 'bg-slate-50 dark:bg-slate-800' : 'bg-white dark:bg-slate-700'} hover:bg-slate-100 dark:hover:bg-slate-600`}>
                <td>{it.id}</td>
                <td>
                  <div>{it.asset_number || ""}</div>
                  {it.is_set && it.asset_number2 && <div className="text-xs text-slate-500 dark:text-slate-400">{it.asset_number2}</div>}
                </td>
                <td>{it.conjunto || ""}</td>
                <td>{it.type || ""}</td>
                <td>{it.year ?? ""}</td>
                <td>{it.capacity ?? ""}</td>
                <td>
                  <div>{it.plate || ""}</div>
                  {it.is_set && it.plate2 && <div className="text-xs text-slate-500 dark:text-slate-400">{it.plate2}</div>}
                </td>
                <td>
                  <div>{it.chassis || ""}</div>
                  {it.is_set && it.chassis2 && <div className="text-xs text-slate-500 dark:text-slate-400">{it.chassis2}</div>}
                </td>
                <td>{it.status}</td>
                <td className="space-x-2">
                  <button className="btn bg-yellow-500 hover:bg-yellow-600 text-white" onClick={() => edit(it)}>Editar</button>
                  <button className="btn bg-red-600 hover:bg-red-700 text-white" onClick={() => del(it.id)}>Excluir</button>
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
              <div className="font-semibold">
                {it.asset_number || "Reboque"}
                {it.is_set && it.asset_number2 && <span className="text-sm font-normal text-slate-500 ml-2">/ {it.asset_number2}</span>}
              </div>
              <div className="text-sm">{it.status}</div>
            </div>
            <div className="text-sm text-slate-600 dark:text-slate-300">Conjunto: {it.conjunto || "-"}</div>
            <div className="text-sm text-slate-600 dark:text-slate-300">Tipo: {it.type || ""}</div>
            <div className="text-sm text-slate-600 dark:text-slate-300">Ano: {it.year ?? ""}</div>
            <div className="text-sm text-slate-600 dark:text-slate-300">Capacidade: {it.capacity ?? ""}</div>
            <div className="text-sm text-slate-600 dark:text-slate-300">
              Placa: {it.plate || ""} {it.is_set && it.plate2 ? ` / ${it.plate2}` : ""}
            </div>
            <div className="text-sm text-slate-600 dark:text-slate-300">
              Chassi: {it.chassis || ""} {it.is_set && it.chassis2 ? ` / ${it.chassis2}` : ""}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <button className="btn bg-yellow-500 hover:bg-yellow-600 text-white" onClick={() => edit(it)}>Editar</button>
              <button className="btn bg-red-600 hover:bg-red-700 text-white" onClick={() => del(it.id)}>Excluir</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

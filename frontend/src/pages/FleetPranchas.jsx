import { useEffect, useState } from "react";
import { getPranchas, savePrancha, updatePrancha, deletePrancha } from "../services/storageService.js";
import { useToast } from "../components/ToastProvider.jsx";
import { supabase } from "../services/supabaseClient.js";

export default function FleetPranchas() {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ asset_number: "", type: "", capacity: "", year: "", plate: "", chassis: "", status: "Ativo" });
  const [editing, setEditing] = useState(null);
  const typeCap = { "Prancha 2 eixos": 20000, "Prancha 3 eixos": 30000, "Prancha 4 eixos": 45000 };
  const load = () => getPranchas().then((r) => setItems(r));
  useEffect(() => {
    load();
    const interval = setInterval(load, 10000);
    let ch;
    if (supabase) {
      ch = supabase
        .channel("public:pranchas")
        .on("postgres_changes", { event: "*", schema: "public", table: "pranchas" }, () => { load(); })
        .subscribe();
    }
    return () => { if (ch) supabase.removeChannel(ch); clearInterval(interval); };
  }, []);
  const maskPlate = (v) => String(v || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0,7);
  const maskChassis = (v) => String(v || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0,17);
  const submit = async (e) => {
    e.preventDefault();
    const payload = { asset_number: form.asset_number || null, type: form.type || null, capacity: form.capacity ? Number(form.capacity) : null, year: form.year ? Number(form.year) : null, plate: form.plate || null, chassis: form.chassis || null, status: form.status || "Ativo" };
    if (!payload.asset_number || !payload.type || !payload.year) { const field = !payload.asset_number ? "Frota" : (!payload.type ? "Tipo" : "Ano"); toast?.show(`Erro → Aba Pranchas → Campo ${field} obrigatório`, "error"); return; }
    if (editing) await updatePrancha(editing.id, payload);
    else await savePrancha(payload);
    setForm({ asset_number: "", type: "", capacity: "", year: "", plate: "", chassis: "", status: "Ativo" });
    toast?.show(editing ? "Prancha atualizada" : "Prancha cadastrada", "success");
    setEditing(null);
    load();
  };
  const edit = (it) => { setEditing(it); setForm({ asset_number: it.asset_number || "", type: it.type || "", capacity: it.capacity?.toString() || "", year: it.year?.toString() || "", plate: it.plate || "", chassis: it.chassis || "", status: it.status }); };
  const del = async (id) => { await deletePrancha(id); load(); };
  return (
    <div className="space-y-8 overflow-x-auto overflow-y-auto min-h-screen page" style={{ WebkitOverflowScrolling: 'touch', overscrollBehaviorX: 'contain', overscrollBehaviorY: 'contain', touchAction: 'pan-y' }}>
      <div className="card p-6 animate-fade">
        <div className="font-semibold mb-4 text-secondary text-xl">Cadastro de Prancha</div>
        <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-6 gap-4">
          <input className="input" placeholder="Frota" value={form.asset_number} onChange={(e) => setForm({ ...form, asset_number: e.target.value })} />
          <select className="select" value={form.type} onChange={(e) => { const tp = e.target.value; setForm({ ...form, type: tp, capacity: typeCap[tp] || "" }); }}>
            <option value="">Tipo da prancha</option>
            <option>Prancha 2 eixos</option>
            <option>Prancha 3 eixos</option>
            <option>Prancha 4 eixos</option>
          </select>
          <input className="input" placeholder="Capacidade" value={form.capacity} readOnly />
          <input className="input" placeholder="Ano" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} />
          <input className="input" placeholder="Placa" value={form.plate} onChange={(e) => setForm({ ...form, plate: maskPlate(e.target.value) })} />
          <input className="input" placeholder="Chassi" value={form.chassis} onChange={(e) => setForm({ ...form, chassis: maskChassis(e.target.value) })} />
          <select className="select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            <option>Ativo</option>
            <option>Manutenção</option>
          </select>
          <button className="btn btn-primary">{editing ? "Salvar" : "Adicionar"}</button>
        </form>
      </div>
      <div className="card p-6 animate-fade overflow-x-auto hidden md:block">
        <table className="table md:min-w-[1100px] min-w-full">
          <thead>
            <tr>
              <th>ID</th>
              <th>Frota</th>
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
                <td>{it.asset_number || ""}</td>
                <td>{it.type || ""}</td>
                <td>{it.year ?? ""}</td>
                <td>{it.capacity ?? ""}</td>
                <td>{it.plate || ""}</td>
                <td>{it.chassis || ""}</td>
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
              <div className="font-semibold">{it.asset_number || "Prancha"}</div>
              <div className="text-sm">{it.status}</div>
            </div>
            <div className="text-sm text-slate-600 dark:text-slate-300">Tipo: {it.type || ""}</div>
            <div className="text-sm text-slate-600 dark:text-slate-300">Ano: {it.year ?? ""}</div>
            <div className="text-sm text-slate-600 dark:text-slate-300">Capacidade: {it.capacity ?? ""}</div>
            <div className="text-sm text-slate-600 dark:text-slate-300">Placa: {it.plate || ""}</div>
            <div className="text-sm text-slate-600 dark:text-slate-300">Chassi: {it.chassis || ""}</div>
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

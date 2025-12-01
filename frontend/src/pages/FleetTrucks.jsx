import { useEffect, useState } from "react";
import { getCaminhoes, saveCaminhao, updateCaminhao, deleteCaminhao } from "../services/storageService.js";
import { useToast } from "../components/ToastProvider.jsx";

export default function FleetTrucks() {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ plate: "", model: "", year: "", chassis: "", km_current: "", fleet: "", status: "Ativo" });
  const [editing, setEditing] = useState(null);
  const load = () => getCaminhoes().then((r) => setItems(r));
  useEffect(() => { load(); }, []);
  const submit = async (e) => {
    e.preventDefault();
    const payload = {
      plate: form.plate || null,
      model: form.model || null,
      year: form.year ? Number(form.year) : null,
      asset_number: form.asset_number || null,
      capacity: form.capacity ? Number(form.capacity) : null,
      km_current: form.km_current ? Number(form.km_current) : null,
      fleet: form.fleet || null,
      status: form.status || "Ativo"
    };
    if (!payload.plate || !payload.model || !payload.year) { toast?.show("Preencha placa, modelo e ano", "error"); return; }
    if (editing) await updateCaminhao(editing.id, payload);
    else await saveCaminhao(payload);
    toast?.show(editing ? "Caminhão atualizado" : "Caminhão cadastrado", "success");
    setForm({ plate: "", model: "", year: "", asset_number: "", capacity: "", km_current: "", fleet: "", status: "Ativo" });
    setEditing(null);
    load();
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
  const edit = (it) => { setEditing(it); setForm({ plate: it.plate || "", model: it.model || "", year: it.year?.toString() || "", chassis: it.chassis || "", km_current: it.km_current?.toString() || "", fleet: it.fleet || "", status: it.status }); toast?.show("Edição carregada", "info"); };
  const del = async (id) => { await deleteCaminhao(id); toast?.show("Caminhão excluído", "success"); load(); };
  const delConfirm = async (id) => { if (!window.confirm("Confirma excluir este caminhão?")) return; await del(id); };
  return (
    <div className="space-y-8 overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch', overscrollBehaviorX: 'contain', touchAction: 'pan-x' }}>
      <div className="card p-6 animate-fade">
        <div className="font-semibold mb-4 text-secondary text-xl">Cadastro de Caminhão</div>
        <form onSubmit={submit} onKeyDown={handleFormKeyDown} className="grid grid-cols-1 md:grid-cols-6 gap-4">
          <input className="input" placeholder="Placa" value={form.plate} onChange={(e) => setForm({ ...form, plate: e.target.value })} />
          <input className="input" placeholder="Modelo" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
          <input className="input" placeholder="Ano" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} />
          <input className="input" placeholder="Chassi" value={form.chassis} onChange={(e) => setForm({ ...form, chassis: e.target.value })} />
          <input className="input" placeholder="KM atual" value={form.km_current} onChange={(e) => setForm({ ...form, km_current: e.target.value })} />
          <input className="input" placeholder="Frota" value={form.fleet} maxLength={7} onChange={(e) => setForm({ ...form, fleet: e.target.value.replace(/\D/g, "").slice(0,7) })} />
          <select className="select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            <option>Ativo</option>
            <option>Manutenção</option>
          </select>
          <button className="btn btn-primary">{editing ? "Salvar" : "Adicionar"}</button>
        </form>
      </div>
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
                <td>{it.chassis || ""}</td>
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
        {items.map((it) => (
          <div key={it.id} className="card p-4">
            <div className="flex justify-between items-center">
              <div className="font-semibold">{it.model || "Caminhão"}</div>
              <div className="text-sm">{it.status}</div>
            </div>
            <div className="text-sm text-slate-600 dark:text-slate-300">Placa: {it.plate || ""}</div>
            <div className="text-sm text-slate-600 dark:text-slate-300">Frota: {it.fleet || ""}</div>
            <div className="text-sm text-slate-600 dark:text-slate-300">KM: {it.km_current ?? ""}</div>
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

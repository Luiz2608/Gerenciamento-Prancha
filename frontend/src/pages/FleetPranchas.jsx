import { useEffect, useState } from "react";
import { getPranchas, savePrancha, updatePrancha, deletePrancha } from "../services/storageService.js";
import { useToast } from "../components/ToastProvider.jsx";

export default function FleetPranchas() {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ asset_number: "", type: "", capacity: "", year: "", status: "Ativo" });
  const [editing, setEditing] = useState(null);
  const load = () => getPranchas().then((r) => setItems(r));
  useEffect(() => { load(); }, []);
  const submit = async (e) => {
    e.preventDefault();
    const payload = { asset_number: form.asset_number || null, type: form.type || null, capacity: form.capacity ? Number(form.capacity) : null, year: form.year ? Number(form.year) : null, status: form.status || "Ativo" };
    if (!payload.asset_number || !payload.type || !payload.year) { toast?.show("Preencha patrimônio, tipo e ano", "error"); return; }
    if (editing) await updatePrancha(editing.id, payload);
    else await savePrancha(payload);
    setForm({ asset_number: "", type: "", capacity: "", year: "", status: "Ativo" });
    toast?.show(editing ? "Prancha atualizada" : "Prancha cadastrada", "success");
    setEditing(null);
    load();
  };
  const edit = (it) => { setEditing(it); setForm({ asset_number: it.asset_number || "", type: it.type || "", capacity: it.capacity?.toString() || "", year: it.year?.toString() || "", status: it.status }); };
  const del = async (id) => { await deletePrancha(id); load(); };
  return (
    <div className="space-y-8">
      <div className="card p-6 animate-fade">
        <div className="font-semibold mb-4 text-secondary text-xl">Cadastro de Prancha</div>
        <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-6 gap-4">
          <input className="input" placeholder="Patrimônio" value={form.asset_number} onChange={(e) => setForm({ ...form, asset_number: e.target.value })} />
          <input className="input" placeholder="Tipo da prancha" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} />
          <input className="input" placeholder="Capacidade" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
          <input className="input" placeholder="Ano" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} />
          <select className="select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            <option>Ativo</option>
            <option>Manutenção</option>
          </select>
          <button className="btn btn-primary">{editing ? "Salvar" : "Adicionar"}</button>
        </form>
      </div>
      <div className="card p-6 animate-fade overflow-x-auto">
        <table className="table min-w-[900px]">
          <thead>
            <tr>
              <th>ID</th>
              <th>Patrimônio</th>
              <th>Tipo</th>
              <th>Ano</th>
              <th>Capacidade</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, idx) => (
              <tr key={it.id} className={`${idx % 2 === 0 ? 'bg-slate-50' : 'bg-white'} hover:bg-slate-100`}>
                <td>{it.id}</td>
                <td>{it.asset_number || ""}</td>
                <td>{it.type || ""}</td>
                <td>{it.year ?? ""}</td>
                <td>{it.capacity ?? ""}</td>
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
    </div>
  );
}

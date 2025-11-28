import { useEffect, useState } from "react";
import { getPranchas, savePrancha, updatePrancha, deletePrancha } from "../services/storageService.js";

export default function FleetPranchas() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ identifier: "", model: "", year: "", asset_number: "", capacity: "", notes: "", status: "Ativo" });
  const [editing, setEditing] = useState(null);
  const load = () => getPranchas().then((r) => setItems(r));
  useEffect(() => { load(); }, []);
  const submit = async (e) => {
    e.preventDefault();
    const payload = {
      identifier: form.identifier || null,
      model: form.model || null,
      year: form.year ? Number(form.year) : null,
      asset_number: form.asset_number || null,
      capacity: form.capacity ? Number(form.capacity) : null,
      notes: form.notes || null,
      status: form.status || "Ativo"
    };
    if (editing) await updatePrancha(editing.id, payload);
    else await savePrancha(payload);
    setForm({ identifier: "", model: "", year: "", asset_number: "", capacity: "", notes: "", status: "Ativo" });
    setEditing(null);
    load();
  };
  const edit = (it) => { setEditing(it); setForm({ identifier: it.identifier || "", model: it.model || "", year: it.year?.toString() || "", asset_number: it.asset_number || "", capacity: it.capacity?.toString() || "", notes: it.notes || "", status: it.status }); };
  const del = async (id) => { await deletePrancha(id); load(); };
  return (
    <div className="space-y-8">
      <div className="card p-6 animate-fade">
        <div className="font-semibold mb-4 text-secondary text-xl">Cadastro de Prancha</div>
        <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-6 gap-4">
          <input className="input" placeholder="Identificação" value={form.identifier} onChange={(e) => setForm({ ...form, identifier: e.target.value })} />
          <input className="input" placeholder="Modelo" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
          <input className="input" placeholder="Ano" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} />
          <input className="input" placeholder="Patrimônio" value={form.asset_number} onChange={(e) => setForm({ ...form, asset_number: e.target.value })} />
          <input className="input" placeholder="Capacidade" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
          <input className="input md:col-span-6" placeholder="Observações" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <select className="select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            <option>Ativo</option>
            <option>Inativo</option>
          </select>
          <button className="btn btn-primary">{editing ? "Salvar" : "Adicionar"}</button>
        </form>
      </div>
      <div className="card p-6 animate-fade overflow-x-auto">
        <table className="table min-w-[900px]">
          <thead>
            <tr>
              <th>ID</th>
              <th>Identificação</th>
              <th>Modelo</th>
              <th>Ano</th>
              <th>Patrimônio</th>
              <th>Capacidade</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, idx) => (
              <tr key={it.id} className={`${idx % 2 === 0 ? 'bg-slate-50' : 'bg-white'} hover:bg-slate-100`}>
                <td>{it.id}</td>
                <td>{it.identifier || ""}</td>
                <td>{it.model || ""}</td>
                <td>{it.year ?? ""}</td>
                <td>{it.asset_number || ""}</td>
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

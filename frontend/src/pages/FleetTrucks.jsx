import { useEffect, useState } from "react";
import { getCaminhoes, saveCaminhao, updateCaminhao, deleteCaminhao } from "../services/storageService.js";

export default function FleetTrucks() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ plate: "", model: "", year: "", asset_number: "", capacity: "", km_current: "", status: "Ativo" });
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
      status: form.status || "Ativo"
    };
    if (editing) await updateCaminhao(editing.id, payload);
    else await saveCaminhao(payload);
    setForm({ plate: "", model: "", year: "", asset_number: "", capacity: "", km_current: "", status: "Ativo" });
    setEditing(null);
    load();
  };
  const edit = (it) => { setEditing(it); setForm({ plate: it.plate || "", model: it.model || "", year: it.year?.toString() || "", asset_number: it.asset_number || "", capacity: it.capacity?.toString() || "", km_current: it.km_current?.toString() || "", status: it.status }); };
  const del = async (id) => { await deleteCaminhao(id); load(); };
  return (
    <div className="space-y-8">
      <div className="card p-6 animate-fade">
        <div className="font-semibold mb-4 text-secondary text-xl">Cadastro de Caminhão</div>
        <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-6 gap-4">
          <input className="input" placeholder="Placa" value={form.plate} onChange={(e) => setForm({ ...form, plate: e.target.value })} />
          <input className="input" placeholder="Modelo" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
          <input className="input" placeholder="Ano" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} />
          <input className="input" placeholder="Patrimônio" value={form.asset_number} onChange={(e) => setForm({ ...form, asset_number: e.target.value })} />
          <input className="input" placeholder="Capacidade" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
          <input className="input" placeholder="KM atual" value={form.km_current} onChange={(e) => setForm({ ...form, km_current: e.target.value })} />
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
              <th>Placa</th>
              <th>Modelo</th>
              <th>Ano</th>
              <th>Patrimônio</th>
              <th>Capacidade</th>
              <th>KM atual</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, idx) => (
              <tr key={it.id} className={`${idx % 2 === 0 ? 'bg-slate-50' : 'bg-white'} hover:bg-slate-100`}>
                <td>{it.id}</td>
                <td>{it.plate || ""}</td>
                <td>{it.model || ""}</td>
                <td>{it.year ?? ""}</td>
                <td>{it.asset_number || ""}</td>
                <td>{it.capacity ?? ""}</td>
                <td>{it.km_current ?? ""}</td>
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

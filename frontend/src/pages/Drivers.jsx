import { useEffect, useState } from "react";
import api from "../services/api.js";

export default function Drivers() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ name: "", cpf: "", cnh_category: "", status: "Ativo" });
  const [editing, setEditing] = useState(null);

  const load = () => api.get("/drivers").then((r) => setItems(r.data));
  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (editing) {
      await api.put(`/drivers/${editing.id}`, form);
    } else {
      await api.post("/drivers", form);
    }
    setForm({ name: "", cpf: "", cnh_category: "", status: "Ativo" });
    setEditing(null);
    load();
  };

  const edit = (it) => {
    setEditing(it);
    setForm({ name: it.name, cpf: it.cpf || "", cnh_category: it.cnh_category || "", status: it.status });
  };

  const del = async (id) => {
    await api.delete(`/drivers/${id}`);
    load();
  };

  return (
    <div className="space-y-8">
      <div className="card p-6 animate-fade">
        <div className="font-semibold mb-4 text-secondary text-xl">Cadastro de Motoristas</div>
        <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <input className="input" placeholder="Nome" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="input" placeholder="CPF" value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })} />
          <input className="input" placeholder="CNH" value={form.cnh_category} onChange={(e) => setForm({ ...form, cnh_category: e.target.value })} />
          <select className="select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            <option>Ativo</option>
            <option>Inativo</option>
          </select>
          <button className="btn btn-primary">{editing ? "Salvar" : "Adicionar"}</button>
        </form>
      </div>
      <div className="card p-6 animate-fade overflow-x-auto">
        <table className="table min-w-[700px]">
          <thead>
            <tr>
              <th>ID</th>
              <th>Nome</th>
              <th>CPF</th>
              <th>CNH</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, idx) => (
              <tr key={it.id} className={`${idx % 2 === 0 ? 'bg-slate-50' : 'bg-white'} hover:bg-slate-100`}>
                <td>{it.id}</td>
                <td>{it.name}</td>
                <td>{it.cpf || ""}</td>
                <td>{it.cnh_category || ""}</td>
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

import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import api from "../services/api.js";

export default function Trips() {
  const location = useLocation();
  const [drivers, setDrivers] = useState([]);
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ date: "", driver_id: "", destination: "", service_type: "", description: "", start_time: "", end_time: "", km_start: "", km_end: "" });
  const [editing, setEditing] = useState(null);

  const loadDrivers = () => api.get("/drivers").then((r) => setDrivers(r.data));
  const loadTrips = () => api.get("/trips", { params: { page: 1, pageSize: 20 } }).then((r) => setItems(r.data.data));
  useEffect(() => { loadDrivers(); loadTrips(); }, []);
  useEffect(() => {
    const id = new URLSearchParams(location.search).get("editId");
    if (id) {
      api.get(`/trips/${id}`).then((r) => {
        const it = r.data;
        setEditing(it);
        setForm({
          date: it.date || "",
          driver_id: it.driver_id?.toString() || "",
          destination: it.destination || "",
          service_type: it.service_type || "",
          description: it.description || "",
          start_time: it.start_time || "",
          end_time: it.end_time || "",
          km_start: it.km_start?.toString() || "",
          km_end: it.km_end?.toString() || ""
        });
      });
    }
  }, [location.search]);

  const submit = async (e) => {
    e.preventDefault();
    const payload = {
      ...form,
      driver_id: form.driver_id ? Number(form.driver_id) : null,
      km_start: form.km_start !== "" ? Number(form.km_start) : null,
      km_end: form.km_end !== "" ? Number(form.km_end) : null
    };
    if (editing) await api.put(`/trips/${editing.id}`, payload);
    else await api.post("/trips", payload);
    setForm({ date: "", driver_id: "", destination: "", service_type: "", description: "", start_time: "", end_time: "", km_start: "", km_end: "" });
    setEditing(null);
    loadTrips();
  };

  const edit = (it) => {
    setEditing(it);
    setForm({
      date: it.date || "",
      driver_id: it.driver_id?.toString() || "",
      destination: it.destination || "",
      service_type: it.service_type || "",
      description: it.description || "",
      start_time: it.start_time || "",
      end_time: it.end_time || "",
      km_start: it.km_start?.toString() || "",
      km_end: it.km_end?.toString() || ""
    });
  };

  const del = async (id) => { await api.delete(`/trips/${id}`); loadTrips(); };

  return (
    <div className="space-y-8">
      <div className="card p-6 animate-fade">
        <div className="font-semibold mb-4 text-secondary text-xl">Cadastro de Viagens</div>
        <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <input className="input" placeholder="Data (YYYY-MM-DD)" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          <select className="select" value={form.driver_id} onChange={(e) => setForm({ ...form, driver_id: e.target.value })}>
            <option value="">Motorista</option>
            {drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <input className="input" placeholder="Destino" value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} />
          <input className="input" placeholder="Tipo de serviço" value={form.service_type} onChange={(e) => setForm({ ...form, service_type: e.target.value })} />
          <input className="input md:col-span-4" placeholder="Descrição" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <input className="input" placeholder="Hora saída (HH:MM)" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
          <input className="input" placeholder="Hora retorno (HH:MM)" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} />
          <input className="input" placeholder="KM inicial" value={form.km_start} onChange={(e) => setForm({ ...form, km_start: e.target.value })} />
          <input className="input" placeholder="KM final" value={form.km_end} onChange={(e) => setForm({ ...form, km_end: e.target.value })} />
          <button className="btn btn-primary">{editing ? "Salvar" : "Adicionar"}</button>
        </form>
      </div>
      <div className="card p-6 animate-fade overflow-x-auto">
        <table className="table min-w-[900px]">
          <thead>
            <tr>
              <th>ID</th>
              <th>Data</th>
              <th>Motorista</th>
              <th>Destino</th>
              <th>Tipo</th>
              <th>Status</th>
              <th>KM</th>
              <th>Horas</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, idx) => (
              <tr key={it.id} className={`${idx % 2 === 0 ? 'bg-slate-50' : 'bg-white'} hover:bg-slate-100`}>
                <td>{it.id}</td>
                <td>{it.date}</td>
                <td>{drivers.find((d) => d.id === it.driver_id)?.name || it.driver_id}</td>
                <td>{it.destination || ""}</td>
                <td>{it.service_type || ""}</td>
                <td>{it.status}</td>
                <td>{it.km_rodado}</td>
                <td>{it.horas}</td>
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

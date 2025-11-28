import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { getMotoristas, getViagens, getViagem, saveViagem, updateViagem, deleteViagem, getCaminhoes, getPranchas } from "../services/storageService.js";
import { useToast } from "../components/ToastProvider.jsx";

export default function Trips() {
  const toast = useToast();
  const location = useLocation();
  const [drivers, setDrivers] = useState([]);
  const [trucks, setTrucks] = useState([]);
  const [pranchas, setPranchas] = useState([]);
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ date: "", driver_id: "", truck_id: "", prancha_id: "", destination: "", service_type: "", description: "", start_time: "", end_time: "", km_start: "", km_end: "", fuel_liters: "", fuel_price: "", other_costs: "", maintenance_cost: "", driver_daily: "" });
  const [editing, setEditing] = useState(null);

  const loadDrivers = () => getMotoristas().then((r) => setDrivers(r));
  const loadTrucks = () => getCaminhoes().then((r) => setTrucks(r.filter((x) => x.status === "Ativo")));
  const loadPranchas = () => getPranchas().then((r) => setPranchas(r.filter((x) => x.status === "Ativo")));
  const loadTrips = () => getViagens({ page: 1, pageSize: 20 }).then((r) => setItems(r.data));
  useEffect(() => { loadDrivers(); loadTrucks(); loadPranchas(); loadTrips(); }, []);
  useEffect(() => {
    const id = new URLSearchParams(location.search).get("editId");
    if (id) {
      getViagem(id).then((it) => {
        setEditing(it);
        setForm({
          date: it.date || "",
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
          fuel_liters: it.fuel_liters?.toString() || "",
          fuel_price: it.fuel_price?.toString() || "",
          other_costs: it.other_costs?.toString() || ""
        });
      });
    }
  }, [location.search]);

  const submit = async (e) => {
    e.preventDefault();
    const payload = {
      ...form,
      driver_id: form.driver_id ? Number(form.driver_id) : null,
      truck_id: form.truck_id ? Number(form.truck_id) : null,
      prancha_id: form.prancha_id ? Number(form.prancha_id) : null,
      km_start: form.km_start !== "" ? Number(form.km_start) : null,
      km_end: form.km_end !== "" ? Number(form.km_end) : null,
      fuel_liters: form.fuel_liters !== "" ? Number(form.fuel_liters) : 0,
      fuel_price: form.fuel_price !== "" ? Number(form.fuel_price) : 0,
      other_costs: form.other_costs !== "" ? Number(form.other_costs) : 0
    };
    if (!payload.date || !payload.driver_id || !payload.truck_id || !payload.prancha_id) { toast?.show("Data, motorista, caminhão e prancha são obrigatórios", "error"); return; }
    if (editing) await updateViagem(editing.id, payload);
    else await saveViagem(payload);
    toast?.show(editing ? "Viagem atualizada" : "Viagem cadastrada", "success");
    setForm({ date: "", driver_id: "", truck_id: "", prancha_id: "", destination: "", service_type: "", description: "", start_time: "", end_time: "", km_start: "", km_end: "", fuel_liters: "", fuel_price: "", other_costs: "", maintenance_cost: "", driver_daily: "" });
    setEditing(null);
    loadTrips();
  };

  const edit = (it) => {
    setEditing(it);
    setForm({
      date: it.date || "",
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
      fuel_liters: it.fuel_liters?.toString() || "",
      fuel_price: it.fuel_price?.toString() || "",
      other_costs: it.other_costs?.toString() || ""
    });
  };

  const del = async (id) => { await deleteViagem(id); toast?.show("Viagem excluída", "success"); loadTrips(); };

  return (
    <div className="space-y-8">
      <div className="card p-6 animate-fade">
        <div className="font-semibold mb-4 text-secondary text-xl">Cadastro de Viagens</div>
        <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <input className={`input ${!form.date && 'ring-red-500 border-red-500'}`} placeholder="Data (YYYY-MM-DD)" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          <select className={`select ${!form.driver_id && 'ring-red-500 border-red-500'}`} value={form.driver_id} onChange={(e) => setForm({ ...form, driver_id: e.target.value })}>
            <option value="">Motorista</option>
            {drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <select className={`select ${!form.truck_id && 'ring-red-500 border-red-500'}`} value={form.truck_id} onChange={(e) => setForm({ ...form, truck_id: e.target.value })}>
            <option value="">Caminhão</option>
            {trucks.map((t) => <option key={t.id} value={t.id}>{t.plate || t.model || t.id}</option>)}
          </select>
          <select className={`select ${!form.prancha_id && 'ring-red-500 border-red-500'}`} value={form.prancha_id} onChange={(e) => setForm({ ...form, prancha_id: e.target.value })}>
            <option value="">Prancha</option>
            {pranchas.map((p) => <option key={p.id} value={p.id}>{p.identifier || p.model || p.id}</option>)}
          </select>
          <input className="input" placeholder="Destino" value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} />
          <input className="input" placeholder="Tipo de serviço" value={form.service_type} onChange={(e) => setForm({ ...form, service_type: e.target.value })} />
          <input className="input md:col-span-4" placeholder="Descrição" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <input className="input" placeholder="Hora saída (HH:MM)" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
          <input className="input" placeholder="Hora retorno (HH:MM)" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} />
          <input className="input" placeholder="KM inicial" value={form.km_start} onChange={(e) => setForm({ ...form, km_start: e.target.value })} />
          <input className="input" placeholder="KM final" value={form.km_end} onChange={(e) => setForm({ ...form, km_end: e.target.value })} />
          <input className={`input ${!form.fuel_liters && 'ring-red-500 border-red-500'}`} placeholder="Combustível (litros)" value={form.fuel_liters} onChange={(e) => setForm({ ...form, fuel_liters: e.target.value })} />
          <input className={`input ${!form.fuel_price && 'ring-red-500 border-red-500'}`} placeholder="Valor combustível (R$/litro)" value={form.fuel_price} onChange={(e) => setForm({ ...form, fuel_price: e.target.value })} />
          <input className="input" placeholder="Outros custos (R$)" value={form.other_costs} onChange={(e) => setForm({ ...form, other_costs: e.target.value })} />
          <input className="input" placeholder="Manutenção (R$)" value={form.maintenance_cost} onChange={(e) => setForm({ ...form, maintenance_cost: e.target.value })} />
          <input className="input" placeholder="Diária do motorista (R$)" value={form.driver_daily} onChange={(e) => setForm({ ...form, driver_daily: e.target.value })} />
          <button className="btn btn-primary">{editing ? "Salvar" : "Adicionar"}</button>
        </form>
      </div>
      <div className="card p-6 animate-fade overflow-x-auto">
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
                <td>{it.date}</td>
                <td>{drivers.find((d) => d.id === it.driver_id)?.name || it.driver_id}</td>
                <td>{trucks.find((t) => t.id === it.truck_id)?.plate || it.truck_id || ""}</td>
                <td>{pranchas.find((p) => p.id === it.prancha_id)?.identifier || it.prancha_id || ""}</td>
                <td>{it.destination || ""}</td>
                <td>{it.service_type || ""}</td>
                <td>{it.status}</td>
                <td>{it.km_rodado}</td>
                <td>{it.horas}</td>
                <td>{(it.total_cost ?? 0).toFixed(2)}</td>
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

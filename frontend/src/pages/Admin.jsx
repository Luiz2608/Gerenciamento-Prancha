import { useEffect, useState } from "react";
import api from "../services/api.js";

export default function Admin() {
  const [dest, setDest] = useState([]);
  const [svc, setSvc] = useState([]);
  const [truck, setTruck] = useState({ plate: "", model: "", year: "" });
  const [dname, setDname] = useState("");
  const [sname, setSname] = useState("");

  const load = () => {
    api.get("/admin/destinations").then((r) => setDest(r.data));
    api.get("/admin/service-types").then((r) => setSvc(r.data));
    api.get("/admin/truck").then((r) => setTruck({ plate: r.data?.plate || "", model: r.data?.model || "", year: r.data?.year?.toString() || "" }));
  };
  useEffect(() => { load(); }, []);

  const addDest = async () => { if (!dname) return; await api.post("/admin/destinations", { name: dname }); setDname(""); load(); };
  const delDest = async (id) => { await api.delete(`/admin/destinations/${id}`); load(); };
  const addSvc = async () => { if (!sname) return; await api.post("/admin/service-types", { name: sname }); setSname(""); load(); };
  const delSvc = async (id) => { await api.delete(`/admin/service-types/${id}`); load(); };
  const saveTruck = async () => { await api.put("/admin/truck", { ...truck, year: truck.year ? Number(truck.year) : null }); load(); };
  const backup = async () => {
    const r = await api.get("/admin/backup", { responseType: "blob" });
    const url = URL.createObjectURL(r.data);
    const a = document.createElement("a");
    a.href = url;
    a.download = "database.sqlite";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8 animate-fade">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card p-6">
          <div className="font-semibold mb-3 text-secondary">Destinos favoritos</div>
          <div className="flex gap-2 mb-3">
            <input className="input flex-1" placeholder="Destino" value={dname} onChange={(e) => setDname(e.target.value)} />
            <button className="btn btn-primary" onClick={addDest}>Adicionar</button>
          </div>
          <ul className="space-y-2">
            {dest.map((d) => (
              <li key={d.id} className="flex justify-between items-center border p-3 rounded-xl">
                <span>{d.name}</span>
                <button className="btn bg-red-600 hover:bg-red-700 text-white" onClick={() => delDest(d.id)}>Excluir</button>
              </li>
            ))}
          </ul>
        </div>
        <div className="card p-6">
          <div className="font-semibold mb-3 text-secondary">Tipos de serviço</div>
          <div className="flex gap-2 mb-3">
            <input className="input flex-1" placeholder="Tipo" value={sname} onChange={(e) => setSname(e.target.value)} />
            <button className="btn btn-primary" onClick={addSvc}>Adicionar</button>
          </div>
          <ul className="space-y-2">
            {svc.map((s) => (
              <li key={s.id} className="flex justify-between items-center border p-3 rounded-xl">
                <span>{s.name}</span>
                <button className="btn bg-red-600 hover:bg-red-700 text-white" onClick={() => delSvc(s.id)}>Excluir</button>
              </li>
            ))}
          </ul>
        </div>
        <div className="card p-6">
          <div className="font-semibold mb-3 text-secondary">Caminhão</div>
          <div className="space-y-3">
            <input className="input w-full" placeholder="Placa" value={truck.plate} onChange={(e) => setTruck({ ...truck, plate: e.target.value })} />
            <input className="input w-full" placeholder="Modelo" value={truck.model} onChange={(e) => setTruck({ ...truck, model: e.target.value })} />
            <input className="input w-full" placeholder="Ano" value={truck.year} onChange={(e) => setTruck({ ...truck, year: e.target.value })} />
            <button className="btn btn-primary" onClick={saveTruck}>Salvar</button>
          </div>
        </div>
      </div>
      <div className="card p-6">
        <button className="btn btn-secondary" onClick={backup}>Fazer backup</button>
      </div>
    </div>
  );
}

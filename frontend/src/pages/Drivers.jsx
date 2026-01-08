import { useEffect, useState, useRef } from "react";
import { getMotoristas, saveMotorista, updateMotorista, deleteMotorista } from "../services/storageService.js";
import { useToast } from "../components/ToastProvider.jsx";
import { supabase } from "../services/supabaseClient.js";

export default function Drivers() {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [form, setForm] = useState(() => {
    const saved = localStorage.getItem("drivers_form_draft");
    return saved ? JSON.parse(saved) : { name: "", cpf: "", cnh_category: "", status: "Ativo" };
  });

  useEffect(() => {
    if (!editing) {
      localStorage.setItem("drivers_form_draft", JSON.stringify(form));
    }
  }, [form, editing]);

  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const formRef = useRef(null);

  const load = () => getMotoristas().then((r) => setItems(r));
  useEffect(() => {
    load();
    const interval = setInterval(load, 10000);
    let ch;
    if (supabase) {
      ch = supabase
        .channel("public:motoristas")
        .on("postgres_changes", { event: "*", schema: "public", table: "motoristas" }, () => { load(); })
        .subscribe();
    }
    return () => { if (ch) supabase.removeChannel(ch); clearInterval(interval); };
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name) { toast?.show("Erro → Aba Motoristas → Campo Nome obrigatório", "error"); return; }
    if (editing) { await updateMotorista(editing.id, form); toast?.show("Motorista atualizado", "success"); }
    else { await saveMotorista(form); toast?.show("Motorista cadastrado", "success"); }
    localStorage.removeItem("drivers_form_draft");
    setForm({ name: "", cpf: "", cnh_category: "", status: "Ativo" });
    setEditing(null);
    setShowForm(false);
    load();
    window.scrollTo({ top: 0, behavior: 'smooth' });
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

  const edit = (it) => {
    setEditing(it);
    setForm({ name: it.name, cpf: it.cpf || "", cnh_category: it.cnh_category || "", status: it.status });
    setShowForm(true);
    toast?.show("Edição carregada", "info");
    setTimeout(() => {
      if (formRef.current) formRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      else window.scrollTo({ top: 0, behavior: "smooth" });
    }, 100);
  };

  const maskCpf = (v) => {
    const d = String(v || "").replace(/\D/g, "").slice(0,11);
    const p1 = d.slice(0,3);
    const p2 = d.slice(3,6);
    const p3 = d.slice(6,9);
    const p4 = d.slice(9,11);
    return [p1, p2, p3].filter(Boolean).join(".") + (p4 ? "-" + p4 : "");
  };
  const maskDigits = (v, n) => String(v || "").replace(/\D/g, "").slice(0, n || 20);

  const del = async (id) => { await deleteMotorista(id); toast?.show("Motorista excluído", "success"); load(); };
  const delConfirm = async (id) => { if (!window.confirm("Confirma excluir este motorista?")) return; await del(id); };

  const filteredItems = items.filter((it) => 
    it.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (it.cpf && it.cpf.includes(searchTerm))
  );

  return (
    <div className="space-y-8 overflow-x-auto overflow-y-auto min-h-screen page" style={{ WebkitOverflowScrolling: 'touch', overscrollBehaviorX: 'contain', overscrollBehaviorY: 'contain', touchAction: 'pan-y' }}>
      {!showForm && !editing && (
        <div className="flex justify-end mb-4">
          <button className="btn btn-primary w-full md:w-auto" onClick={() => setShowForm(true)}>Novo</button>
        </div>
      )}

      {(showForm || editing) && (
        <div ref={formRef} className="card p-6 animate-fade">
          <div className="font-semibold mb-4 text-secondary text-xl">Cadastro de Motoristas</div>
          <form onSubmit={submit} onKeyDown={handleFormKeyDown} className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <input className="input" placeholder="Nome" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input className="input" placeholder="CPF" value={form.cpf} onChange={(e) => setForm({ ...form, cpf: maskCpf(e.target.value) })} />
            <input className="input" placeholder="CNH" value={form.cnh_category} onChange={(e) => setForm({ ...form, cnh_category: maskDigits(e.target.value, 12) })} />
            <select className="select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option>Ativo</option>
              <option>Inativo</option>
            </select>
            <div className="flex gap-2">
              <button className="btn btn-primary flex-1">{editing ? "Salvar" : "Adicionar"}</button>
              <button type="button" className="btn bg-gray-500 hover:bg-gray-600 text-white" onClick={() => { setShowForm(false); setEditing(null); localStorage.removeItem("drivers_form_draft"); setForm({ name: "", cpf: "", cnh_category: "", status: "Ativo" }); }}>Cancelar</button>
            </div>
          </form>
        </div>
      )}

      <div className="card p-4 animate-fade flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input 
          className="input w-full" 
          placeholder="Buscar motorista por nome ou CPF..." 
          value={searchTerm} 
          onChange={(e) => setSearchTerm(e.target.value)} 
        />
      </div>

      <div className="card p-6 animate-fade overflow-x-auto hidden md:block">
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
            {filteredItems.map((it, idx) => (
              <tr key={it.id} className={`${idx % 2 === 0 ? 'bg-slate-50 dark:bg-slate-800' : 'bg-white dark:bg-slate-700'} hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-900 dark:text-slate-100`}>
                <td>{it.id}</td>
                <td>{it.name}</td>
                <td>{it.cpf || ""}</td>
                <td>{it.cnh_category || ""}</td>
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
        {filteredItems.map((it) => (
          <div key={it.id} className="card p-4">
            <div className="flex justify-between items-center">
              <div className="font-semibold">{it.name}</div>
              <div className="text-sm">{it.status}</div>
            </div>
            <div className="text-sm text-slate-600 dark:text-slate-300">CPF: {it.cpf || ""}</div>
            <div className="text-sm text-slate-600 dark:text-slate-300">CNH: {it.cnh_category || ""}</div>
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

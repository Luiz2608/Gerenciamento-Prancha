import { useEffect, useState, useRef } from "react";
import { getMotoristas, saveMotorista, updateMotorista, deleteMotorista } from "../services/storageService.js";
import { useToast } from "../components/ToastProvider.jsx";
import { User, CreditCard, FileText, Search, Plus, Edit2, Trash2 } from "lucide-react";

export default function Drivers() {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [form, setForm] = useState(() => {
    const saved = localStorage.getItem("drivers_form_draft");
    return saved ? JSON.parse(saved) : { name: "", cpf: "", cnh_category: "", status: "Ativo" };
  });

  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const formRef = useRef(null);

  const load = () => {
    getMotoristas({ page, pageSize, search: searchTerm }).then((r) => {
      if (r.data) {
        setItems(r.data);
        setTotal(r.total);
      } else {
        setItems(r);
        setTotal(r.length);
      }
    });
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 10000);
    
    let channel = null;
    const initRealtime = async () => {
      const { supabase } = await import("../services/supabaseClient.js");
      if (supabase) {
        channel = supabase
          .channel("public:motoristas")
          .on("postgres_changes", { event: "*", schema: "public", table: "motoristas" }, () => { load(); })
          .subscribe();
      }
    };
    initRealtime();

    return () => { 
      if (channel) {
         import("../services/supabaseClient.js").then(({ supabase }) => {
            if(supabase) supabase.removeChannel(channel);
         });
      }
      clearInterval(interval); 
    };
  }, [page, pageSize, searchTerm]);

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

  const maskCPF = (v) => {
    const d = String(v || "").replace(/\D/g, "").slice(0,11);
    const p1 = d.slice(0,3);
    const p2 = d.slice(3,6);
    const p3 = d.slice(6,9);
    const p4 = d.slice(9,11);
    return [p1, p2, p3].filter(Boolean).join(".") + (p4 ? "-" + p4 : "");
  };

  const remove = async (id) => { 
    if (!window.confirm("Confirma excluir este motorista?")) return;
    await deleteMotorista(id); 
    toast?.show("Motorista excluído", "success"); 
    load(); 
  };

  useEffect(() => {
    if (!editing) {
      localStorage.setItem("drivers_form_draft", JSON.stringify(form));
    }
  }, [form, editing]);

  const filteredItems = items;

  return (
    <div className="p-4 max-w-6xl mx-auto pb-24">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Gerenciar Motoristas</h1>
        <button
          onClick={() => {
            setEditing(null);
            setForm({ name: "", cpf: "", cnh_category: "", status: "Ativo" });
            setShowForm(!showForm);
          }}
          className="btn btn-primary flex items-center gap-2"
        >
          <Plus size={20} />
          {showForm ? "Fechar Formulário" : "Novo Motorista"}
        </button>
      </div>

      {showForm && (
        <div ref={formRef} className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 mb-8 animate-fade-in">
          <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Nome Completo</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  required
                  className="input pl-10"
                  placeholder="Ex: João da Silva"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="label">CPF</label>
              <div className="relative">
                <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  required
                  className="input pl-10"
                  placeholder="000.000.000-00"
                  maxLength={14}
                  value={form.cpf}
                  onChange={(e) => setForm({ ...form, cpf: maskCPF(e.target.value) })}
                />
              </div>
            </div>
            <div>
              <label className="label">Categoria CNH</label>
              <div className="relative">
                <FileText className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <select
                  className="input pl-10"
                  value={form.cnh_category}
                  onChange={(e) => setForm({ ...form, cnh_category: e.target.value })}
                >
                  <option value="">Selecione...</option>
                  <option value="C">C</option>
                  <option value="D">D</option>
                  <option value="E">E</option>
                </select>
              </div>
            </div>
            <div>
              <label className="label">Status</label>
              <select
                className="input"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                <option value="Ativo">Ativo</option>
                <option value="Inativo">Inativo</option>
                <option value="Férias">Férias</option>
              </select>
            </div>
            <div className="md:col-span-2 flex justify-end gap-2 mt-2">
              {editing && (
                <button
                  type="button"
                  onClick={() => {
                    setEditing(null);
                    setForm({ name: "", cpf: "", cnh_category: "", status: "Ativo" });
                    setShowForm(false);
                  }}
                  className="btn btn-ghost"
                >
                  Cancelar
                </button>
              )}
              <button type="submit" className="btn btn-primary px-8">
                {editing ? "Atualizar" : "Salvar"}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              className="input pl-10"
              placeholder="Buscar por nome ou CPF..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
            />
          </div>
        </div>

        {/* Mobile List */}
        <div className="md:hidden divide-y divide-slate-100">
          {filteredItems.map((item) => (
            <div key={item.id} className="p-4 hover:bg-slate-50 transition-colors">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="font-semibold text-slate-800">{item.name}</h3>
                  <p className="text-sm text-slate-500">{item.cpf}</p>
                </div>
                <span
                  className={`px-2 py-1 rounded-full text-xs font-medium ${
                    item.status === "Ativo"
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {item.status}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm text-slate-500 mt-2">
                <span className="flex items-center gap-1">
                  <FileText size={14} /> Cat. {item.cnh_category || "-"}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => edit(item)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <Edit2 size={18} />
                  </button>
                  <button
                    onClick={() => remove(item.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            </div>
          ))}
          {filteredItems.length === 0 && (
            <div className="p-8 text-center text-slate-500">Nenhum motorista encontrado</div>
          )}
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-slate-600 font-semibold text-sm">
              <tr>
                <th className="p-4">Nome</th>
                <th className="p-4">CPF</th>
                <th className="p-4">CNH</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredItems.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-4 font-medium text-slate-800">{item.name}</td>
                  <td className="p-4 text-slate-600">{item.cpf}</td>
                  <td className="p-4 text-slate-600">{item.cnh_category || "-"}</td>
                  <td className="p-4">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        item.status === "Ativo"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {item.status}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => edit(item)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Editar"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button
                        onClick={() => remove(item.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Excluir"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredItems.length === 0 && (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-slate-500">
                    Nenhum motorista encontrado
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between mt-4">
        <div className="text-sm text-slate-500">
           Registros: {total}
        </div>
        <div className="flex items-center gap-2">
          <button
            className="btn btn-sm border border-slate-300"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            Anterior
          </button>
          <span className="text-sm text-slate-600">
            Página {page}
          </span>
          <button
            className="btn btn-sm border border-slate-300"
            disabled={page * pageSize >= total}
            onClick={() => setPage(page + 1)}
          >
            Próxima
          </button>
          <select
            className="select select-sm !py-1"
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
        </div>
      </div>
    </div>
  );
}

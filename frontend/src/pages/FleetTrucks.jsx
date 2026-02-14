import { useEffect, useState, useRef } from "react";
import { getCaminhoes, saveCaminhao, updateCaminhao, deleteCaminhao, uploadTruckDocument, getDocumentosByCaminhao } from "../services/storageService.js";
import { supabase } from "../services/supabaseClient.js";
import { useToast } from "../components/ToastProvider.jsx";
import { extractDocumentAI } from "../services/integrationService.js";
import ReviewDialog from "../components/ReviewDialog.jsx";

export default function FleetTrucks() {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(() => {
    const saved = localStorage.getItem("trucks_form_draft");
    return saved ? JSON.parse(saved) : { 
      plate: "", model: "", year: "", chassis: "", km_current: "", fleet: "", category: "Canavieiro", status: "Ativo",
      vehicle_value: "", residual_value: "", useful_life_km: "1000000", avg_consumption: "2.5",
      annual_maintenance: "", annual_insurance: "", annual_taxes: "", annual_km: "120000"
    };
  });
  
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const formRef = useRef(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewExtracted, setReviewExtracted] = useState(null);
  const [reviewServerDoc, setReviewServerDoc] = useState(null);
  const [reviewTruck, setReviewTruck] = useState(null);
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [categoryOtherValue, setCategoryOtherValue] = useState("");
  const previousCategoryRef = useRef(null);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(0);

  const maskPlate = (v) => {
    const s = String(v || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0,7);
    return s;
  };
  const isValidPlateBr = (s) => /^[A-Z]{3}[0-9][A-Z][0-9]{2}$/.test(String(s)) || /^[A-Z]{3}[0-9]{4}$/.test(String(s));
  const maskChassis = (v) => String(v || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0,17);
  
  const load = () => {
    getCaminhoes({ page, pageSize }).then((r) => {
      if (r.data) {
        setItems(r.data);
        setTotalPages(Math.ceil(r.total / pageSize));
      } else {
        setItems(r);
        setTotalPages(1);
      }
    });
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
    }
  };

  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    load();
  }, [page, pageSize]);

  useEffect(() => {
    const interval = setInterval(() => { loadRef.current(); }, 10000);
    
    let channel = null;
    const initRealtime = async () => {
      if (supabase) {
        channel = supabase
          .channel("public:caminhoes")
          .on("postgres_changes", { event: "*", schema: "public", table: "caminhoes" }, () => { loadRef.current(); })
          .subscribe();
      }
    };
    initRealtime();

    return () => { 
      if (channel) {
         if(supabase) supabase.removeChannel(channel);
      }
      clearInterval(interval); 
    };
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    const yearNum = form.year ? Number(form.year) : null;
    const nowYear = new Date().getFullYear();
    if (!isValidPlateBr(form.plate)) { toast?.show("Erro → Aba Caminhão → Campo Placa inválida", "error"); return; }
    if (yearNum && (yearNum < 1950 || yearNum > (nowYear + 2))) { toast?.show("Erro → Aba Caminhão → Campo Ano fora do limite (1950 até ano atual + 2)", "error"); return; }
    const payload = {
      plate: form.plate || null,
      model: form.model || null,
      year: form.year ? Number(form.year) : null,
      chassis: form.chassis || null,
      asset_number: form.asset_number || null,
      capacity: form.capacity ? Number(form.capacity) : null,
      km_current: form.km_current ? Number(form.km_current) : null,
      fleet: form.fleet || null,
      category: form.category || null,
      status: form.status || "Ativo",
      vehicle_value: form.vehicle_value ? Number(form.vehicle_value) : 0,
      residual_value: form.residual_value ? Number(form.residual_value) : 0,
      useful_life_km: form.useful_life_km ? Number(form.useful_life_km) : 1000000,
      avg_consumption: form.avg_consumption ? Number(form.avg_consumption) : 0,
      annual_maintenance: form.annual_maintenance ? Number(form.annual_maintenance) : 0,
      annual_insurance: form.annual_insurance ? Number(form.annual_insurance) : 0,
      annual_taxes: form.annual_taxes ? Number(form.annual_taxes) : 0,
      annual_km: form.annual_km ? Number(form.annual_km) : 0
    };
    if (!payload.plate || !payload.model || !payload.year) { const field = !payload.plate ? "Placa" : (!payload.model ? "Modelo" : "Ano"); toast?.show(`Erro → Aba Caminhão → Campo ${field} obrigatório`, "error"); return; }
    if (editing) await updateCaminhao(editing.id, payload);
    else await saveCaminhao(payload);
    localStorage.removeItem("trucks_form_draft");
    toast?.show(editing ? "Caminhão atualizado" : "Caminhão cadastrado", "success");
    setForm({ plate: "", model: "", year: "", asset_number: "", capacity: "", km_current: "", fleet: "", category: "Canavieiro", status: "Ativo", vehicle_value: "", residual_value: "", useful_life_km: "1000000", avg_consumption: "2.5", annual_maintenance: "", annual_insurance: "", annual_taxes: "", annual_km: "120000" });
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
    setForm({ 
      plate: it.plate || "", model: it.model || "", year: it.year?.toString() || "", chassis: it.chassis || "", 
      km_current: it.km_current?.toString() || "", fleet: it.fleet || "", category: it.category || "Canavieiro", status: it.status,
      vehicle_value: it.vehicle_value || "", residual_value: it.residual_value || "", useful_life_km: it.useful_life_km || "1000000",
      avg_consumption: it.avg_consumption || "2.5", annual_maintenance: it.annual_maintenance || "", 
      annual_insurance: it.annual_insurance || "", annual_taxes: it.annual_taxes || "", annual_km: it.annual_km || "120000"
    }); 
    setShowForm(true);
    toast?.show("Edição carregada", "info"); 
    setTimeout(() => {
      if (formRef.current) formRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      else window.scrollTo({ top: 0, behavior: "smooth" });
    }, 100);
  };
  const del = async (id) => { await deleteCaminhao(id); toast?.show("Caminhão excluído", "success"); load(); };
  const delConfirm = async (id) => { if (!window.confirm("Confirma excluir este caminhão?")) return; await del(id); };

  const handleUploadFleet = async (truck, e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const item = await uploadTruckDocument(truck.id, file, "documento", null);
      setReviewTruck(truck);
      setReviewServerDoc(item);
      try {
        const extracted = await extractDocumentAI(item.url ? { id: item.id } : { file, id: item.id });
        setReviewExtracted(extracted);
        setReviewOpen(true);
      } catch {}
      await getDocumentosByCaminhao(truck.id);
      toast?.show("Upload concluído", "success");
    } catch {
      toast?.show("Falha no upload", "error");
    } finally {
      e.target.value = "";
    }
  };
  useEffect(() => {
    if (!editing) {
      localStorage.setItem("trucks_form_draft", JSON.stringify(form));
    }
  }, [form, editing]);

  return (
    <div className="p-4 max-w-6xl mx-auto pb-24">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Gerenciar Caminhões</h1>
        {!showForm && !editing && (
          <button className="btn btn-primary flex items-center gap-2" onClick={() => setShowForm(true)}>
            <span className="material-icons text-sm">add</span> Novo
          </button>
        )}
      </div>

      {(showForm || editing) && (
        <div ref={formRef} className="card p-6 animate-fade">
          <div className="font-semibold mb-4 text-secondary text-xl">Cadastro de Caminhão</div>
          <form onSubmit={submit} onKeyDown={handleFormKeyDown} className="grid grid-cols-1 md:grid-cols-6 gap-4">
            <input className={`input ${form.plate && !isValidPlateBr(form.plate) && 'ring-red-500 border-red-500'}`} placeholder="Placa" value={form.plate} onChange={(e) => setForm({ ...form, plate: maskPlate(e.target.value) })} />
            <input className="input" placeholder="Modelo" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
            <input className="input" placeholder="Ano" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value.replace(/[^0-9]/g, '').slice(0,4) })} />
            <input className={`input ${form.chassis && form.chassis.length > 17 && 'ring-red-500 border-red-500'}`} placeholder="Chassi" value={form.chassis} onChange={(e) => setForm({ ...form, chassis: maskChassis(e.target.value) })} />
            <input className="input" placeholder="KM atual" value={form.km_current} onChange={(e) => setForm({ ...form, km_current: e.target.value })} />
            <input className="input" placeholder="Frota" value={form.fleet} maxLength={7} onChange={(e) => setForm({ ...form, fleet: e.target.value.replace(/\D/g, "").slice(0,7) })} />
            <select
              className="select"
              value={form.category}
              onChange={(e) => {
                const val = e.target.value;
                if (val === "Outros") {
                  previousCategoryRef.current = form.category || "Canavieiro";
                  setForm({ ...form, category: "Outros" });
                  setCategoryOtherValue("");
                  setShowCategoryDialog(true);
                } else {
                  setForm({ ...form, category: val });
                }
              }}
            >
              <option>Canavieiro</option>
              <option>Pipa</option>
              <option>Vinhaça</option>
              <option>Caçamba</option>
              <option>Outros</option>
            </select>
            <select className="select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option>Ativo</option>
              <option>Manutenção</option>
            </select>

            <div className="col-span-1 md:col-span-6 border-t pt-4 mt-2 mb-2">
              <div className="font-semibold text-slate-700 dark:text-slate-300 mb-2">Custos Fixos e Operacionais</div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="label text-xs">Valor do Veículo (R$)</label>
                  <input className="input" placeholder="0.00" value={form.vehicle_value} onChange={(e) => setForm({ ...form, vehicle_value: e.target.value })} />
                </div>
                <div>
                  <label className="label text-xs">Valor Residual (R$)</label>
                  <input className="input" placeholder="0.00" value={form.residual_value} onChange={(e) => setForm({ ...form, residual_value: e.target.value })} />
                </div>
                <div>
                  <label className="label text-xs">Vida Útil (km)</label>
                  <input className="input" placeholder="Ex: 1000000" value={form.useful_life_km} onChange={(e) => setForm({ ...form, useful_life_km: e.target.value })} />
                </div>
                <div>
                  <label className="label text-xs">Consumo Médio (km/l)</label>
                  <input className="input" placeholder="Ex: 2.5" value={form.avg_consumption} onChange={(e) => setForm({ ...form, avg_consumption: e.target.value })} />
                </div>
                <div>
                  <label className="label text-xs">Manutenção Anual (R$)</label>
                  <input className="input" placeholder="Orçamento anual" value={form.annual_maintenance} onChange={(e) => setForm({ ...form, annual_maintenance: e.target.value })} />
                </div>
                <div>
                  <label className="label text-xs">Seguro Anual (R$)</label>
                  <input className="input" placeholder="Prêmio anual" value={form.annual_insurance} onChange={(e) => setForm({ ...form, annual_insurance: e.target.value })} />
                </div>
                <div>
                  <label className="label text-xs">Licenças/Impostos (R$)</label>
                  <input className="input" placeholder="IPVA, Licenciamento" value={form.annual_taxes} onChange={(e) => setForm({ ...form, annual_taxes: e.target.value })} />
                </div>
                <div>
                  <label className="label text-xs">KM Anual Estimado</label>
                  <input className="input" placeholder="Para rateio" value={form.annual_km} onChange={(e) => setForm({ ...form, annual_km: e.target.value })} />
                </div>
              </div>
            </div>

            <div className="flex gap-2 md:col-span-6">
              <button className="btn btn-primary flex-1">{editing ? "Salvar" : "Adicionar"}</button>
              <button type="button" className="btn bg-gray-500 hover:bg-gray-600 text-white" onClick={() => { setShowForm(false); setEditing(null); localStorage.removeItem("trucks_form_draft"); setForm({ plate: "", model: "", year: "", asset_number: "", capacity: "", km_current: "", fleet: "", category: "Cavalo Mecânico", status: "Ativo", vehicle_value: "", residual_value: "", useful_life_km: "1000000", avg_consumption: "2.5", annual_maintenance: "", annual_insurance: "", annual_taxes: "", annual_km: "120000" }); }}>Cancelar</button>
            </div>
          </form>
        </div>
      )}

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
              <th>Categoria</th>
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
                <td title={it.chassis}>{it.chassis || ""}</td>
                <td>{it.km_current ?? ""}</td>
                <td>{it.fleet || ""}</td>
                <td>{it.category || "-"}</td>
                <td>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${it.status === 'Ativo' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'}`}>
                    {it.status}
                  </span>
                </td>
                <td className="p-4 text-right">
                  <div className="flex justify-end gap-2">
                    <label className="p-2 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20 rounded-lg transition-colors cursor-pointer" title="Importar Documento">
                      <span className="material-icons text-lg">upload_file</span>
                      <input type="file" className="hidden" onChange={(e) => handleUploadFleet(it, e)} />
                    </label>
                    <button onClick={() => edit(it)} className="p-2 text-yellow-600 hover:bg-yellow-50 dark:text-yellow-400 dark:hover:bg-yellow-900/20 rounded-lg transition-colors" title="Editar">
                      <span className="material-icons text-lg">edit</span>
                    </button>
                    <button onClick={() => delConfirm(it.id)} className="p-2 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 rounded-lg transition-colors" title="Excluir">
                      <span className="material-icons text-lg">delete</span>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden md:hidden">
        <div className="divide-y divide-slate-100 dark:divide-slate-700">
          {items.slice(0, pageSize).map((it) => (
            <div key={it.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-semibold text-slate-800 dark:text-slate-200">{it.model || "Caminhão"}</div>
                  <div className="text-sm text-slate-500 dark:text-slate-400">{it.plate || "Sem placa"}</div>
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${it.status === 'Ativo' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'}`}>
                  {it.status}
                </span>
                <span className="text-sm text-slate-500 dark:text-slate-400">
                  {it.year}
                </span>
              </div>
              <div className="text-sm text-slate-500 dark:text-slate-400 mt-2 space-y-1">
                <div className="flex justify-between"><span>Categoria:</span> <span className="font-medium">{it.category || "-"}</span></div>
                <div className="flex justify-between"><span>Frota:</span> <span className="font-medium">{it.fleet || "-"}</span></div>
                <div className="flex justify-between"><span>KM:</span> <span className="font-medium">{it.km_current ?? "-"}</span></div>
              </div>
              <div className="flex justify-end gap-2 mt-3">
                <button className="p-2 text-yellow-600 hover:bg-yellow-50 dark:text-yellow-400 dark:hover:bg-yellow-900/20 rounded-lg transition-colors" onClick={() => edit(it)}><span className="material-icons text-lg">edit</span></button>
                <button className="p-2 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 rounded-lg transition-colors" onClick={() => delConfirm(it.id)}><span className="material-icons text-lg">delete</span></button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between mt-4 p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-100 dark:border-slate-700">
        <div className="text-sm text-slate-500 dark:text-slate-400">
          Página {page} de {totalPages || 1}
        </div>
        <div className="flex items-center gap-2">
          <button 
            className="btn btn-sm border border-slate-300 dark:border-slate-600" 
            onClick={() => handlePageChange(page - 1)}
            disabled={page <= 1}
          >
            Anterior
          </button>
          <button 
            className="btn btn-sm border border-slate-300 dark:border-slate-600" 
            onClick={() => handlePageChange(page + 1)}
            disabled={page >= totalPages}
          >
            Próxima
          </button>
          <select
            className="select select-sm !py-1 dark:bg-slate-700 dark:border-slate-600"
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
      {reviewOpen && (
        <ReviewDialog
          open={reviewOpen}
          onClose={() => setReviewOpen(false)}
          extracted={reviewExtracted}
          truck={reviewTruck}
          serverDoc={reviewServerDoc}
          onApplied={() => { setReviewOpen(false); }}
        />
      )}
      {showCategoryDialog && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-40" onClick={() => {}}>
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="font-semibold text-lg mb-2">Informe a Categoria</div>
            <div className="text-sm text-slate-600 dark:text-slate-300 mb-4">
              Digite a categoria desejada para este caminhão.
            </div>
            <input
              className="input w-full"
              placeholder="Ex.: Prancha Especial"
              value={categoryOtherValue}
              onChange={(e) => setCategoryOtherValue(e.target.value)}
            />
            <div className="mt-4 flex gap-2">
              <button
                className="btn btn-primary flex-1"
                onClick={() => {
                  const v = String(categoryOtherValue || "").trim();
                  if (!v) { toast?.show("Informe a categoria para continuar", "error"); return; }
                  setForm((prev) => ({ ...prev, category: v }));
                  setShowCategoryDialog(false);
                }}
              >
                Confirmar
              </button>
              <button
                className="btn bg-gray-500 hover:bg-gray-600 text-white"
                onClick={() => {
                  const back = previousCategoryRef.current || "Canavieiro";
                  setForm((prev) => ({ ...prev, category: back }));
                  setShowCategoryDialog(false);
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useEffect, useState } from "react";
import { getCaminhoes, getDocumentosByCaminhao, uploadTruckDocument, updateTruckDocumentExpiry, deleteTruckDocument, computeExpiryStatus } from "../services/storageService.js";
import { extractDocumentAI } from "../services/integrationService.js";
import ReviewDialog from "../components/ReviewDialog.jsx";

export default function Documents() {
  const [trucks, setTrucks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [docs, setDocs] = useState([]);
  const [uploadingId, setUploadingId] = useState(null);
  const [uploadExpiry, setUploadExpiry] = useState({ documento: {}, tacografo_certificado: {} });
  const [docStatus, setDocStatus] = useState({});
  const [toast, setToast] = useState(null);
  const [docEditExpiry, setDocEditExpiry] = useState({});
  const [searchTerm, setSearchTerm] = useState("");
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewExtracted, setReviewExtracted] = useState(null);
  const [reviewServerDoc, setReviewServerDoc] = useState(null);
  const [reviewTruck, setReviewTruck] = useState(null);

  const formatDateBR = (iso) => {
    if (!iso) return "";
    const [y, m, d] = String(iso).split("-");
    return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
  };
  const statusMeta = (status, days) => {
    // Função mantida para compatibilidade, mas a lógica de exibição foi movida para o render inline
    const s = status || "unknown";
    const cls = s === "expired" ? "bg-red-100 text-red-700" : s === "expiring" ? "bg-amber-100 text-amber-700" : s === "valid" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600";
    const label = s === "expired" ? "Vencido" : s === "expiring" ? "Válido" : s === "valid" ? "Válido" : "Sem validade";
    return { cls, label };
  };

  const calculateTruckStatus = (list) => {
    const hasDocumento = list.some(d => d.type === "documento");
    const hasTacografo = list.some(d => d.type === "tacografo_certificado");
    
    const relevantDocs = list.filter(d => d.type === "documento" || d.type === "tacografo_certificado");
    let overall = "pending";
    if (relevantDocs.length > 0) {
      let hasExpired = false;
      let hasExpiring = false;
      let hasValid = false;

      for (const d of relevantDocs) {
         const st = d.expiry_status || computeExpiryStatus(d.expiry_date).status;
         if (st === "expired") hasExpired = true;
         if (st === "expiring") hasExpiring = true;
         if (st === "valid") hasValid = true;
      }

      if (hasExpired) overall = "expired";
      else if (hasExpiring) overall = "expiring";
      else if (hasValid) overall = "valid";
    }

    return { 
      documento: hasDocumento, 
      tacografo_certificado: hasTacografo,
      summary: overall
    };
  };

  const loadTrucks = async () => {
    const res = await getCaminhoes({ page: 1, pageSize: 100 });
    const rows = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
    setTrucks(rows);
    try {
      const statuses = {};
      await Promise.all(rows.map(async (t) => {
        const list = await getDocumentosByCaminhao(t.id);
        statuses[t.id] = calculateTruckStatus(list);
      }));
      setDocStatus(statuses);
    } catch {}
  };

  const openDetails = async (truck) => {
    setSelected(truck);
    setLoading(true);
    const list = await getDocumentosByCaminhao(truck.id);
    setDocs(list);
    setLoading(false);
  };

  useEffect(() => {
    loadTrucks();
  }, []);

  const handleUpload = async (truckId, e, type) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingId(truckId);
    try {
      const exp = uploadExpiry?.[type]?.[truckId] || null;
      const item = await uploadTruckDocument(truckId, file, type, exp);
      setReviewTruck(trucks.find(t => t.id === truckId) || null);
      setReviewServerDoc(item);
      try {
        const extracted = await extractDocumentAI(item.url ? { id: item.id } : { file, id: item.id });
        setReviewExtracted(extracted);
        setReviewOpen(true);
      } catch {}
      if (selected && selected.id === truckId) {
        const list = await getDocumentosByCaminhao(truckId);
        setDocs(list);
      }
      try {
        const list2 = await getDocumentosByCaminhao(truckId);
        setDocStatus(prev => ({ ...prev, [truckId]: calculateTruckStatus(list2) }));
        setToast({ type: "success", message: `Upload concluído: ${file.name}` });
        setTimeout(() => setToast(null), 2500);
      } catch {}
    } finally {
      setUploadingId(null);
      e.target.value = "";
    }
  };

  const downloadLocalBase64 = (doc) => {
    if (!doc?.base64) return;
    const a = document.createElement("a");
    a.href = doc.base64;
    a.download = doc.filename || doc.name || "documento";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="p-4 max-w-6xl mx-auto pb-24">
      {toast && (
        <div className={`fixed top-4 right-4 px-4 py-2 rounded-lg shadow-lg ${toast.type === "success" ? "bg-emerald-600 text-white" : "bg-slate-700 text-white"}`}>
          {toast.message}
        </div>
      )}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Documentos & Tacógrafos</h1>
        <div className="form-control w-full max-w-xs">
          <input
            type="text"
            placeholder="Filtrar por placa ou frota..."
            className="input input-bordered w-full"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="card p-4 overflow-x-auto">
        <table className="table min-w-[1000px]">
          <thead>
            <tr>
              <th>ID</th>
              <th>Placa</th>
              <th>Modelo</th>
              <th>Ano</th>
              <th>Frota</th>
              <th>Situação</th>
              <th>Documento</th>
              <th>Certificado Tacógrafo</th>
              <th>Detalhes</th>
            </tr>
          </thead>
          <tbody>
            {trucks
              .filter(t => {
                if (!searchTerm) return true;
                const s = searchTerm.toLowerCase();
                return (t.plate || "").toLowerCase().includes(s) || (t.fleet || "").toLowerCase().includes(s);
              })
              .map((t) => (
              <tr key={t.id}>
                <td>{t.id}</td>
                <td>{t.plate || "-"}</td>
                <td>{t.model || "-"}</td>
                <td>{t.year ?? "-"}</td>
                <td>{t.fleet || "-"}</td>
                <td>
                  {(() => {
                    const st = docStatus[t.id]?.summary || "pending";
                    if (st === "expired") return <span className="badge badge-error gap-1">Vencido</span>;
                    if (st === "expiring") return <span className="badge badge-warning gap-1">Atenção</span>;
                    if (st === "valid") return <span className="badge badge-success gap-1">Regular</span>;
                    return <span className="badge badge-ghost gap-1">Pendente</span>;
                  })()}
                </td>
                <td>
                  <div className="flex items-center gap-2">
                    <label className="btn btn-sm cursor-pointer">
                      {uploadingId === t.id ? "Enviando..." : "Upload"}
                      <input type="file" className="hidden" onChange={(e) => handleUpload(t.id, e, "documento")} />
                    </label>
                    <span className={`text-xs px-2 py-1 rounded-full ${docStatus[t.id]?.documento ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                      {docStatus[t.id]?.documento ? "Enviado" : "Pendente"}
                    </span>
                    {docStatus[t.id]?.documento && (
                      <span className="text-xs px-2 py-1 rounded-lg bg-emerald-200 text-emerald-800 flex items-center gap-1">
                        <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-violet-600 text-white text-[10px]">✔</span>
                        Documento
                      </span>
                    )}
                  </div>
                </td>
                <td>
                  <div className="flex items-center gap-2">
                    <label className="btn btn-sm cursor-pointer">
                      {uploadingId === t.id ? "Enviando..." : "Upload"}
                      <input type="file" className="hidden" onChange={(e) => handleUpload(t.id, e, "tacografo_certificado")} />
                    </label>
                    <span className={`text-xs px-2 py-1 rounded-full ${docStatus[t.id]?.tacografo_certificado ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                      {docStatus[t.id]?.tacografo_certificado ? "Enviado" : "Pendente"}
                    </span>
                    {docStatus[t.id]?.tacografo_certificado && (
                      <span className="text-xs px-2 py-1 rounded-lg bg-emerald-200 text-emerald-800 flex items-center gap-1">
                        <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-violet-600 text-white text-[10px]">✔</span>
                        Certificado
                      </span>
                    )}
                  </div>
                </td>
                <td>
                  <button className="btn btn-sm btn-primary" onClick={() => openDetails(t)}>Ver Detalhes</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-30" onClick={() => setSelected(null)}>
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-2xl p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <div className="font-semibold text-xl">Detalhes da Frota #{selected.id}</div>
              <button className="btn" onClick={() => setSelected(null)}>Fechar</button>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div><span className="text-sm text-slate-500">Placa</span><div className="font-medium">{selected.plate || "-"}</div></div>
              <div><span className="text-sm text-slate-500">Modelo</span><div className="font-medium">{selected.model || "-"}</div></div>
              <div><span className="text-sm text-slate-500">Ano</span><div className="font-medium">{selected.year ?? "-"}</div></div>
              <div><span className="text-sm text-slate-500">Chassi</span><div className="font-medium">{selected.chassis || "-"}</div></div>
              <div><span className="text-sm text-slate-500">KM Atual</span><div className="font-medium">{selected.km_current ?? "-"}</div></div>
              <div><span className="text-sm text-slate-500">Frota</span><div className="font-medium">{selected.fleet || "-"}</div></div>
              <div><span className="text-sm text-slate-500">Status</span><div className="font-medium">{selected.status || "-"}</div></div>
            </div>
            <div className="border-t pt-4">
              <div className="font-semibold mb-2">Documentos</div>
              {(!loading && docs.length > 0) && (() => {
                const expired = docs.filter(d => (d.expiry_status || (d.expiry_date ? "valid" : "unknown")) === "expired").length;
                const expiring = docs.filter(d => (d.expiry_status || (d.expiry_date ? "valid" : "unknown")) === "expiring").length;
                return (
                  <div className="mb-2 flex gap-2">
                    <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-700">Vencidos: {expired}</span>
                    <span className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-700">Expiram ≤30d: {expiring}</span>
                  </div>
                );
              })()}
              {loading ? (
                <div>Carregando...</div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-auto">
                  {docs.length === 0 ? (
                    <div className="text-sm text-slate-500">Nenhum documento enviado.</div>
                  ) : (
                    docs.map((d) => (
                      <div key={d.id} className="p-3 rounded-lg border dark:border-slate-700">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium">{d.name || d.filename}</div>
                            <div className="text-xs text-slate-500">Tipo: {d.type}</div>
                          </div>
                          {d.url ? (
                            <a className="btn btn-sm" href={d.url} download={d.filename || d.name || "documento"}>⬇️ Download</a>
                          ) : (
                            <button className="btn btn-sm" onClick={() => downloadLocalBase64(d)}>⬇️ Download</button>
                          )}
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-3">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-500">Validade</span>
                            <span className="text-xs px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-700 dark:text-slate-200">
                              {d.expiry_date ? formatDateBR(d.expiry_date) : "—"}
                            </span>
                          </div>
                          {(() => {
                            // Simplificação solicitada: "somente válido ou vencido"
                            // Mantendo a lógica de cores para diferenciar (Vencido=Vermelho, Válido=Verde/Amarelo)
                            const st = d.expiry_status || "unknown";
                            let text = "Sem validade";
                            let cls = "bg-slate-100 text-slate-600";
                            
                            if (st === "expired") {
                              text = "Vencido";
                              cls = "bg-red-100 text-red-700";
                            } else if (st === "valid" || st === "expiring") {
                              text = "Válido";
                              cls = st === "expiring" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700";
                            }

                            return <span className={`text-xs px-2 py-1 rounded-full ${cls}`}>{text}</span>;
                          })()}
                          <input
                            type="date"
                            className="input input-sm"
                            value={docEditExpiry[d.id] ?? (d.expiry_date || "")}
                            onChange={(ev) => setDocEditExpiry(prev => ({ ...prev, [d.id]: ev.target.value || "" }))}
                            title="Editar validade"
                          />
                          <button
                            className="btn btn-sm btn-secondary"
                            onClick={async () => {
                              const val = docEditExpiry[d.id] || "";
                              await updateTruckDocumentExpiry(d.id, val || null);
                              const list = await getDocumentosByCaminhao(selected.id);
                              setDocs(list);
                              setDocStatus(prev => ({ ...prev, [selected.id]: calculateTruckStatus(list) }));
                              setToast({ type: "success", message: "Validade atualizada" });
                              setTimeout(() => setToast(null), 2000);
                            }}
                          >Salvar</button>
                          <button
                            className="btn btn-sm btn-error ml-auto"
                            onClick={async () => {
                              await deleteTruckDocument(d.id);
                              const list = await getDocumentosByCaminhao(selected.id);
                              setDocs(list);
                              setToast({ type: "success", message: "Documento excluído" });
                              setTimeout(() => setToast(null), 2000);
                              try {
                                const list2 = await getDocumentosByCaminhao(selected.id);
                                setDocStatus(prev => ({ ...prev, [selected.id]: calculateTruckStatus(list2) }));
                              } catch {}
                            }}
                            title="Excluir"
                          >Excluir</button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {reviewOpen && (
        <ReviewDialog
          open={reviewOpen}
          onClose={() => setReviewOpen(false)}
          extracted={reviewExtracted}
          truck={reviewTruck}
          serverDoc={reviewServerDoc}
          onApplied={async () => {
            try {
              if (reviewTruck?.id) {
                const list = await getDocumentosByCaminhao(reviewTruck.id);
                setDocs(prev => (selected && selected.id === reviewTruck.id) ? list : prev);
                setDocStatus(prev => ({ ...prev, [reviewTruck.id]: calculateTruckStatus(list) }));
              }
            } catch {}
          }}
        />
      )}
    </div>
  );
}

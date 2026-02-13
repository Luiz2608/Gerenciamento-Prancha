import { useEffect, useState } from "react";
import { getCaminhoes, getDocumentosByCaminhao, uploadTruckDocument, updateTruckDocumentExpiry, deleteTruckDocument } from "../services/storageService.js";

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

  const loadTrucks = async () => {
    const res = await getCaminhoes({ page: 1, pageSize: 100 });
    const rows = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
    setTrucks(rows);
    try {
      const statuses = {};
      await Promise.all(rows.map(async (t) => {
        const list = await getDocumentosByCaminhao(t.id);
        const hasDocumento = list.some(d => d.type === "documento");
        const hasTacografo = list.some(d => d.type === "tacografo_certificado");
        statuses[t.id] = { documento: hasDocumento, tacografo_certificado: hasTacografo };
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
      if (selected && selected.id === truckId) {
        const list = await getDocumentosByCaminhao(truckId);
        setDocs(list);
      }
      try {
        const list2 = await getDocumentosByCaminhao(truckId);
        const hasDocumento = list2.some(d => d.type === "documento");
        const hasTacografo = list2.some(d => d.type === "tacografo_certificado");
        setDocStatus(prev => ({ ...prev, [truckId]: { documento: hasDocumento, tacografo_certificado: hasTacografo } }));
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
              <th>Documento</th>
              <th>Certificado Tacógrafo</th>
              <th>Detalhes</th>
            </tr>
          </thead>
          <tbody>
            {trucks.map((t) => (
              <tr key={t.id}>
                <td>{t.id}</td>
                <td>{t.plate || "-"}</td>
                <td>{t.model || "-"}</td>
                <td>{t.year ?? "-"}</td>
                <td>{t.fleet || "-"}</td>
                <td>
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      className="input input-sm"
                      value={uploadExpiry.documento?.[t.id] || ""}
                      onChange={(ev) => setUploadExpiry((prev) => ({ ...prev, documento: { ...prev.documento, [t.id]: ev.target.value || "" } }))}
                      title="Validade (manual)"
                    />
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
                    <input
                      type="date"
                      className="input input-sm"
                      value={uploadExpiry.tacografo_certificado?.[t.id] || ""}
                      onChange={(ev) => setUploadExpiry((prev) => ({ ...prev, tacografo_certificado: { ...prev.tacografo_certificado, [t.id]: ev.target.value || "" } }))}
                      title="Validade (manual)"
                    />
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
                      <div key={d.id} className="p-2 rounded-lg border dark:border-slate-700">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium">{d.name || d.filename}</div>
                            <div className="text-xs text-slate-500">Tipo: {d.type}</div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-slate-500">Validade: {d.expiry_date ? d.expiry_date : "—"}</span>
                              {(() => {
                                const status = d.expiry_status || (d.expiry_date ? "valid" : "unknown");
                                const days = d.days_to_expiry;
                                const cls = status === "expired" ? "bg-red-100 text-red-700" : status === "expiring" ? "bg-amber-100 text-amber-700" : status === "valid" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600";
                                const label = status === "expired" ? "Vencido" : status === "expiring" ? `Vence em ${days} dias` : status === "valid" ? `Válido (${days ?? ""}d)` : "Sem validade";
                                return <span className={`text-[11px] px-2 py-0.5 rounded-full ${cls}`}>{label}</span>;
                              })()}
                            </div>
                          </div>
                          {d.url ? (
                            <a className="btn btn-sm" href={d.url} download={d.filename || d.name || "documento"}>⬇️ Download</a>
                          ) : (
                            <button className="btn btn-sm" onClick={() => downloadLocalBase64(d)}>⬇️ Download</button>
                          )}
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          <span className="text-xs text-slate-500">Validade automática</span>
                          <span className="text-xs px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-700 dark:text-slate-200">
                            {d.expiry_date ? d.expiry_date : "Indisponível"}
                          </span>
                          {(() => {
                            const status = d.expiry_status || (d.expiry_date ? "valid" : "unknown");
                            const days = d.days_to_expiry;
                            const cls = status === "expired" ? "bg-red-100 text-red-700" : status === "expiring" ? "bg-amber-100 text-amber-700" : status === "valid" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600";
                            const label = status === "expired" ? "Vencido" : status === "expiring" ? `Vence em ${days} dias` : status === "valid" ? `Válido (${days ?? ""}d)` : "Sem validade";
                            return <span className={`text-[11px] px-2 py-0.5 rounded-full ${cls}`}>{label}</span>;
                          })()}
                          <input
                            type="date"
                            className="input input-sm"
                            value={docEditExpiry[d.id] ?? (d.expiry_date || "")}
                            onChange={(ev) => setDocEditExpiry(prev => ({ ...prev, [d.id]: ev.target.value || "" }))}
                            title="Editar validade (manual)"
                          />
                          <button
                            className="btn btn-sm btn-secondary"
                            onClick={async () => {
                              const val = docEditExpiry[d.id] || "";
                              const updated = await updateTruckDocumentExpiry(d.id, val || null);
                              const list = await getDocumentosByCaminhao(selected.id);
                              setDocs(list);
                              setToast({ type: "success", message: "Validade atualizada" });
                              setTimeout(() => setToast(null), 2000);
                            }}
                          >Salvar validade</button>
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
                                const hasDocumento = list2.some(x => x.type === "documento");
                                const hasTacografo = list2.some(x => x.type === "tacografo_certificado");
                                setDocStatus(prev => ({ ...prev, [selected.id]: { documento: hasDocumento, tacografo_certificado: hasTacografo } }));
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
    </div>
  );
}

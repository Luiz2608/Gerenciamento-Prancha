import { useEffect, useState } from "react";
import { getCaminhoes, getDocumentosByCaminhao, uploadTruckDocument, updateTruckDocumentExpiry } from "../services/storageService.js";

export default function Documents() {
  const [trucks, setTrucks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [docs, setDocs] = useState([]);
  const [uploadingId, setUploadingId] = useState(null);

  const loadTrucks = async () => {
    const res = await getCaminhoes({ page: 1, pageSize: 100 });
    const rows = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
    setTrucks(rows);
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
      const item = await uploadTruckDocument(truckId, file, type, null);
      if (selected && selected.id === truckId) {
        const list = await getDocumentosByCaminhao(truckId);
        setDocs(list);
      }
    } finally {
      setUploadingId(null);
      e.target.value = "";
    }
  };

  return (
    <div className="p-4 max-w-6xl mx-auto pb-24">
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
                  <label className="btn btn-sm cursor-pointer">
                    {uploadingId === t.id ? "Enviando..." : "Upload"}
                    <input type="file" className="hidden" onChange={(e) => handleUpload(t.id, e, "documento")} />
                  </label>
                </td>
                <td>
                  <label className="btn btn-sm cursor-pointer">
                    {uploadingId === t.id ? "Enviando..." : "Upload"}
                    <input type="file" className="hidden" onChange={(e) => handleUpload(t.id, e, "tacografo_certificado")} />
                  </label>
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
                          </div>
                          {d.url ? (
                            <a className="btn btn-sm" href={d.url} target="_blank" rel="noreferrer">Abrir</a>
                          ) : (
                            <span className="text-xs text-slate-400">Local</span>
                          )}
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          <input
                            type="date"
                            className="input input-sm w-40"
                            defaultValue={d.expiry_date || ""}
                            onBlur={async (e) => {
                              const val = e.target.value || null;
                              const updated = await updateTruckDocumentExpiry(d.id, val);
                              const list = await getDocumentosByCaminhao(selected.id);
                              setDocs(list);
                            }}
                            title="Validade"
                          />
                          <span className="text-xs text-slate-500">Defina a validade aqui</span>
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

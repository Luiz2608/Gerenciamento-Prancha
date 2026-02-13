import { useEffect, useState } from "react";
import { computeExpiryStatus, saveCaminhao, updateCaminhao, updateTruckDocumentExpiry } from "../services/storageService.js";

export default function ReviewDialog({ open, onClose, extracted, truck, serverDoc, onApplied }) {
  const [fields, setFields] = useState({
    plate: extracted?.plate || truck?.plate || "",
    chassis: extracted?.chassis || truck?.chassis || "",
    year: extracted?.year?.toString() || truck?.year?.toString() || "",
    doc_type: extracted?.doc_type || serverDoc?.type || "documento",
    issue_date: extracted?.issue_date || "",
    expiry_date: extracted?.expiry_date || ""
  });
  const [fleet, setFleet] = useState(truck?.fleet || "");
  const [applyTruck, setApplyTruck] = useState(true);
  const [applyDocs, setApplyDocs] = useState(true);
  const [warning, setWarning] = useState(null);

  useEffect(() => {
    const mismatches = [];
    if (truck?.plate && fields.plate && String(truck.plate).toUpperCase() !== String(fields.plate).toUpperCase()) mismatches.push("Placa extraída diferente da placa do caminhão selecionado");
    if (truck?.chassis && fields.chassis && String(truck.chassis).toUpperCase() !== String(fields.chassis).toUpperCase()) mismatches.push("Chassi extraído diferente do caminhão selecionado");
    if (mismatches.length > 0) setWarning(mismatches.join(" • "));
    else setWarning(null);
  }, [fields, truck]);

  if (!open) return null;

  const handleConfirm = async () => {
    try {
      let updatedTruck = null;
      if (applyTruck) {
        const payload = {
          plate: fields.plate || null,
          model: truck?.model || null,
          year: fields.year ? Number(fields.year) : (truck?.year != null ? Number(truck.year) : null),
          chassis: fields.chassis || truck?.chassis || null,
          km_current: truck?.km_current != null ? Number(truck.km_current) : null,
          fleet: fleet || truck?.fleet || null,
          status: truck?.status || "Ativo"
        };
        if (truck?.id) updatedTruck = await updateCaminhao(truck.id, payload);
        else updatedTruck = await saveCaminhao(payload);
      }
      if (applyDocs && serverDoc?.id) {
        const val = fields.expiry_date || null;
        await updateTruckDocumentExpiry(serverDoc.id, val);
      }
      onApplied?.({ truck: updatedTruck, expiry_date: fields.expiry_date || null });
      onClose?.();
    } catch (e) {
      onApplied?.({ error: e?.message || String(e) });
    }
  };

  const expiryMeta = computeExpiryStatus(fields.expiry_date);
  const badge = expiryMeta.status === "expired" ? "bg-red-100 text-red-700" : expiryMeta.status === "expiring" ? "bg-amber-100 text-amber-700" : expiryMeta.status === "valid" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600";
  const badgeText = expiryMeta.status === "expired" ? "Vencido" : expiryMeta.status === "expiring" ? "Válido" : expiryMeta.status === "valid" ? "Válido" : "Sem validade";

  return (
    <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-xl w-full max-w-2xl p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <div className="font-semibold text-xl">Revisão de Documento</div>
          <button className="btn" onClick={onClose}>Fechar</button>
        </div>
        {warning && <div className="mb-3 text-sm px-3 py-2 rounded-lg bg-amber-100 text-amber-800">{warning}</div>}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label text-xs">Placa</label>
            <input className="input" value={fields.plate} onChange={(e) => setFields({ ...fields, plate: e.target.value.toUpperCase() })} />
          </div>
          <div>
            <label className="label text-xs">Chassi</label>
            <input className="input" value={fields.chassis} onChange={(e) => setFields({ ...fields, chassis: e.target.value.toUpperCase() })} />
          </div>
          <div>
            <label className="label text-xs">Ano</label>
            <input className="input" value={fields.year} onChange={(e) => setFields({ ...fields, year: e.target.value.replace(/[^0-9]/g, '').slice(0,4) })} />
          </div>
          <div>
            <label className="label text-xs">Tipo de Documento</label>
            <select className="select" value={fields.doc_type} onChange={(e) => setFields({ ...fields, doc_type: e.target.value })}>
              <option value="documento">Licenciamento/Documento</option>
              <option value="tacografo_certificado">Certificado Tacógrafo</option>
              <option value="seguro">Seguro</option>
              <option value="inspecao">Inspeção</option>
            </select>
          </div>
          <div>
            <label className="label text-xs">Emitido em</label>
            <input className="input" type="date" value={fields.issue_date || ""} onChange={(e) => setFields({ ...fields, issue_date: e.target.value || "" })} />
          </div>
          <div>
            <label className="label text-xs">Validade</label>
            <div className="flex items-center gap-2">
              <input className="input" type="date" value={fields.expiry_date || ""} onChange={(e) => setFields({ ...fields, expiry_date: e.target.value || "" })} />
              <span className={`text-xs px-2 py-1 rounded-full ${badge}`}>{badgeText}</span>
            </div>
          </div>
          <div className="col-span-2">
            <label className="label text-xs">Frota vinculada</label>
            <input className="input" value={fleet} onChange={(e) => setFleet(e.target.value.replace(/\D/g, '').slice(0,7))} placeholder="Informe a frota (opcional)" />
          </div>
        </div>
        <div className="mt-4 flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={applyTruck} onChange={(e) => setApplyTruck(e.target.checked)} /> Salvar no cadastro do caminhão</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={applyDocs} onChange={(e) => setApplyDocs(e.target.checked)} /> Salvar no controle de tacógrafos</label>
        </div>
        <div className="mt-4 flex gap-2">
          <button className="btn btn-primary flex-1" onClick={handleConfirm}>Confirmar</button>
          <button className="btn bg-gray-500 hover:bg-gray-600 text-white" onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}

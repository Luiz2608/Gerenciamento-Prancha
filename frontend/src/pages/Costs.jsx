import { useEffect, useMemo, useState } from "react";
import { useToast } from "../components/ToastProvider.jsx";
import { getMotoristas, getCaminhoes, getPranchas, getViagens, getCustos, saveCusto, updateCusto, deleteCusto, approveCusto } from "../services/storageService.js";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";
import useAuth from "../hooks/useAuth.js";

const colors = ["#2563eb", "#38bdf8", "#22c55e", "#a78bfa", "#f59e0b", "#ef4444", "#14b8a6", "#0ea5e9"];

export default function Costs() {
  const toast = useToast();
  const { user } = useAuth();
  const [tab, setTab] = useState("lista");
  const [drivers, setDrivers] = useState([]);
  const [trucks, setTrucks] = useState([]);
  const [pranchas, setPranchas] = useState([]);
  const [custos, setCustos] = useState([]);
  const [totalRows, setTotalRows] = useState(0);
  const [filters, setFilters] = useState({ startDate: "", endDate: "", caminhaoId: "", pranchaId: "", driverId: "", aprovado: "", search: "", page: 1, pageSize: 10 });
  const [total, setTotal] = useState(0);
  const [avgKm, setAvgKm] = useState(0);
  const [avgHour, setAvgHour] = useState(0);
  const [form, setForm] = useState({ viagemId: "", dataRegistro: "", consumoLitros: "", valorLitro: "", diariaMotorista: "", pedagios: "", manutencao: "", outrosCustos: [], observacoes: "", anexos: [] });
  const [addingOther, setAddingOther] = useState({ descricao: "", valor: "" });
  const [trips, setTrips] = useState([]);
  const [viewing, setViewing] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [calc, setCalc] = useState(null);

  const loadRefs = async () => {
    setDrivers(await getMotoristas());
    setTrucks((await getCaminhoes()).filter((x) => x.status === "Ativo"));
    setPranchas((await getPranchas()).filter((x) => x.status === "Ativo"));
    const r = await getViagens({ page: 1, pageSize: 1000 });
    setTrips(r.data);
  };
  const loadList = async () => {
    const f = { ...filters, aprovado: filters.aprovado === "" ? undefined : filters.aprovado === "true" };
    const r = await getCustos(f);
    setCustos(r.data);
    setTotalRows(r.total);
  };
  useEffect(() => { loadRefs(); }, []);
  useEffect(() => { if (tab === "lista" || tab === "relatorios") loadList(); }, [filters, tab]);

  const handleTripLink = (id) => {
    setForm({ ...form, viagemId: id });
    const t = trips.find((x) => String(x.id) === String(id));
    if (t) setForm((prev) => ({ ...prev, kmRodado: t.km_rodado || 0, tempoHoras: t.horas || 0 }));
  };

  const addOther = () => {
    if (!addingOther.descricao || !addingOther.valor) { toast?.show("Informe descrição e valor", "error"); return; }
    const v = Number(addingOther.valor);
    if (isNaN(v) || v < 0) { toast?.show("Valor inválido", "error"); return; }
    setForm({ ...form, outrosCustos: [...(form.outrosCustos || []), { descricao: addingOther.descricao, valor: v }] });
    setAddingOther({ descricao: "", valor: "" });
  };

  const handleFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    const items = await Promise.all(files.map((f) => new Promise((res) => { const r = new FileReader(); r.onload = () => res({ nome: f.name, base64: String(r.result).split(",")[1] }); r.readAsDataURL(f); })));
    setForm({ ...form, anexos: [ ...(form.anexos || []), ...items ] });
  };

  const validate = (payload) => {
    const errs = [];
    if (!payload.viagemId) errs.push("Vincule uma viagem");
    if (!payload.dataRegistro) errs.push("Informe data de registro");
    const consumoLitros = Number(payload.consumoLitros || 0);
    const valorLitro = Number(payload.valorLitro || 0);
    const diariaMotorista = Number(payload.diariaMotorista || 0);
    const pedagios = Number(payload.pedagios || 0);
    const manutencao = Number(payload.manutencao || 0);
    const outrosSum = (payload.outrosCustos || []).reduce((a, it) => a + Number(it.valor || 0), 0);
    if ([consumoLitros, valorLitro, diariaMotorista, pedagios, manutencao].some((n) => n < 0)) errs.push("Valores não podem ser negativos");
    const custoTotal = consumoLitros * valorLitro + diariaMotorista + pedagios + manutencao + outrosSum;
    if (!(custoTotal >= 0)) errs.push("Cálculo inválido");
    return { ok: errs.length === 0, errs, custoTotal };
  };

  const submit = async (e) => {
    e.preventDefault();
    const payload = {
      viagemId: form.viagemId || null,
      dataRegistro: form.dataRegistro || new Date().toISOString().slice(0,10),
      registradoPor: "",
      caminhaoId: undefined,
      pranchaId: undefined,
      consumoLitros: form.consumoLitros ? Number(form.consumoLitros) : 0,
      valorLitro: form.valorLitro ? Number(form.valorLitro) : 0,
      kmRodado: form.kmRodado ? Number(form.kmRodado) : 0,
      tempoHoras: form.tempoHoras ? Number(form.tempoHoras) : 0,
      diariaMotorista: form.diariaMotorista ? Number(form.diariaMotorista) : 0,
      pedagios: form.pedagios ? Number(form.pedagios) : 0,
      manutencao: form.manutencao ? Number(form.manutencao) : 0,
      outrosCustos: form.outrosCustos || [],
      observacoes: form.observacoes || ""
    };
    const v = validate(payload);
    if (!v.ok) { toast?.show(v.errs[0], "error"); return; }
    try {
      if (editingId) {
        await updateCusto(editingId, payload);
        toast?.show("Custo atualizado", "success");
      } else {
        await saveCusto({ ...payload, anexos: form.anexos || [] });
        toast?.show("Custo salvo", "success");
      }
      setForm({ viagemId: "", dataRegistro: "", consumoLitros: "", valorLitro: "", diariaMotorista: "", pedagios: "", manutencao: "", outrosCustos: [], observacoes: "", anexos: [] });
      setEditingId(null);
      setTab("lista");
      loadList();
    } catch (err) {
      toast?.show("Erro ao salvar", "error");
    }
  };

  const approve = async (id) => {
    try { await approveCusto(id); toast?.show("Custo aprovado", "success"); loadList(); } catch (e) { toast?.show("Acesso negado", "error"); }
  };

  const del = async (id) => { await deleteCusto(id); toast?.show("Custo excluído", "success"); loadList(); };

  const lista = (
    <div className="space-y-6">
      <div className="card p-6 grid grid-cols-1 md:grid-cols-9 gap-4">
        <input className="input" placeholder="Início" value={filters.startDate} onChange={(e) => setFilters({ ...filters, startDate: e.target.value })} />
        <input className="input" placeholder="Fim" value={filters.endDate} onChange={(e) => setFilters({ ...filters, endDate: e.target.value })} />
        <select className="select" value={filters.caminhaoId} onChange={(e) => setFilters({ ...filters, caminhaoId: e.target.value })}>
          <option value="">Caminhão</option>
          {trucks.map((t) => <option key={t.id} value={t.id}>{t.plate || t.model || t.id}</option>)}
        </select>
        <select className="select" value={filters.pranchaId} onChange={(e) => setFilters({ ...filters, pranchaId: e.target.value })}>
          <option value="">Prancha</option>
          {pranchas.map((p) => <option key={p.id} value={p.id}>{p.identifier || p.model || p.id}</option>)}
        </select>
        <select className="select" value={filters.driverId} onChange={(e) => setFilters({ ...filters, driverId: e.target.value })}>
          <option value="">Motorista</option>
          {drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <select className="select" value={filters.aprovado} onChange={(e) => setFilters({ ...filters, aprovado: e.target.value })}>
          <option value="">Aprovado?</option>
          <option value="true">Sim</option>
          <option value="false">Não</option>
        </select>
        <input className="input" placeholder="Pesquisa" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} />
        <input className="input" placeholder="Min custo" value={filters.minCusto || ""} onChange={(e) => setFilters({ ...filters, minCusto: e.target.value })} />
        <input className="input" placeholder="Max custo" value={filters.maxCusto || ""} onChange={(e) => setFilters({ ...filters, maxCusto: e.target.value })} />
      </div>
      <div className="flex items-center gap-3">
        <button className="btn btn-primary" onClick={async () => {
          const r = await getCustos({ ...filters, page: 1, pageSize: 10000 });
          const header = ["id","dataRegistro","viagemId","caminhaoId","pranchaId","kmRodado","tempoHoras","consumoLitros","valorLitro","diariaMotorista","pedagios","manutencao","outros","custoCombustivel","custoTotal","custoPorKm","aprovado"];
          const lines = r.data.map((c) => [c.id,String(c.dataRegistro).slice(0,10),c.viagemId||"",c.caminhaoId||"",c.pranchaId||"",c.kmRodado||0,c.tempoHoras||0,c.consumoLitros||0,c.valorLitro||0,c.diariaMotorista||0,c.pedagios||0,c.manutencao||0,(Array.isArray(c.outrosCustos)?c.outrosCustos.reduce((s,o)=>s+Number(o.valor||0),0):0),c.custoCombustivel||0,c.custoTotal||0,c.custoPorKm||0,c.aprovado?"sim":"não"]);
          const csv = [header.join(","), ...lines.map((l) => l.join(","))].join("\n");
          const blob = new Blob([csv], { type: "text/csv" });
          const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "custos.csv"; a.click(); URL.revokeObjectURL(url); toast?.show("CSV exportado", "success");
        }}><span className="material-icons">download</span> CSV</button>
        <button className="btn btn-secondary" onClick={async () => {
          const r = await getCustos({ ...filters, page: 1, pageSize: 10000 });
          const { jsPDF } = await import("jspdf");
          const doc = new jsPDF();
          doc.setFontSize(16);
          doc.text("Relatório de Custos", 105, 15, { align: "center" });
          doc.setFontSize(10);
          let y = 25;
          r.data.forEach((c) => { const line = `Data: ${String(c.dataRegistro).slice(0,10)} | Viagem: ${c.viagemId || ""} | Total: R$ ${(Number(c.custoTotal||0)).toFixed(2)} | Aprovado: ${c.aprovado?"Sim":"Não"}`; doc.text(line, 10, y); y += 6; if (y > 280) { doc.addPage(); y = 15; } });
          const blob = doc.output("blob");
          const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "custos.pdf"; a.click(); URL.revokeObjectURL(url); toast?.show("PDF exportado", "success");
        }}><span className="material-icons">picture_as_pdf</span> PDF</button>
      </div>
      <div className="card p-6 animate-fade overflow-x-auto">
        <table className="table min-w-[1100px]">
          <thead>
            <tr>
              <th>Data</th>
              <th>Viagem</th>
              <th>Caminhão</th>
              <th>Prancha</th>
              <th>Custo total</th>
              <th>Aprovado</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {custos.map((c, idx) => (
              <tr key={c.id} className={`${idx % 2 === 0 ? 'bg-slate-50 dark:bg-slate-800' : 'bg-white dark:bg-slate-700'} hover:bg-slate-100 dark:hover:bg-slate-600`}>
                <td>{String(c.dataRegistro).slice(0,10)}</td>
                <td>{c.viagemId}</td>
                <td>{trucks.find((t) => String(t.id) === String(c.caminhaoId))?.plate || c.caminhaoId || ""}</td>
                <td>{pranchas.find((p) => String(p.id) === String(c.pranchaId))?.identifier || c.pranchaId || ""}</td>
                <td>R$ {Number(c.custoTotal || 0).toFixed(2)}</td>
                <td>{c.aprovado ? <span className="px-2 py-1 rounded bg-green-600 text-white">Aprovado</span> : <span className="px-2 py-1 rounded bg-yellow-600 text-white">Pendente</span>}</td>
                <td className="space-x-2">
                  <button className="btn bg-slate-600 hover:bg-slate-700 text-white" onClick={() => setViewing(c)}>Ver</button>
                  <button className="btn bg-yellow-500 hover:bg-yellow-600 text-white" onClick={() => { setEditingId(c.id); setForm({ viagemId: c.viagemId || "", dataRegistro: String(c.dataRegistro).slice(0,10), consumoLitros: c.consumoLitros ?? 0, valorLitro: c.valorLitro ?? 0, kmRodado: c.kmRodado ?? 0, tempoHoras: c.tempoHoras ?? 0, diariaMotorista: c.diariaMotorista ?? 0, pedagios: c.pedagios ?? 0, manutencao: c.manutencao ?? 0, outrosCustos: c.outrosCustos || [], observacoes: c.observacoes || "" }); setTab("novo"); }}>Editar</button>
                  {user?.role === "admin" && <button className="btn bg-green-600 hover:bg-green-700 text-white" onClick={() => approve(c.id)}>Aprovar</button>}
                  {user?.role === "admin" && <button className="btn bg-red-600 hover:bg-red-700 text-white" onClick={async () => { await updateCusto(c.id, { aprovado: false, aprovadoPor: null, aprovadoEm: null }); toast?.show("Custo recusado", "success"); loadList(); }}>Recusar</button>}
                  <button className="btn bg-red-600 hover:bg-red-700 text-white" onClick={() => del(c.id)}>Excluir</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between">
        <div>Registros: {totalRows}</div>
        <div className="flex items-center gap-2">
          <button className="btn" disabled={filters.page <= 1} onClick={() => setFilters({ ...filters, page: Math.max(1, Number(filters.page) - 1) })}>Anterior</button>
          <div>Página {filters.page}</div>
          <button className="btn" disabled={(filters.page * filters.pageSize) >= totalRows} onClick={() => setFilters({ ...filters, page: Number(filters.page) + 1 })}>Próxima</button>
          <select className="select" value={filters.pageSize} onChange={(e) => setFilters({ ...filters, pageSize: Number(e.target.value), page: 1 })}>
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
        </div>
      </div>
    </div>
  );

  const relatoriosData = useMemo(() => {
    const rows = custos;
    const totalPeriodo = rows.reduce((a, c) => a + Number(c.custoTotal || 0), 0);
    const kmTotal = rows.reduce((a, c) => a + Number(c.kmRodado || 0), 0);
    const horasTotal = rows.reduce((a, c) => a + Number(c.tempoHoras || 0), 0);
    const mediaKm = kmTotal ? totalPeriodo / kmTotal : 0;
    const mediaHora = horasTotal ? totalPeriodo / horasTotal : 0;
    const meses = rows.reduce((acc, c) => { const m = String(c.dataRegistro).slice(0,7); const f = acc.find((x) => x.month === m) || { month: m, total: 0, km: 0 }; f.total += Number(c.custoTotal || 0); f.km += Number(c.kmRodado || 0); if (!acc.find((x) => x.month === m)) acc.push(f); return acc; }, []);
    const dist = [
      { name: "Combustível", value: rows.reduce((a, c) => a + Number(c.custoCombustivel || 0), 0) },
      { name: "Manutenção", value: rows.reduce((a, c) => a + Number(c.manutencao || 0), 0) },
      { name: "Diárias", value: rows.reduce((a, c) => a + Number(c.diariaMotorista || 0), 0) },
      { name: "Pedágios", value: rows.reduce((a, c) => a + Number(c.pedagios || 0), 0) },
      { name: "Outros", value: rows.reduce((a, c) => a + (Array.isArray(c.outrosCustos) ? c.outrosCustos.reduce((s, o) => s + Number(o.valor || 0), 0) : 0), 0) }
    ];
    const porCaminhao = trucks.map((t) => ({ truck: t.plate || t.model || String(t.id), total: rows.filter((c) => String(c.caminhaoId || "") === String(t.id)).reduce((a, c) => a + Number(c.custoTotal || 0), 0) })).sort((a,b)=> b.total - a.total).slice(0,10);
    return { totalPeriodo, mediaKm, mediaHora, meses, dist, porCaminhao };
  }, [custos, trucks]);

  const relatorios = (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card p-6"><div className="text-sm">Total no período</div><div className="text-3xl font-bold">R$ {relatoriosData.totalPeriodo.toFixed(2)}</div></div>
        <div className="card p-6"><div className="text-sm">Média custo/km</div><div className="text-3xl font-bold">R$ {relatoriosData.mediaKm.toFixed(2)}</div></div>
        <div className="card p-6"><div className="text-sm">Média custo/hora</div><div className="text-3xl font-bold">R$ {relatoriosData.mediaHora.toFixed(2)}</div></div>
        <div className="card p-6"><div className="text-sm">Registros</div><div className="text-3xl font-bold">{custos.length}</div></div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card p-6">
          <div className="font-semibold mb-4">Custo total por mês</div>
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={relatoriosData.meses}>
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="total" fill="#2563eb" radius={[8,8,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card p-6">
          <div className="font-semibold mb-4">Custo médio por km</div>
          <div className="h-72">
            <ResponsiveContainer>
              <LineChart data={relatoriosData.meses.map((m) => ({ month: m.month, value: m.km ? m.total / m.km : 0 }))}>
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="value" stroke="#38bdf8" strokeWidth={3} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card p-6">
          <div className="font-semibold mb-4">Distribuição de custos</div>
          <div className="h-72">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={relatoriosData.dist} dataKey="value" nameKey="name" outerRadius={110}>
                  {relatoriosData.dist.map((_, i) => (
                    <Cell key={i} fill={colors[i % colors.length]} stroke="#ffffff" />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      <div className="card p-6">
        <div className="font-semibold mb-4">Custo por caminhão (top 10)</div>
        <div className="h-72">
          <ResponsiveContainer>
            <BarChart data={relatoriosData.porCaminhao}>
              <XAxis dataKey="truck" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="total" fill="#22c55e" radius={[8,8,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );

  const novo = (
    <div className="space-y-6">
      <div className="card p-6">
        <div className="font-semibold mb-4 text-secondary text-xl">Novo custo</div>
        <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <select className="select" value={form.viagemId} onChange={(e) => handleTripLink(e.target.value)}>
            <option value="">Vincular viagem</option>
            {trips.map((t) => <option key={t.id} value={t.id}>{t.id} - {t.date}</option>)}
          </select>
          <input className="input" placeholder="Data registro (YYYY-MM-DD)" value={form.dataRegistro} onChange={(e) => setForm({ ...form, dataRegistro: e.target.value })} />
          <input className="input" placeholder="Consumo (litros)" value={form.consumoLitros} onChange={(e) => setForm({ ...form, consumoLitros: e.target.value })} />
          <input className="input" placeholder="Valor por litro" value={form.valorLitro} onChange={(e) => setForm({ ...form, valorLitro: e.target.value })} />
          <input className="input" placeholder="Diária motorista" value={form.diariaMotorista} onChange={(e) => setForm({ ...form, diariaMotorista: e.target.value })} />
          <input className="input" placeholder="Pedágios" value={form.pedagios} onChange={(e) => setForm({ ...form, pedagios: e.target.value })} />
          <input className="input" placeholder="Manutenção" value={form.manutencao} onChange={(e) => setForm({ ...form, manutencao: e.target.value })} />
          <input className="input" placeholder="KM rodado" value={form.kmRodado || ""} onChange={(e) => setForm({ ...form, kmRodado: e.target.value })} />
          <input className="input" placeholder="Tempo (horas)" value={form.tempoHoras || ""} onChange={(e) => setForm({ ...form, tempoHoras: e.target.value })} />
          <div className="md:col-span-4">
            <div className="flex gap-2">
              <input className="input" placeholder="Descrição" value={addingOther.descricao} onChange={(e) => setAddingOther({ ...addingOther, descricao: e.target.value })} />
              <input className="input" placeholder="Valor" value={addingOther.valor} onChange={(e) => setAddingOther({ ...addingOther, valor: e.target.value })} />
              <button type="button" className="btn btn-secondary" onClick={addOther}>Adicionar</button>
            </div>
          <div className="mt-2">
            {(form.outrosCustos || []).map((o, i) => (
              <div key={i} className="flex items-center justify-between py-2">
                <div>{o.descricao}</div>
                <div>R$ {Number(o.valor).toFixed(2)}</div>
              </div>
            ))}
          </div>
        </div>
          <textarea className="input md:col-span-4" placeholder="Observações" value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
          <div className="md:col-span-4">
            <div className="font-medium mb-2">Anexos</div>
            <input type="file" multiple onChange={handleFiles} />
            <div className="mt-2 text-sm">{(form.anexos||[]).length} arquivo(s) selecionado(s)</div>
          </div>
          <div className="md:col-span-4 flex gap-2">
            <button type="button" className="btn" onClick={() => {
              const consumoLitros = Number(form.consumoLitros || 0);
              const valorLitro = Number(form.valorLitro || 0);
              const diariaMotorista = Number(form.diariaMotorista || 0);
              const pedagios = Number(form.pedagios || 0);
              const manutencao = Number(form.manutencao || 0);
              const outros = (form.outrosCustos || []).reduce((a, it) => a + Number(it.valor || 0), 0);
              const custoCombustivel = consumoLitros * valorLitro;
              const subtotal = custoCombustivel + diariaMotorista + pedagios + manutencao + outros;
              const km = Number(form.kmRodado || 0);
              const porKm = km > 0 ? subtotal / km : 0;
              setCalc({ custoCombustivel, subtotal, porKm });
              toast?.show("Cálculo atualizado", "success");
            }}>Calcular</button>
            <button className="btn btn-primary">{editingId ? "Salvar" : "Cadastrar"}</button>
            <button type="button" className="btn btn-secondary" onClick={() => { toast?.show("Solicitação de aprovação registrada", "success"); setTab("lista"); }}>Solicitar aprovação</button>
          </div>
        </form>
      </div>
      {calc && (
        <div className="card p-6">
          <div className="font-semibold mb-2">Passo-a-passo</div>
          <div>Combustível: R$ {Number(calc.custoCombustivel).toFixed(2)}</div>
          <div>Subtotal: R$ {Number(calc.subtotal).toFixed(2)}</div>
          <div>Custo por km: R$ {Number(calc.porKm).toFixed(4)}</div>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <button className={`btn ${tab === "lista" ? "btn-primary" : "btn-secondary"}`} onClick={() => setTab("lista")}>Lista</button>
        <button className={`btn ${tab === "novo" ? "btn-primary" : "btn-secondary"}`} onClick={() => { setEditingId(null); setTab("novo"); }}>Novo custo</button>
        <button className={`btn ${tab === "relatorios" ? "btn-primary" : "btn-secondary"}`} onClick={() => setTab("relatorios")}>Relatórios</button>
      </div>
      {tab === "lista" && lista}
      {tab === "novo" && novo}
      {tab === "relatorios" && relatorios}

      {viewing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="card p-6 w-full max-w-2xl">
            <div className="font-semibold mb-2">Detalhes do custo</div>
            <div className="grid grid-cols-2 gap-2">
              <div>Data: {String(viewing.dataRegistro).slice(0,10)}</div>
              <div>Viagem: {viewing.viagemId}</div>
              <div>Caminhão: {trucks.find((t) => String(t.id) === String(viewing.caminhaoId))?.plate || viewing.caminhaoId || ""}</div>
              <div>Prancha: {pranchas.find((p) => String(p.id) === String(viewing.pranchaId))?.identifier || viewing.pranchaId || ""}</div>
              <div>KM rodado: {viewing.kmRodado}</div>
              <div>Horas: {viewing.tempoHoras}</div>
              <div>Combustível: R$ {Number(viewing.custoCombustivel || 0).toFixed(2)}</div>
              <div>Total: R$ {Number(viewing.custoTotal || 0).toFixed(2)}</div>
            </div>
            <div className="mt-4">
              <div className="font-medium">Outros custos</div>
              <div>
                {(viewing.outrosCustos || []).map((o, i) => (
                  <div key={i} className="flex items-center justify-between py-1"><div>{o.descricao}</div><div>R$ {Number(o.valor).toFixed(2)}</div></div>
                ))}
              </div>
            </div>
            <div className="mt-4">
              <div className="font-medium">Anexos</div>
              <div className="text-sm">
                {(viewing.anexos || []).map((a) => {
                  const href = a.base64 ? `data:application/octet-stream;base64,${a.base64}` : a.path || "#";
                  return <div key={a.id}><a className="text-primary" href={href} download={a.nome || "arquivo"}>{a.nome || "arquivo"}</a> • {String(a.uploadedAt||"").slice(0,19).replace("T"," ")}</div>;
                })}
              </div>
            </div>
            <div className="mt-4">
              <div className="font-medium">Audit trail</div>
              <div className="text-sm">
                {(viewing.audit || []).map((a, i) => (
                  <div key={i}>{String(a.when).slice(0,19).replace("T"," ")} • {a.who} • {a.what}</div>
                ))}
              </div>
            </div>
            <div className="mt-4">
              <div className="font-medium">Custo por km vs média</div>
              <div className="h-40">
                <ResponsiveContainer>
                  <BarChart data={[{ name: "Registro", value: Number(viewing.custoPorKm || 0) }, { name: "Média", value: (custos.reduce((a,c)=> a + Number(c.custoPorKm||0),0) / (custos.length||1)) }] }>
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="#a78bfa" radius={[8,8,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button className="btn" onClick={() => setViewing(null)}>Fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

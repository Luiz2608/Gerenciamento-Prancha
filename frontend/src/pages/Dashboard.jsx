import { useEffect, useState, useRef } from "react";
import { dashboard } from "../services/storageService.js";
import { supabase } from "../services/supabaseClient.js";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, LabelList, Legend, CartesianGrid } from "recharts";

export default function Dashboard() {
  const now = new Date();
  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
  const labelColor = isDark ? '#e5e7eb' : '#0f172a';
  const gridColor = isDark ? '#374151' : '#e5e7eb';
  const months = [
    { v: "01", n: "Jan" }, { v: "02", n: "Fev" }, { v: "03", n: "Mar" }, { v: "04", n: "Abr" },
    { v: "05", n: "Mai" }, { v: "06", n: "Jun" }, { v: "07", n: "Jul" }, { v: "08", n: "Ago" },
    { v: "09", n: "Set" }, { v: "10", n: "Out" }, { v: "11", n: "Nov" }, { v: "12", n: "Dez" }
  ];
  const [data, setData] = useState(null);
  const [period, setPeriod] = useState(() => {
    const saved = localStorage.getItem("dashboard_period_draft");
    return saved ? JSON.parse(saved) : { month: String(now.getMonth() + 1).padStart(2, "0"), year: now.getFullYear(), location: "" };
  });

  useEffect(() => {
    localStorage.setItem("dashboard_period_draft", JSON.stringify(period));
  }, [period]);

  const refresh = async (p = period) => {
    const r = await dashboard({ month: Number(p.month), year: Number(p.year), location: p.location });
    setData(r);
  };

  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useEffect(() => { refresh(period); }, []);

  useEffect(() => {
    let channels = [];
    const initRealtime = async () => {
      if (supabase) {
        const ch1 = supabase.channel("public:viagens").on("postgres_changes", { event: "*", schema: "public", table: "viagens" }, () => { refreshRef.current(); }).subscribe();
        const ch2 = supabase.channel("public:motoristas").on("postgres_changes", { event: "*", schema: "public", table: "motoristas" }, () => { refreshRef.current(); }).subscribe();
        const ch3 = supabase.channel("public:caminhoes").on("postgres_changes", { event: "*", schema: "public", table: "caminhoes" }, () => { refreshRef.current(); }).subscribe();
        const ch4 = supabase.channel("public:pranchas").on("postgres_changes", { event: "*", schema: "public", table: "pranchas" }, () => { refreshRef.current(); }).subscribe();
        channels = [ch1, ch2, ch3, ch4];
      }
    };
    initRealtime();

    const interval = setInterval(() => { refreshRef.current(); }, 10000);
    return () => {
      if (channels.length > 0) {
        if(supabase) channels.forEach(ch => supabase.removeChannel(ch));
      }
      clearInterval(interval);
    };
  }, []);

  const formatCurrency = (value) => `R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const formatNumber = (value) => Number(value).toLocaleString('pt-BR');

  if (!data) return <div className="animate-fade">Carregando...</div>;

  return (
    <div className="p-4 max-w-6xl mx-auto pb-24">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 p-4 flex flex-col md:flex-row md:items-center gap-3 mb-6">
        <div className="font-semibold text-slate-700 dark:text-slate-200">Período</div>
        <select className="select" value={period.month} onChange={(e) => { const p = { ...period, month: e.target.value }; setPeriod(p); refresh(p); }}>
          {months.map((m) => (<option key={m.v} value={m.v}>{m.n}</option>))}
        </select>
        <input className="input w-28" inputMode="numeric" value={period.year} onChange={(e) => { const p = { ...period, year: e.target.value.replace(/[^0-9]/g, '').slice(0,4) || "" }; setPeriod(p); }} onBlur={() => { const y = Number(period.year || now.getFullYear()); const p = { ...period, year: y }; setPeriod(p); refresh(p); }} />
        <select className="select" value={period.location} onChange={(e) => { const p = { ...period, location: e.target.value }; setPeriod(p); refresh(p); }}>
          <option value="">Todas as Unidades</option>
          <option value="Cambuí">Cambuí</option>
          <option value="Vale">Vale</option>
          <option value="Panorama">Panorama</option>
          <option value="Floresta">Floresta</option>
        </select>
        <div className="text-xs text-slate-500">Preparado para futuro intervalo personalizado</div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-10 mb-10">
        <div className="card card-hover p-6 border-t-4 border-accent">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-accent/20 text-accent flex items-center justify-center text-2xl">🧭</div>
              <div>
                <div className="text-sm font-medium text-slate-600 dark:text-slate-400">Viagens no Mês</div>
                <div className="text-3xl font-bold">{data.totalTrips}</div>
              </div>
            </div>
            {data.trends && (
              <div className={`text-sm font-bold ${data.trends.trips >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {data.trends.trips > 0 ? '↑' : data.trends.trips < 0 ? '↓' : '-'} {Math.abs(data.trends.trips).toFixed(1)}%
              </div>
            )}
          </div>
        </div>

        <div className="card card-hover p-6 border-t-4 border-pink-500">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-pink-500/20 text-pink-600 flex items-center justify-center text-2xl">💸</div>
              <div>
                <div className="text-sm font-medium text-slate-600 dark:text-slate-400">Total Gasto</div>
                <div className="text-3xl font-bold">{formatCurrency(data.totalCostsMonth || 0)}</div>
              </div>
            </div>
            {data.trends && (
              <div className={`text-sm font-bold ${data.trends.costs <= 0 ? 'text-green-600' : 'text-red-600'}`}>
                 {data.trends.costs > 0 ? '↑' : data.trends.costs < 0 ? '↓' : '-'} {Math.abs(data.trends.costs).toFixed(1)}%
              </div>
            )}
          </div>
        </div>

        <div className="card card-hover p-6 border-t-4 border-green-500">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-green-500/20 text-green-600 flex items-center justify-center text-2xl">⏱️</div>
              <div>
                <div className="text-sm font-medium text-slate-600 dark:text-slate-400">Horas Trabalhadas</div>
                <div className="text-3xl font-bold">{data.totalHours}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="card card-hover p-6 border-t-4 border-primary">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-primary/20 text-primary flex items-center justify-center text-2xl">✅</div>
            <div>
              <div className="text-sm font-medium text-slate-600 dark:text-slate-400">Serviços Concluídos</div>
              <div className="text-3xl font-bold">{data.totalCompleted}</div>
            </div>
          </div>
        </div>

        <div className="card card-hover p-6 border-t-4 border-yellow-500">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-yellow-500/20 text-yellow-600 flex items-center justify-center text-2xl">⚠️</div>
            <div>
              <div className="text-sm font-medium text-slate-600 dark:text-slate-400">Viagens Pendentes</div>
              <div className="text-3xl font-bold">{data.pendingTrips || 0}</div>
            </div>
          </div>
        </div>

        <div className="card card-hover p-6 border-t-4 border-cyan-500">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 text-cyan-600 flex items-center justify-center text-2xl">🚛</div>
            <div>
              <div className="text-sm font-medium text-slate-600 dark:text-slate-400">Caminhões Disponíveis</div>
              <div className="text-3xl font-bold">{data.trucksAvailable || 0} <span className="text-xs text-slate-500 font-normal">/ {data.totalTrucks || 0}</span></div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="card p-6">
          <div className="font-semibold mb-6 text-slate-900 dark:text-slate-100 text-lg">Km por Mês</div>
          <div className="h-80">
            <ResponsiveContainer>
              <BarChart data={data.kmByMonth} margin={{ top: 20, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                <XAxis dataKey="month" tick={{ fill: labelColor }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: labelColor }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                <Tooltip contentStyle={{ backgroundColor: isDark ? '#1f2937' : '#fff', borderColor: gridColor, color: labelColor }} formatter={(v) => [`${formatNumber(v)} km`, 'KM Rodados']} />
                <Legend wrapperStyle={{ color: labelColor }} />
                <Bar name="KM Rodados" dataKey="km" fill="#2563eb" radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="km" position="top" fill={labelColor} formatter={(v) => v >= 1000 ? `${(v/1000).toFixed(1)}k` : v} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card p-6">
          <div className="font-semibold mb-6 text-slate-900 dark:text-slate-100 text-lg">Viagens por Motorista</div>
          <div className="h-80">
            <ResponsiveContainer>
              <BarChart data={data.tripsByDriver} margin={{ top: 20, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                <XAxis 
                  dataKey="name" 
                  tick={{ fill: labelColor, fontSize: 12 }} 
                  interval={0} 
                  angle={-45} 
                  textAnchor="end"
                  height={80} 
                  axisLine={false} 
                  tickLine={false}
                  tickFormatter={(v) => {
                    if (!v) return "";
                    const parts = v.split(" ");
                    if (parts.length >= 2) return `${parts[0]} ${parts[parts.length-1].slice(0,1)}.`;
                    return v.slice(0, 10) + (v.length > 10 ? "." : "");
                  }}
                />
                <YAxis tick={{ fill: labelColor }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ backgroundColor: isDark ? '#1f2937' : '#fff', borderColor: gridColor, color: labelColor }} formatter={(v) => [v, 'Viagens']} />
                <Legend wrapperStyle={{ color: labelColor }} />
                <Bar name="Viagens" dataKey="value" fill="#0ea5e9" radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="value" position="top" fill={labelColor} formatter={(v) => v > 0 ? v : ''} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card p-6">
          <div className="font-semibold mb-6 text-slate-900 dark:text-slate-100 text-lg">Horas por Mês</div>
          <div className="h-80">
            <ResponsiveContainer>
              <LineChart data={data.hoursByMonth} margin={{ top: 20, right: 30, left: 20, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                <XAxis dataKey="month" tick={{ fill: labelColor }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: labelColor }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : `${v}h`} />
                <Tooltip contentStyle={{ backgroundColor: isDark ? '#1f2937' : '#fff', borderColor: gridColor, color: labelColor }} formatter={(v) => [`${formatNumber(v)}h`, 'Horas Trabalhadas']} />
                <Legend wrapperStyle={{ color: labelColor }} />
                <Line name="Horas Trabalhadas" type="monotone" dataKey="hours" stroke="#38bdf8" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }}>
                  <LabelList dataKey="hours" position="top" fill={labelColor} formatter={(v) => v >= 1000 ? `${(v/1000).toFixed(1)}k` : (v > 0 ? v : '')} />
                </Line>
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card p-6">
          <div className="font-semibold mb-6 text-slate-900 dark:text-slate-100 text-lg">Custos por Mês</div>
          <div className="h-80">
            <ResponsiveContainer>
              <BarChart data={data.costsByMonth} margin={{ top: 20, right: 30, left: 20, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                <XAxis dataKey="month" tick={{ fill: labelColor }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: labelColor }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000 ? `R$${(v/1000).toFixed(0)}k` : `R$${v}`} />
                <Tooltip contentStyle={{ backgroundColor: isDark ? '#1f2937' : '#fff', borderColor: gridColor, color: labelColor }} formatter={(v) => [formatCurrency(v), 'Custo Total']} />
                <Legend wrapperStyle={{ color: labelColor }} />
                <Bar name="Custo Total" dataKey="total" fill="#ef4444" radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="total" position="top" fill={labelColor} formatter={(v) => v >= 1000 ? `R$${(v/1000).toFixed(1)}k` : (v > 0 ? `R$${v}` : '')} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card p-6 lg:col-span-2">
          <div className="font-semibold mb-6 text-slate-900 dark:text-slate-100 text-lg">Custos por Categoria</div>
          <div className="h-80">
            <ResponsiveContainer>
              <BarChart data={data.costsByCategory} margin={{ top: 20, right: 30, left: 20, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                <XAxis 
                  dataKey="name" 
                  tick={{ fill: labelColor, fontSize: 13 }} 
                  interval={0} 
                  angle={-30} 
                  textAnchor="end"
                  height={100} 
                  axisLine={false} 
                  tickLine={false} 
                  tickFormatter={(v) => v.length > 20 ? v.slice(0, 20) + "..." : v}
                />
                <YAxis tick={{ fill: labelColor }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000 ? `R$${(v/1000).toFixed(0)}k` : `R$${v}`} />
                <Tooltip contentStyle={{ backgroundColor: isDark ? '#1f2937' : '#fff', borderColor: gridColor, color: labelColor }} formatter={(v) => [formatCurrency(v), 'Custo']} />
                <Legend wrapperStyle={{ color: labelColor }} />
                <Bar name="Custo" dataKey="value" fill="#f59e0b" radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="value" position="top" fill={labelColor} formatter={(v) => v >= 1000 ? `R$${(v/1000).toFixed(1)}k` : (v > 0 ? `R$${v}` : '')} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

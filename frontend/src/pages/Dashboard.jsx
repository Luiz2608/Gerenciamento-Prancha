import { useEffect, useState } from "react";
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
  const [period, setPeriod] = useState({ month: String(now.getMonth() + 1).padStart(2, "0"), year: now.getFullYear() });

  const refresh = async (p = period) => {
    const r = await dashboard({ month: Number(p.month), year: Number(p.year) });
    setData(r);
  };

  useEffect(() => { refresh(period); }, []);

  useEffect(() => {
    let ch1, ch2, ch3, ch4;
    if (supabase) {
      ch1 = supabase.channel("public:viagens").on("postgres_changes", { event: "*", schema: "public", table: "viagens" }, () => { refresh(); }).subscribe();
      ch2 = supabase.channel("public:motoristas").on("postgres_changes", { event: "*", schema: "public", table: "motoristas" }, () => { refresh(); }).subscribe();
      ch3 = supabase.channel("public:caminhoes").on("postgres_changes", { event: "*", schema: "public", table: "caminhoes" }, () => { refresh(); }).subscribe();
      ch4 = supabase.channel("public:pranchas").on("postgres_changes", { event: "*", schema: "public", table: "pranchas" }, () => { refresh(); }).subscribe();
    }
    const interval = setInterval(() => { refresh(); }, 10000);
    return () => {
      if (supabase) { supabase.removeChannel(ch1); supabase.removeChannel(ch2); supabase.removeChannel(ch3); supabase.removeChannel(ch4); }
      clearInterval(interval);
    };
  }, []);

  const formatCurrency = (value) => `R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const formatNumber = (value) => Number(value).toLocaleString('pt-BR');

  if (!data) return <div className="animate-fade">Carregando...</div>;

  return (
    <div className="space-y-8 animate-fade overflow-x-auto overflow-y-auto min-h-screen page" style={{ WebkitOverflowScrolling: 'touch', overscrollBehaviorX: 'contain', overscrollBehaviorY: 'contain', touchAction: 'pan-y' }}>
      <div className="card sticky top-0 z-10 p-4 flex flex-col md:flex-row md:items-center gap-3">
        <div className="font-semibold">Período</div>
        <select className="select" value={period.month} onChange={(e) => { const p = { ...period, month: e.target.value }; setPeriod(p); refresh(p); }}>
          {months.map((m) => (<option key={m.v} value={m.v}>{m.n}</option>))}
        </select>
        <input className="input w-28" inputMode="numeric" value={period.year} onChange={(e) => { const p = { ...period, year: e.target.value.replace(/[^0-9]/g, '').slice(0,4) || "" }; setPeriod(p); }} onBlur={() => { const y = Number(period.year || now.getFullYear()); const p = { ...period, year: y }; setPeriod(p); refresh(p); }} />
        <div className="text-xs text-slate-500">Preparado para futuro intervalo personalizado</div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="card card-hover p-6 border-t-4 border-accent">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-accent/20 text-accent flex items-center justify-center text-2xl">🧭</div>
            <div>
              <div className="text-sm">Viagens no Mês</div>
              <div className="text-3xl font-bold">{data.totalTrips}</div>
            </div>
          </div>
        </div>
        <div className="card card-hover p-6 border-t-4 border-pink-500">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-pink-500/20 text-pink-600 flex items-center justify-center text-2xl">💸</div>
            <div>
              <div className="text-sm">Total Gasto</div>
              <div className="text-3xl font-bold">{formatCurrency(data.totalCostsMonth || 0)}</div>
            </div>
          </div>
        </div>
        <div className="card card-hover p-6 border-t-4 border-green-500">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-green-500/20 text-green-600 flex items-center justify-center text-2xl">⏱️</div>
            <div>
              <div className="text-sm">Horas Trabalhadas</div>
              <div className="text-3xl font-bold">{data.totalHours}</div>
            </div>
          </div>
        </div>
        <div className="card card-hover p-6 border-t-4 border-primary">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-primary/20 text-primary flex items-center justify-center text-2xl">✅</div>
            <div>
              <div className="text-sm">Serviços Concluídos</div>
              <div className="text-3xl font-bold">{data.totalCompleted}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card p-6">
          <div className="font-semibold mb-4 text-slate-900 dark:text-slate-100">KM por Mês</div>
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={data.kmByMonth}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                <XAxis dataKey="month" tick={{ fill: labelColor }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: labelColor }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}km`} />
                <Tooltip contentStyle={{ backgroundColor: isDark ? '#1f2937' : '#fff', borderColor: gridColor, color: labelColor }} formatter={(v) => [`${v} km`, 'KM Rodados']} />
                <Legend wrapperStyle={{ color: labelColor }} />
                <Bar name="KM Rodados" dataKey="km" fill="#2563eb" radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="km" position="top" fill={labelColor} formatter={(v) => v > 0 ? v : ''} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card p-6">
          <div className="font-semibold mb-4 text-slate-900 dark:text-slate-100">Viagens por Motorista</div>
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={data.tripsByDriver}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                <XAxis dataKey="name" tick={{ fill: labelColor }} interval={0} angle={-20} height={60} axisLine={false} tickLine={false} />
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
          <div className="font-semibold mb-4 text-slate-900 dark:text-slate-100">Horas por Mês</div>
          <div className="h-72">
            <ResponsiveContainer>
              <LineChart data={data.hoursByMonth}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                <XAxis dataKey="month" tick={{ fill: labelColor }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: labelColor }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}h`} />
                <Tooltip contentStyle={{ backgroundColor: isDark ? '#1f2937' : '#fff', borderColor: gridColor, color: labelColor }} formatter={(v) => [`${v}h`, 'Horas Trabalhadas']} />
                <Legend wrapperStyle={{ color: labelColor }} />
                <Line name="Horas Trabalhadas" type="monotone" dataKey="hours" stroke="#38bdf8" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }}>
                  <LabelList dataKey="hours" position="top" fill={labelColor} formatter={(v) => v > 0 ? v : ''} />
                </Line>
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card p-6">
          <div className="font-semibold mb-4 text-slate-900 dark:text-slate-100">Custos por Mês</div>
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={data.costsByMonth}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                <XAxis dataKey="month" tick={{ fill: labelColor }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: labelColor }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000 ? `R$${(v/1000).toFixed(0)}k` : `R$${v}`} />
                <Tooltip contentStyle={{ backgroundColor: isDark ? '#1f2937' : '#fff', borderColor: gridColor, color: labelColor }} formatter={(v) => [formatCurrency(v), 'Custo Total']} />
                <Legend wrapperStyle={{ color: labelColor }} />
                <Bar name="Custo Total" dataKey="total" fill="#ef4444" radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="total" position="top" fill={labelColor} formatter={(v) => v > 0 ? `R$${(v/1000).toFixed(1)}k` : ''} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card p-6 lg:col-span-3">
          <div className="font-semibold mb-4 text-slate-900 dark:text-slate-100">Custos por Categoria</div>
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={data.costsByCategory}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                <XAxis dataKey="name" tick={{ fill: labelColor }} interval={0} angle={-20} height={60} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: labelColor }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000 ? `R$${(v/1000).toFixed(0)}k` : `R$${v}`} />
                <Tooltip contentStyle={{ backgroundColor: isDark ? '#1f2937' : '#fff', borderColor: gridColor, color: labelColor }} formatter={(v) => [formatCurrency(v), 'Custo']} />
                <Legend wrapperStyle={{ color: labelColor }} />
                <Bar name="Custo" dataKey="value" fill="#f59e0b" radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="value" position="top" fill={labelColor} formatter={(v) => v > 0 ? formatCurrency(v) : ''} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

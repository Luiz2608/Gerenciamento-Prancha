import { useEffect, useState } from "react";
import { dashboard } from "../services/storageService.js";
import { supabase } from "../services/supabaseClient.js";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";

const colors = ["#2563eb", "#38bdf8", "#22c55e", "#a78bfa", "#f59e0b", "#ef4444", "#14b8a6", "#0ea5e9"];

export default function Dashboard() {
  const [data, setData] = useState(null);
  useEffect(() => { dashboard().then((r) => setData(r)); }, []);
  useEffect(() => {
    let ch1, ch2, ch3, ch4;
    if (supabase) {
      ch1 = supabase.channel("public:viagens").on("postgres_changes", { event: "*", schema: "public", table: "viagens" }, () => { dashboard().then((r) => setData(r)); }).subscribe();
      ch2 = supabase.channel("public:motoristas").on("postgres_changes", { event: "*", schema: "public", table: "motoristas" }, () => { dashboard().then((r) => setData(r)); }).subscribe();
      ch3 = supabase.channel("public:caminhoes").on("postgres_changes", { event: "*", schema: "public", table: "caminhoes" }, () => { dashboard().then((r) => setData(r)); }).subscribe();
      ch4 = supabase.channel("public:pranchas").on("postgres_changes", { event: "*", schema: "public", table: "pranchas" }, () => { dashboard().then((r) => setData(r)); }).subscribe();
    }
    const interval = setInterval(() => { dashboard().then((r) => setData(r)); }, 10000);
    return () => {
      if (supabase) { supabase.removeChannel(ch1); supabase.removeChannel(ch2); supabase.removeChannel(ch3); supabase.removeChannel(ch4); }
      clearInterval(interval);
    };
  }, []);
  if (!data) return <div className="animate-fade">Carregando...</div>;
  return (
    <div className="space-y-8 animate-fade overflow-x-auto overflow-y-auto min-h-screen page" style={{ WebkitOverflowScrolling: 'touch', overscrollBehaviorX: 'contain', overscrollBehaviorY: 'contain', touchAction: 'pan-y' }}>
      
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        <div className="card card-hover p-6 border-t-4 border-accent">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-accent/20 text-accent flex items-center justify-center text-2xl">🧭</div>
            <div>
              <div className="text-sm">Viagens no mês</div>
              <div className="text-3xl font-bold">{data.totalTrips}</div>
            </div>
          </div>
        </div>
        <div className="card card-hover p-6 border-t-4 border-primary">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-primary/20 text-primary flex items-center justify-center text-2xl">🛣️</div>
            <div>
              <div className="text-sm">KM no mês</div>
              <div className="text-3xl font-bold">{data.totalKm}</div>
            </div>
          </div>
        </div>
        <div className="card card-hover p-6 border-t-4 border-green-500">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-green-500/20 text-green-600 flex items-center justify-center text-2xl">⏱️</div>
            <div>
              <div className="text-sm">Horas no mês</div>
              <div className="text-3xl font-bold">{data.totalHours}</div>
            </div>
          </div>
        </div>
        <div className="card card-hover p-6 border-t-4 border-yellow-400">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-yellow-400/20 text-yellow-600 flex items-center justify-center text-2xl">👨‍✈️</div>
            <div>
              <div className="text-sm">Motorista destaque</div>
              <div className="text-3xl font-bold">{data.topDriver || "-"}</div>
            </div>
          </div>
        </div>
        <div className="card card-hover p-6 border-t-4 border-purple-500">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/20 text-purple-600 flex items-center justify-center text-2xl">📍</div>
            <div>
              <div className="text-sm">Destino frequente</div>
              <div className="text-3xl font-bold">{data.topDestination || "-"}</div>
            </div>
          </div>
        </div>
        <div className="card card-hover p-6 border-t-4 border-pink-500">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-pink-500/20 text-pink-600 flex items-center justify-center text-2xl">💸</div>
            <div>
              <div className="text-sm">Custos no mês</div>
              <div className="text-3xl font-bold">R$ {data.totalCostsMonth.toFixed(2)}</div>
            </div>
          </div>
        </div>
        <div className="card card-hover p-6 border-t-4 border-slate-500">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-slate-500/20 text-slate-700 flex items-center justify-center text-2xl">🧑‍🔧</div>
            <div>
              <div className="text-sm">Motoristas</div>
              <div className="text-3xl font-bold">{data.totalDrivers}</div>
            </div>
          </div>
        </div>
        <div className="card card-hover p-6 border-t-4 border-slate-700">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-slate-700/20 text-slate-800 flex items-center justify-center text-2xl">🚛</div>
            <div>
              <div className="text-sm">Caminhões</div>
              <div className="text-3xl font-bold">{data.totalTrucks}</div>
            </div>
          </div>
        </div>
        <div className="card card-hover p-6 border-t-4 border-slate-800">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-slate-800/20 text-slate-900 flex items-center justify-center text-2xl">🛠️</div>
            <div>
              <div className="text-sm">Pranchas</div>
              <div className="text-3xl font-bold">{data.totalPranchas}</div>
            </div>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card p-6">
          <div className="font-semibold mb-4">KM por mês</div>
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={data.kmByMonth}>
                <XAxis dataKey="month" tick={{ fill: "#0f172a" }} />
                <YAxis tick={{ fill: "#0f172a" }} />
                <Tooltip />
                <Bar dataKey="km" fill="#2563eb" radius={[8,8,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card p-6">
          <div className="font-semibold mb-4">Viagens por motorista</div>
          <div className="h-72">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={data.tripsByDriver} dataKey="value" nameKey="name" outerRadius={110}>
                  {data.tripsByDriver.map((_, i) => (
                    <Cell key={i} fill={colors[i % colors.length]} stroke="#ffffff" />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card p-6">
          <div className="font-semibold mb-4">Horas por mês</div>
          <div className="h-72">
            <ResponsiveContainer>
              <LineChart data={data.hoursByMonth}>
                <XAxis dataKey="month" tick={{ fill: "#0f172a" }} />
                <YAxis tick={{ fill: "#0f172a" }} />
                <Tooltip />
                <Line type="monotone" dataKey="hours" stroke="#38bdf8" strokeWidth={3} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card p-6">
          <div className="font-semibold mb-4">Custos por mês</div>
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={data.costsByMonth}>
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="total" fill="#ef4444" radius={[8,8,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card p-6 lg:col-span-3">
          <div className="font-semibold mb-4">Custos por categoria</div>
          <div className="h-72">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={data.costsByCategory} dataKey="value" nameKey="name" outerRadius={140}>
                  {data.costsByCategory.map((_, i) => (
                    <Cell key={i} fill={colors[i % colors.length]} stroke="#ffffff" />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

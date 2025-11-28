import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import useAuth from "../hooks/useAuth.js";

export default function MainLayout() {
  const { logout } = useAuth();
  const loc = useLocation();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [dark, setDark] = useState(() => localStorage.getItem("theme") === "dark");
  useEffect(() => {
    const root = document.documentElement;
    if (dark) {
      root.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      root.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [dark]);
  const goLogout = () => { logout(); nav("/"); };
  const isActive = (p) => (loc.pathname === p || loc.pathname.startsWith(p));
  return (
    <div className="min-h-screen flex bg-bg text-text dark:bg-[#0f172a] dark:text-[#f1f5f9]">
      <aside className={`${open ? "translate-x-0" : "-translate-x-full"} md:translate-x-0 fixed md:static z-20 w-72 bg-[#1e3a8a] text-white h-full transition-transform duration-300 shadow-xl dark:bg-[#1e293b]`}>
        <div className="p-5 flex items-center gap-3 text-white">
          <div className="w-10 h-10 bg-accent rounded-xl flex items-center justify-center">🚚</div>
          <div className="text-lg font-bold">Prancha</div>
        </div>
        <nav className="px-3 space-y-1">
          <Link className={`flex items-center gap-3 px-4 py-3 rounded-xl transition ${isActive("/dashboard") ? "bg-accent/20 text-white" : "hover:bg-white/10"}`} to="/dashboard">🏠 <span>Dashboard</span></Link>
          <Link className={`flex items-center gap-3 px-4 py-3 rounded-xl transition ${isActive("/viagens") ? "bg-accent/20 text-white" : "hover:bg-white/10"}`} to="/viagens">🧭 <span>Viagens</span></Link>
          <Link className={`flex items-center gap-3 px-4 py-3 rounded-xl transition ${isActive("/motoristas") ? "bg-accent/20 text-white" : "hover:bg-white/10"}`} to="/motoristas">👨‍✈️ <span>Motoristas</span></Link>
          <Link className={`flex items-center gap-3 px-4 py-3 rounded-xl transition ${isActive("/historico") ? "bg-accent/20 text-white" : "hover:bg-white/10"}`} to="/historico">🗂️ <span>Histórico</span></Link>
          <Link className={`flex items-center gap-3 px-4 py-3 rounded-xl transition ${isActive("/historico-caminhao") ? "bg-accent/20 text-white" : "hover:bg-white/10"}`} to="/historico-caminhao">🗂️ <span>Histórico por Caminhão</span></Link>
          <Link className={`flex items-center gap-3 px-4 py-3 rounded-xl transition ${isActive("/historico-prancha") ? "bg-accent/20 text-white" : "hover:bg-white/10"}`} to="/historico-prancha">🗂️ <span>Histórico por Prancha</span></Link>
          <div className="mt-2">
            <div className="px-4 py-2 text-white/80">Frota</div>
            <Link className={`flex items-center gap-3 px-4 py-3 rounded-xl transition ${isActive("/frota/caminhoes") ? "bg-accent/20 text-white" : "hover:bg-white/10"}`} to="/frota/caminhoes">🚛 <span>Caminhão</span></Link>
            <Link className={`flex items-center gap-3 px-4 py-3 rounded-xl transition ${isActive("/frota/pranchas") ? "bg-accent/20 text-white" : "hover:bg-white/10"}`} to="/frota/pranchas">🛠️ <span>Prancha</span></Link>
          </div>
          <Link className={`flex items-center gap-3 px-4 py-3 rounded-xl transition ${isActive("/custos") ? "bg-accent/20 text-white" : "hover:bg-white/10"}`} to="/custos">💸 <span>Custos</span></Link>
          <Link className={`flex items-center gap-3 px-4 py-3 rounded-xl transition ${isActive("/admin") ? "bg-accent/20 text-white" : "hover:bg-white/10"}`} to="/admin">⚙️ <span>Administração</span></Link>
          <button className="flex items-center gap-3 px-4 py-3 rounded-xl transition hover:bg-white/10" onClick={goLogout}>🚪 <span>Sair</span></button>
        </nav>
      </aside>
      <div className="flex-1 md:ml-0 ml-0">
        <header className="sticky top-0 z-10 bg-white shadow-md dark:bg-[#1e293b] dark:shadow-none">
          <div className="flex items-center justify-between px-6 py-4">
            <button className="md:hidden btn btn-primary" onClick={() => setOpen(!open)}>Menu</button>
            <div className="font-bold text-lg text-secondary">Sistema de Controle de Viagens da Prancha</div>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary">👤</div>
              <div className="text-sm">Admin</div>
              <label className="inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" checked={dark} onChange={() => setDark(!dark)} />
                <div className="w-11 h-6 bg-slate-300 peer-checked:bg-primary rounded-full after:content-[''] after:w-5 after:h-5 after:bg-white after:rounded-full after:translate-x-1 peer-checked:after:translate-x-5 after:transition"></div>
              </label>
            </div>
          </div>
        </header>
        <main className="p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

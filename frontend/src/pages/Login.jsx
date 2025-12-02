import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { login, registerUser } from "../services/storageService.js";

export default function Login() {
  const nav = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [create, setCreate] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [online, setOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);

  useEffect(() => {
    const onOffline = () => setOnline(false);
    const onOnline = () => setOnline(true);
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    return () => { window.removeEventListener("offline", onOffline); window.removeEventListener("online", onOnline); };
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setStatus("");
    setLoading(true);
    try {
      const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(username));
      if (!isEmail) { setError("Informe um e-mail válido"); return; }
      if (String(password || "").length < 6) { setError("Senha deve ter ao menos 6 caracteres"); return; }
      if (create) {
        if (!online) { setError("Sem conexão: criação de conta requer internet"); return; }
        const res = await registerUser(username, password);
        if (res && res.requiresEmailConfirmation) { setStatus("Confirme seu e-mail para ativar a conta."); return; }
        await login(username, password);
        nav("/dashboard");
      } else {
        await login(username, password);
        nav("/dashboard");
      }
    } catch (err) {
      setError(err?.message || (create ? "Erro ao criar conta" : "Credenciais inválidas"));
    } finally {
      setLoading(false);
    }
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

  return (
    <div className="min-h-screen gradient-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {!online && (
          <div className="mb-4 rounded-xl bg-yellow-500 text-white px-4 py-3 shadow-lg animate-fade">
            <div className="font-semibold">Modo offline</div>
            <div className="text-sm">Entrar usa dados locais; criar conta requer internet.</div>
          </div>
        )}
        <div className="card p-6 md:p-8 shadow-2xl animate-fade">
          <div className="text-center mb-6">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 text-primary flex items-center justify-center text-3xl">🚚</div>
            <h1 className="text-2xl font-bold text-secondary mt-4">Viagens da Prancha</h1>
            <div className="text-sm text-slate-500 dark:text-slate-300 mt-1">Acesse com seu e-mail e senha</div>
          </div>
          <form onSubmit={submit} onKeyDown={handleFormKeyDown} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">E-mail</label>
              <input
                className={`input transition focus:ring-2 ${username && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(username)) ? 'ring-red-500 border-red-500' : ''}`}
                placeholder="seu@email.com"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="email"
                inputMode="email"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Senha</label>
              <div className="relative">
                <input
                  type={showPwd ? "text" : "password"}
                  className={`input pr-12 transition focus:ring-2 ${password && password.length < 6 ? 'ring-red-500 border-red-500' : ''}`}
                  placeholder="••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
                <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700" onClick={() => setShowPwd(!showPwd)} title={showPwd ? "Ocultar" : "Mostrar"}>{showPwd ? "🙈" : "👁️"}</button>
              </div>
              <div className="text-xs text-slate-500">Mínimo de 6 caracteres</div>
            </div>
            {(error || status) && (
              <div className={`rounded-xl px-4 py-3 ${error ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{error || status}</div>
            )}
            <div className="flex gap-2">
              <button
                className={`btn btn-primary flex-1 ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
                disabled={loading}
              >
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="inline-block w-4 h-4 border-2 border-white/70 border-t-transparent rounded-full animate-spin" />
                    {create ? "Criando..." : "Entrando..."}
                  </span>
                ) : (
                  (create ? "Criar e entrar" : "Entrar")
                )}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setCreate(!create)}>{create ? "Já tenho conta" : "Criar conta"}</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

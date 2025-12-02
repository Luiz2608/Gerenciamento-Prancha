import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login, registerUser } from "../services/storageService.js";
import { supabase as sb } from "../services/supabaseClient.js";

export default function Login() {
  const nav = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [create, setCreate] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(username));
      if (!isEmail) { setError("Informe um e-mail válido"); return; }
      if (create) {
        await registerUser(username, password);
        await login(username, password);
        nav("/dashboard");
      } else {
        await login(username, password);
        nav("/dashboard");
      }
    } catch (err) {
      setError(err?.message || (create ? "Erro ao criar conta" : "Credenciais inválidas"));
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
    <div className="min-h-screen gradient-bg flex items-center justify-center">
      <div className="card p-8 w-full max-w-md shadow-2xl">
        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 text-primary flex items-center justify-center text-3xl">🚚</div>
          <h1 className="text-2xl font-bold text-secondary mt-4">Viagens da Prancha</h1>
        </div>
        <form onSubmit={submit} onKeyDown={handleFormKeyDown} className="space-y-4">
          <input className="input" placeholder="E-mail" value={username} onChange={(e) => setUsername(e.target.value)} />
          <input type="password" className="input" placeholder="Senha" value={password} onChange={(e) => setPassword(e.target.value)} />
          {error && <div className="text-red-600 text-sm">{error}</div>}
          <div className="flex gap-2">
            <button className="btn btn-primary flex-1">{create ? "Criar e entrar" : "Entrar"}</button>
            <button type="button" className="btn btn-secondary" onClick={() => setCreate(!create)}>{create ? "Já tenho conta" : "Criar conta"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api.js";

export default function Login() {
  const nav = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const r = await api.post("/auth/login", { username, password });
      localStorage.setItem("token", r.data.token);
      nav("/dashboard");
    } catch (err) {
      setError("Credenciais inválidas");
    }
  };

  return (
    <div className="min-h-screen gradient-bg flex items-center justify-center">
      <div className="card p-8 w-full max-w-md shadow-2xl">
        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 text-primary flex items-center justify-center text-3xl">🚚</div>
          <h1 className="text-2xl font-bold text-secondary mt-4">Sistema de Controle de Viagens</h1>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <input className="input" placeholder="Usuário" value={username} onChange={(e) => setUsername(e.target.value)} />
          <input type="password" className="input" placeholder="Senha" value={password} onChange={(e) => setPassword(e.target.value)} />
          {error && <div className="text-red-600 text-sm">{error}</div>}
          <button className="btn btn-primary w-full">Entrar</button>
        </form>
      </div>
    </div>
  );
}

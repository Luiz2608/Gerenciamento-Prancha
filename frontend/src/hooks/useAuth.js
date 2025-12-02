import { useState, useEffect } from "react";
import { supabase as sb } from "../services/supabaseClient.js";

export default function useAuth() {
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("user") || "null"); } catch { return null; }
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (token) localStorage.setItem("token", token);
    else localStorage.removeItem("token");
  }, [token]);

  useEffect(() => {
    if (user) localStorage.setItem("user", JSON.stringify(user));
    else localStorage.removeItem("user");
  }, [user]);

  useEffect(() => {
    const init = async () => {
      if (!sb) return;
      const { data } = await sb.auth.getSession();
      const session = data?.session || null;
      const userObj = session?.user || null;
      if (session) setToken(session.access_token || "supabase-token");
      if (userObj) setUser({ id: userObj.id, username: userObj.email, role: "user" });
    };
    init();
    if (!sb) return;
    const { data: sub } = sb.auth.onAuthStateChange((_event, session) => {
      const userObj = session?.user || null;
      setToken(session ? (session.access_token || "supabase-token") : null);
      setUser(userObj ? { id: userObj.id, username: userObj.email, role: "user" } : null);
    });
    return () => { sub?.subscription?.unsubscribe?.(); };
  }, []);

  const logout = async () => {
    try { if (sb) await sb.auth.signOut(); } catch {}
    setToken(null);
    setUser(null);
  };
  return { token, setToken, user, setUser, logout, loading, setLoading };
}

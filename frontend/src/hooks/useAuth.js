import { useState, useEffect } from "react";

export default function useAuth() {
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (token) localStorage.setItem("token", token);
    else localStorage.removeItem("token");
  }, [token]);

  const logout = () => setToken(null);
  return { token, setToken, logout, loading, setLoading };
}


import { createContext, useContext, useMemo, useState } from "react";

const ToastCtx = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const api = useMemo(() => ({
    show(msg, type = "info", ms = 3000) {
      const id = Math.random().toString(36).slice(2);
      setToasts((t) => [...t, { id, msg, type }]);
      setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), ms);
    }
  }), []);
  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div className="fixed bottom-4 right-4 space-y-2 z-50">
        {toasts.map((t) => (
          <div key={t.id} className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-white ${t.type === "success" ? "bg-green-600" : t.type === "error" ? "bg-red-600" : "bg-slate-800"} dark:bg-[#1e293b] dark:text-[#f1f5f9]`}> 
            <span className="material-icons">{t.type === "success" ? "check_circle" : t.type === "error" ? "error" : "info"}</span>
            <span>{t.msg}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() { return useContext(ToastCtx); }

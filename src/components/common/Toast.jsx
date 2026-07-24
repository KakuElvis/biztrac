import { createContext, useContext, useEffect, useState } from "react";
import { setToastHandler } from "../../lib/toast.js";

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    setToastHandler(({ message, type = "error", duration = 5000 }) => {
      const id = crypto.randomUUID();
      setToasts((t) => [...t, { id, message, type }]);
      setTimeout(() => {
        setToasts((t) => t.filter((x) => x.id !== id));
      }, duration);
    });
  }, []);

  return (
    <ToastContext.Provider value={{}}>
      {children}
      <div className="fixed right-4 top-4 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`max-w-xs rounded-lg px-4 py-2 text-sm font-semibold shadow-md ${{
              error: "bg-red-600 text-white",
              warn: "bg-yellow-500 text-black",
              success: "bg-green-600 text-white",
            }[t.type] || "bg-slate-800 text-white"}`}
          >
            {typeof t.message === "string" ? t.message : String(t.message?.message || JSON.stringify(t.message) || "")}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

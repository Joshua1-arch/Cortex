"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";

type ToastTone = "success" | "error" | "info";

type Toast = {
  id: number;
  message: string;
  tone: ToastTone;
};

type AlertState = {
  message: string;
  tone: ToastTone;
};

type ToastContextValue = {
  showToast: (message: string, tone?: ToastTone) => void;
  showAlert: (message: string, tone?: ToastTone) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const toneStyles: Record<ToastTone, string> = {
  success: "border-emerald-400/30 bg-[#0d1910] text-[#d9fbe3]",
  error: "border-rose-400/30 bg-[#190d10] text-[#ffe0e6]",
  info: "border-[#29442f] bg-[#0b120d] text-[#e6efe7]",
};

const toneIcons = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
} satisfies Record<ToastTone, typeof Info>;

type ToastProviderProps = {
  children: ReactNode;
};

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [alert, setAlert] = useState<AlertState | null>(null);

  const dismissToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback((message: string, tone: ToastTone = "info") => {
    const id = Date.now() + Math.floor(Math.random() * 1000);

    setToasts((current) => [...current, { id, message, tone }]);

    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 3600);
  }, []);

  const showAlert = useCallback((message: string, tone: ToastTone = "info") => {
    setAlert({ message, tone });
  }, []);

  const dismissAlert = useCallback(() => {
    setAlert(null);
  }, []);

  const contextValue = useMemo(
    () => ({
      showToast,
      showAlert,
    }),
    [showAlert, showToast],
  );

  return (
    <ToastContext.Provider value={contextValue}>
      {children}

      {alert ? (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="cortex-alert-title"
            aria-describedby="cortex-alert-description"
            className={`w-full max-w-md rounded-[28px] border px-6 py-6 shadow-[0_30px_80px_rgba(0,0,0,0.55)] ${toneStyles[alert.tone]}`}
          >
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/55" id="cortex-alert-title">
              Admin notice
            </div>
            <p className="mt-3 text-base leading-7" id="cortex-alert-description">
              {alert.message}
            </p>
            <button
              type="button"
              onClick={dismissAlert}
              className="mt-6 inline-flex w-full items-center justify-center rounded-2xl border border-[#24432b] bg-[linear-gradient(90deg,#61f58f_0%,#d9f06c_100%)] px-5 py-3.5 text-sm font-semibold text-[#071108] transition hover:brightness-105"
            >
              OK
            </button>
          </div>
        </div>
      ) : null}

      <div className="pointer-events-none fixed right-4 top-4 z-[120] flex w-[min(100%-2rem,380px)] flex-col gap-3 sm:right-6 sm:top-6">
        {toasts.map((toast) => {
          const Icon = toneIcons[toast.tone];

          return (
            <div
              key={toast.id}
              className={`pointer-events-auto overflow-hidden rounded-[22px] border px-4 py-4 shadow-[0_18px_50px_rgba(0,0,0,0.45)] backdrop-blur-xl ${toneStyles[toast.tone]}`}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded-full border border-white/10 bg-white/5 p-2">
                  <Icon className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] uppercase tracking-[0.24em] text-white/55">Cortex notice</div>
                  <p className="mt-1 text-sm leading-6">{toast.message}</p>
                </div>
                <button
                  type="button"
                  onClick={() => dismissToast(toast.id)}
                  className="inline-flex size-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/70 transition hover:bg-white/10 hover:text-white"
                  aria-label="Dismiss notification"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error("useToast must be used within ToastProvider.");
  }

  return context;
}

import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import { cn } from "@/lib/utils";

export type ToastType = "default" | "success" | "error" | "info" | "warning";

export interface ToastItem {
  id: string;
  title?: string | undefined;
  description?: string | undefined;
  type?: ToastType | undefined;
  duration?: number | undefined;
}

interface ToastContextValue {
  toasts: ToastItem[];
  addToast: (toast: Omit<ToastItem, "id">) => string;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let toastCount = 0;
const listeners: Array<(toast: Omit<ToastItem, "id">) => void> = [];

export function toast(options: Omit<ToastItem, "id">) {
  listeners.forEach((listener) => listener(options));
}

toast.success = (title: string, description?: string) => {
  toast({ title, ...(description !== undefined ? { description } : {}), type: "success" });
};

toast.error = (title: string, description?: string) => {
  toast({ title, ...(description !== undefined ? { description } : {}), type: "error" });
};

toast.info = (title: string, description?: string) => {
  toast({ title, ...(description !== undefined ? { description } : {}), type: "info" });
};

toast.warning = (title: string, description?: string) => {
  toast({ title, ...(description !== undefined ? { description } : {}), type: "warning" });
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((toastData: Omit<ToastItem, "id">) => {
    const id = `toast-${++toastCount}-${Date.now()}`;
    const newToast: ToastItem = { ...toastData, id };
    setToasts((prev) => [...prev, newToast]);
    return id;
  }, []);

  useEffect(() => {
    const handler = (toastData: Omit<ToastItem, "id">) => {
      addToast(toastData);
    };
    listeners.push(handler);
    return () => {
      const idx = listeners.indexOf(handler);
      if (idx !== -1) listeners.splice(idx, 1);
    };
  }, [addToast]);

  return (
    <ToastContext.Provider value={{ toasts, addToast, dismissToast }}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    return {
      toasts: [],
      addToast: toast,
      dismissToast: () => {},
    };
  }
  return context;
}

function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}) {
  return (
    <div
      aria-label="Notifications"
      className="fixed bottom-4 right-4 z-50 flex max-w-sm flex-col gap-2 pointer-events-none"
    >
      {toasts.map((item) => (
        <ToastCard key={item.id} item={item} onDismiss={() => onDismiss(item.id)} />
      ))}
    </div>
  );
}

function ToastCard({
  item,
  onDismiss,
}: {
  item: ToastItem;
  onDismiss: () => void;
}) {
  const duration = item.duration ?? 4000;

  useEffect(() => {
    if (duration <= 0) return;
    const timer = setTimeout(onDismiss, duration);
    return () => clearTimeout(timer);
  }, [duration, onDismiss]);

  const type = item.type ?? "default";

  return (
    <div
      role="status"
      data-slot="toast"
      className={cn(
        "pointer-events-auto flex items-start gap-3 rounded-xl border p-3.5 shadow-2xl backdrop-blur-2xl transition-all animate-in fade-in-0 slide-in-from-bottom-3 duration-200",
        type === "default" && "border-white/[0.08] bg-[#0c1322]/95 text-foreground",
        type === "success" &&
          "border-emerald-500/30 bg-[#071913]/95 text-emerald-100 shadow-[0_0_30px_rgba(16,185,129,0.15)]",
        type === "error" &&
          "border-rose-500/30 bg-[#1c0a0f]/95 text-rose-100 shadow-[0_0_30px_rgba(244,63,94,0.15)]",
        type === "info" &&
          "border-cyan-500/30 bg-[#061521]/95 text-cyan-100 shadow-[0_0_30px_rgba(6,182,212,0.15)]",
        type === "warning" &&
          "border-amber-500/30 bg-[#1e1506]/95 text-amber-100 shadow-[0_0_30px_rgba(245,158,11,0.15)]",
      )}
    >
      <div className="mt-0.5 shrink-0">
        {type === "success" && <CheckCircle2 className="size-4 text-emerald-400" />}
        {type === "error" && <AlertCircle className="size-4 text-rose-400" />}
        {type === "info" && <Info className="size-4 text-cyan-400" />}
        {type === "warning" && <AlertCircle className="size-4 text-amber-400" />}
      </div>

      <div className="flex-1 space-y-0.5 text-left">
        {item.title && (
          <div data-slot="toast-title" className="text-xs font-semibold">
            {item.title}
          </div>
        )}
        {item.description && (
          <div data-slot="toast-description" className="text-xs opacity-80 leading-relaxed">
            {item.description}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 rounded-md p-1 text-muted-foreground opacity-70 transition hover:bg-white/[0.08] hover:text-foreground hover:opacity-100"
      >
        <X className="size-3.5" />
        <span className="sr-only">Dismiss</span>
      </button>
    </div>
  );
}

export { ToastViewport as Toaster };

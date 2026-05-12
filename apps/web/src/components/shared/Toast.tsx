import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  X,
  XCircle,
  type LucideIcon,
} from "lucide-react";

export type ToastVariant = "success" | "error" | "warning" | "info";

export interface ToastOptions {
  variant?: ToastVariant;
  title: string;
  description?: string;
}

interface ToastItem extends Required<Pick<ToastOptions, "title" | "variant">> {
  id: string;
  description?: string;
}

interface ToastContextValue {
  toast: (opts: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

interface VariantStyle {
  icon: LucideIcon;
  iconWrap: string;
}

const VARIANT_STYLES: Record<ToastVariant, VariantStyle> = {
  success: {
    icon: CheckCircle2,
    iconWrap: "bg-emerald-50 text-emerald-600",
  },
  error: {
    icon: XCircle,
    iconWrap: "bg-red-50 text-red-600",
  },
  warning: {
    icon: AlertTriangle,
    iconWrap: "bg-amber-50 text-amber-600",
  },
  info: {
    icon: Info,
    iconWrap: "bg-navy-50 text-navy-600",
  },
};

interface ToastCardProps {
  item: ToastItem;
  onDismiss: (id: string) => void;
}

function ToastCard({ item, onDismiss }: ToastCardProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(item.id);
    }, 4000);
    return () => clearTimeout(timer);
  }, [item.id, onDismiss]);

  const style = VARIANT_STYLES[item.variant];
  const Icon = style.icon;

  return (
    <motion.div
      layout
      initial={{ x: 320, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 320, opacity: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 22 }}
      className="card p-3 pr-10 min-w-[280px] max-w-sm flex gap-3 items-start relative pointer-events-auto"
    >
      <div
        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${style.iconWrap}`}
      >
        <Icon size={18} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm text-navy-900">{item.title}</div>
        {item.description ? (
          <div className="text-xs text-navy-600 mt-0.5">{item.description}</div>
        ) : null}
      </div>
      <button
        type="button"
        onClick={() => onDismiss(item.id)}
        aria-label="Bildirimi kapat"
        className="absolute top-2 right-2 p-1 text-navy-400 hover:text-navy-700 rounded"
      >
        <X size={14} />
      </button>
    </motion.div>
  );
}

interface ToastProviderProps {
  children: ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((opts: ToastOptions) => {
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2);
    const item: ToastItem = {
      id,
      title: opts.title,
      description: opts.description,
      variant: opts.variant ?? "info",
    };
    setToasts((prev) => [...prev, item]);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed top-4 right-4 z-50 space-y-2 pointer-events-none">
        <AnimatePresence initial={false}>
          {toasts.map((item) => (
            <ToastCard key={item.id} item={item} onDismiss={dismiss} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (ctx === null) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return ctx;
}

import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { createContext, useCallback, useContext, useEffect, useState, } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Info, X, XCircle, } from "lucide-react";
const ToastContext = createContext(null);
const VARIANT_STYLES = {
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
function ToastCard({ item, onDismiss }) {
    useEffect(() => {
        const timer = setTimeout(() => {
            onDismiss(item.id);
        }, 4000);
        return () => clearTimeout(timer);
    }, [item.id, onDismiss]);
    const style = VARIANT_STYLES[item.variant];
    const Icon = style.icon;
    return (_jsxs(motion.div, { layout: true, initial: { x: 320, opacity: 0 }, animate: { x: 0, opacity: 1 }, exit: { x: 320, opacity: 0 }, transition: { type: "spring", stiffness: 260, damping: 22 }, className: "card p-3 pr-10 min-w-[280px] max-w-sm flex gap-3 items-start relative pointer-events-auto", children: [_jsx("div", { className: `w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${style.iconWrap}`, children: _jsx(Icon, { size: 18 }) }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("div", { className: "font-medium text-sm text-navy-900", children: item.title }), item.description ? (_jsx("div", { className: "text-xs text-navy-600 mt-0.5", children: item.description })) : null] }), _jsx("button", { type: "button", onClick: () => onDismiss(item.id), "aria-label": "Bildirimi kapat", className: "absolute top-2 right-2 p-1 text-navy-400 hover:text-navy-700 rounded", children: _jsx(X, { size: 14 }) })] }));
}
export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);
    const dismiss = useCallback((id) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);
    const toast = useCallback((opts) => {
        const id = typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : Math.random().toString(36).slice(2);
        const item = {
            id,
            title: opts.title,
            description: opts.description,
            variant: opts.variant ?? "info",
        };
        setToasts((prev) => [...prev, item]);
    }, []);
    return (_jsxs(ToastContext.Provider, { value: { toast }, children: [children, _jsx("div", { className: "fixed top-4 right-4 z-50 space-y-2 pointer-events-none", children: _jsx(AnimatePresence, { initial: false, children: toasts.map((item) => (_jsx(ToastCard, { item: item, onDismiss: dismiss }, item.id))) }) })] }));
}
export function useToast() {
    const ctx = useContext(ToastContext);
    if (ctx === null) {
        throw new Error("useToast must be used within a ToastProvider");
    }
    return ctx;
}

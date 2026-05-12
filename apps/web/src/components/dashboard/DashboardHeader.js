import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, FileDown } from "lucide-react";
export function DashboardHeader({ businessName, periodLabel, onExportPdf, }) {
    const [open, setOpen] = useState(false);
    const handleConfirm = () => {
        onExportPdf?.();
        setOpen(false);
    };
    useEffect(() => {
        if (!open)
            return;
        const onKey = (e) => {
            if (e.key === "Escape")
                setOpen(false);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open]);
    return (_jsxs("header", { className: "flex items-start justify-between gap-4 mb-6", children: [_jsxs("div", { className: "space-y-1", children: [_jsx("h1", { className: "font-display font-extrabold text-2xl md:text-3xl text-navy-900", children: businessName ?? "Analiz Sonuçları" }), periodLabel && _jsx("p", { className: "text-sm text-navy-500", children: periodLabel })] }), _jsxs("button", { type: "button", onClick: () => setOpen(true), disabled: !onExportPdf, className: "btn-primary flex-shrink-0", children: [_jsx(Download, { className: "w-4 h-4" }), "PDF \u0130ndir"] }), _jsx(AnimatePresence, { children: open && (_jsx(motion.div, { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.15 }, className: "fixed inset-0 z-50 bg-navy-950/40 backdrop-blur-sm flex items-center justify-center p-4", onClick: () => setOpen(false), role: "dialog", "aria-modal": "true", "aria-labelledby": "pdf-confirm-title", children: _jsxs(motion.div, { initial: { opacity: 0, y: 12, scale: 0.96 }, animate: { opacity: 1, y: 0, scale: 1 }, exit: { opacity: 0, y: 12, scale: 0.96 }, transition: { duration: 0.18 }, className: "card p-6 max-w-md w-full space-y-4", onClick: (e) => e.stopPropagation(), children: [_jsxs("div", { className: "flex items-start gap-3", children: [_jsx("div", { className: "w-10 h-10 rounded-lg bg-navy-50 flex items-center justify-center text-navy-600 flex-shrink-0", children: _jsx(FileDown, { className: "w-5 h-5" }) }), _jsxs("div", { children: [_jsx("h2", { id: "pdf-confirm-title", className: "font-display font-bold text-navy-900", children: "PDF \u0130ndirilsin mi?" }), _jsx("p", { className: "text-sm text-navy-600 mt-1", children: "Analiz raporu y\u00FCksek kaliteli bir PDF olarak haz\u0131rlanacak." })] })] }), _jsxs("div", { className: "flex items-center justify-end gap-2", children: [_jsx("button", { type: "button", onClick: () => setOpen(false), className: "btn-secondary", children: "\u0130ptal" }), _jsxs("button", { type: "button", onClick: handleConfirm, className: "btn-primary", children: [_jsx(Download, { className: "w-4 h-4" }), "\u0130ndir"] })] })] }) }, "backdrop")) })] }));
}

import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { motion, AnimatePresence } from "framer-motion";
import { UploadCloud, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { uploadInvoice } from "../../api/client";
import { cn } from "../../lib/utils";
const STATE_BORDER = {
    idle: "border-border bg-surface hover:bg-navy-50/30",
    dragging: "border-navy-500 bg-navy-50",
    uploading: "border-navy-300 bg-surface",
    success: "border-emerald-500 bg-emerald-50/50",
    error: "border-red-400 bg-red-50/50",
};
const variantTransition = { duration: 0.18 };
const variantProps = {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -8 },
    transition: variantTransition,
};
export default function UploadZone({ onUploadSuccess }) {
    const [state, setState] = useState({ kind: "idle" });
    const onDrop = useCallback(async (accepted, rejected) => {
        if (rejected.length > 0) {
            setState({ kind: "error", message: "Sadece 10 MB altı PDF dosyaları yükleyebilirsiniz." });
            return;
        }
        const f = accepted[0];
        if (!f)
            return;
        setState({ kind: "uploading", name: f.name });
        try {
            const r = await uploadInvoice(f);
            setState({ kind: "success", name: f.name });
            onUploadSuccess(r.invoice_id, r.data);
        }
        catch (e) {
            setState({ kind: "error", message: e instanceof Error ? e.message : "Yükleme hatası" });
        }
    }, [onUploadSuccess]);
    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: { "application/pdf": [".pdf"] },
        maxSize: 10 * 1024 * 1024,
        multiple: false,
    });
    const visualKind = isDragActive && state.kind === "idle" ? "dragging" : state.kind;
    return (_jsxs("div", { className: "w-full", children: [_jsxs("div", { ...getRootProps(), className: cn("relative p-12 rounded-2xl border-2 border-dashed cursor-pointer transition-colors duration-200", STATE_BORDER[visualKind]), children: [_jsx("input", { ...getInputProps(), "aria-label": "PDF y\u00FCkle" }), _jsx("div", { className: "flex flex-col items-center gap-3 text-center min-h-[180px] justify-center", children: _jsxs(AnimatePresence, { mode: "wait", children: [visualKind === "idle" && (_jsxs(motion.div, { ...variantProps, className: "flex flex-col items-center gap-3", children: [_jsx(UploadCloud, { className: "w-12 h-12 text-navy-400" }), _jsx("p", { className: "font-medium text-navy-900", children: "PDF faturalar\u0131n\u0131z\u0131 buraya b\u0131rak\u0131n" }), _jsxs("p", { className: "text-sm text-navy-600", children: ["veya", " ", _jsx("span", { className: "text-navy-700 font-medium underline-offset-2 hover:underline", children: "dosya se\u00E7in" })] })] }, "idle")), visualKind === "dragging" && (_jsxs(motion.div, { ...variantProps, className: "flex flex-col items-center gap-3", children: [_jsx(motion.div, { animate: { scale: 1.12 }, transition: { type: "spring", stiffness: 240, damping: 14 }, children: _jsx(UploadCloud, { className: "w-12 h-12 text-navy-500" }) }), _jsx("p", { className: "font-medium text-navy-900", children: "B\u0131rak\u0131n, ekleyelim." }), _jsxs("p", { className: "text-sm text-navy-600", children: ["veya", " ", _jsx("span", { className: "text-navy-700 font-medium underline-offset-2 hover:underline", children: "dosya se\u00E7in" })] })] }, "dragging")), visualKind === "uploading" && state.kind === "uploading" && (_jsxs(motion.div, { ...variantProps, className: "flex flex-col items-center gap-3 pointer-events-none", children: [_jsx(Loader2, { className: "w-12 h-12 text-navy-500 animate-spin" }), _jsx("p", { className: "font-medium text-navy-900", children: "Y\u00FCkleniyor\u2026" }), _jsx("p", { className: "text-sm text-navy-600 max-w-full truncate", children: state.name }), _jsx("div", { className: "w-48 h-1.5 bg-navy-100 rounded-full overflow-hidden", children: _jsx(motion.div, { className: "h-full bg-navy-500", initial: { width: "0%" }, animate: { width: "85%" }, transition: { duration: 1.8, ease: "easeInOut" } }) })] }, "uploading")), visualKind === "success" && state.kind === "success" && (_jsxs(motion.div, { ...variantProps, className: "flex flex-col items-center gap-3", children: [_jsx(motion.div, { initial: { scale: 0.5, opacity: 0 }, animate: { scale: 1, opacity: 1 }, transition: { type: "spring", stiffness: 260, damping: 16 }, children: _jsx(CheckCircle2, { className: "w-12 h-12 text-emerald-500" }) }), _jsx("p", { className: "font-medium text-emerald-700", children: "Y\u00FCkleme tamamland\u0131" }), _jsx("p", { className: "text-sm text-navy-600 truncate", children: state.name })] }, "success")), visualKind === "error" && state.kind === "error" && (_jsxs(motion.div, { ...variantProps, className: "flex flex-col items-center gap-3", children: [_jsx(AlertCircle, { className: "w-12 h-12 text-red-500" }), _jsx("p", { className: "font-medium text-red-700", children: "Y\u00FCkleme ba\u015Far\u0131s\u0131z" }), _jsx("p", { className: "text-sm text-navy-600 max-w-md", children: state.message })] }, "error"))] }) })] }), _jsx("p", { className: "text-2xs text-navy-400 mt-3 text-center", children: "PDF, maks. 10MB" })] }));
}

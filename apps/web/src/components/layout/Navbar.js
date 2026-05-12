import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { motion } from "framer-motion";
import { Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
export function Navbar({ showNewAnalysis = false }) {
    const navigate = useNavigate();
    return (_jsx(motion.header, { initial: { y: -20, opacity: 0 }, animate: { y: 0, opacity: 1 }, transition: { duration: 0.3, ease: "easeOut" }, className: "sticky top-0 z-40 h-16 bg-surface/80 backdrop-blur-sm border-b border-border", children: _jsxs("div", { className: "max-w-7xl mx-auto h-full px-6 flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsxs("svg", { viewBox: "0 0 32 32", className: "w-8 h-8", "aria-hidden": "true", children: [_jsx("circle", { cx: "16", cy: "16", r: "16", fill: "#1F3D72" }), _jsx("text", { x: "16", y: "21", textAnchor: "middle", fontSize: "13", fontWeight: "700", fill: "white", fontFamily: "Plus Jakarta Sans, Inter, sans-serif", children: "KA" })] }), _jsx("span", { className: "font-display font-bold text-navy-900", children: "KOB\u0130 Advisor" }), _jsx("span", { className: "badge bg-emerald-50 text-emerald-700", children: "AI CFO" })] }), _jsxs("div", { className: "flex items-center gap-3", children: [_jsx("span", { className: "badge bg-navy-50 text-navy-600 hidden sm:inline-flex", children: "BTK Hackathon '26" }), showNewAnalysis && (_jsxs("button", { type: "button", className: "btn-primary", onClick: () => navigate("/"), children: [_jsx(Plus, { className: "w-4 h-4" }), "Yeni Analiz"] }))] })] }) }));
}

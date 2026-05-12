import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { motion } from "framer-motion";
import { cn } from "../../lib/utils";
const DOT_COLOR = {
    red: "bg-red-500",
    yellow: "bg-amber-400",
    green: "bg-emerald-500",
};
export default function RiskIndicator({ risk_label, risk_score, explanation, }) {
    const percent = Math.max(0, Math.min(100, (risk_score / 5) * 100));
    const color = percent < 34 ? "#EF4444" : percent < 67 ? "#F59E0B" : "#10C896";
    const labelText = percent < 34 ? "Yüksek Risk" : percent < 67 ? "Orta Risk" : "Düşük Risk";
    return (_jsxs("div", { className: "card p-6 flex flex-col gap-4 relative", children: [_jsx("h3", { className: "font-display font-semibold text-lg text-navy-900", children: "Risk De\u011Ferlendirmesi" }), _jsxs("div", { className: "flex flex-col items-center", children: [_jsxs("svg", { viewBox: "0 0 100 60", className: "w-48 h-28", children: [_jsx("path", { d: "M 10 50 A 40 40 0 0 1 90 50", fill: "none", stroke: "#E2E7F0", strokeWidth: 8, strokeLinecap: "round" }), _jsx(motion.path, { d: "M 10 50 A 40 40 0 0 1 90 50", fill: "none", stroke: color, strokeWidth: 8, strokeLinecap: "round", initial: { pathLength: 0 }, animate: { pathLength: percent / 100 }, transition: { duration: 1.2, ease: "easeOut" } }), _jsx("text", { x: 50, y: 45, textAnchor: "middle", fontFamily: "Plus Jakarta Sans, Inter, sans-serif", fontWeight: 800, fontSize: 18, fill: color, children: Math.round(percent) })] }), _jsx("div", { className: "mt-1 text-sm font-semibold", style: { color }, children: labelText })] }), _jsx("p", { className: "text-sm italic text-navy-700", children: explanation }), _jsxs("div", { className: "flex items-center justify-between mt-2", children: [_jsx("div", { className: "flex gap-1.5", children: ["red", "yellow", "green"].map((c) => (_jsx("div", { "data-testid": `light-${c}`, className: cn("h-3 w-3 rounded-full", DOT_COLOR[c], c === risk_label ? "opacity-100" : "opacity-25") }, c))) }), _jsx("span", { className: "badge bg-navy-50 text-navy-600", children: "GVK Md. 103" })] })] }));
}

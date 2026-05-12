import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, TrendingUp, Receipt, FileText, Activity, ChevronDown, } from "lucide-react";
import { Skeleton } from "../shared/Skeleton";
import { cn } from "../../lib/utils";
const AGENT_STYLES = {
    rag_agent: { bg: "bg-navy-500", badge: "bg-navy-50 text-navy-700", icon: Search },
    cashflow_agent: { bg: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-700", icon: TrendingUp },
    tax_optimization_agent: { bg: "bg-amber-500", badge: "bg-amber-50 text-amber-700", icon: Receipt },
    report_agent: { bg: "bg-red-400", badge: "bg-red-50 text-red-700", icon: FileText },
};
function stylesFor(name) {
    return AGENT_STYLES[name] ?? { bg: "bg-navy-300", badge: "bg-navy-50 text-navy-700", icon: Activity };
}
function ConfidenceDots({ value }) {
    const filled = Math.max(0, Math.min(5, Math.round(value)));
    return (_jsx("span", { className: "inline-flex gap-0.5", children: Array.from({ length: 5 }).map((_, i) => (_jsx("span", { className: cn("w-1.5 h-1.5 rounded-full", i < filled ? "bg-emerald-500" : "bg-navy-100") }, i))) }));
}
export default function AgentTrace({ trace, isLoading = false, }) {
    const [openIndex, setOpenIndex] = useState(null);
    const toggle = (i) => setOpenIndex((prev) => (prev === i ? null : i));
    return (_jsxs("div", { className: "card p-6", children: [_jsx("h3", { className: "font-display font-semibold text-lg text-navy-900 mb-4", children: "Ajan Ak\u0131\u015F\u0131" }), isLoading ? (_jsx("ul", { className: "space-y-3", children: Array.from({ length: 3 }).map((_, i) => (_jsxs("li", { className: "flex items-start gap-3", children: [_jsx(Skeleton, { className: "w-6 h-6 rounded-full" }), _jsxs("div", { className: "flex-1 space-y-2 pt-1", children: [_jsx(Skeleton, { className: "h-4 w-24" }), _jsx(Skeleton, { className: "h-3 w-40" })] })] }, i))) })) : (_jsxs("ol", { className: "relative space-y-3", children: [_jsx("div", { className: "absolute left-3 top-2 bottom-2 w-px bg-border", "aria-hidden": "true" }), trace.map((step, index) => {
                        const styles = stylesFor(step.agent_name);
                        const Icon = styles.icon;
                        return (_jsxs(motion.li, { className: "relative pl-10", initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.25, delay: index * 0.12 }, children: [_jsx("span", { className: cn("absolute left-0 top-0.5 w-6 h-6 rounded-full flex items-center justify-center text-white", styles.bg), children: _jsx(Icon, { className: "w-3.5 h-3.5" }) }), _jsxs("button", { type: "button", onClick: () => toggle(index), className: "w-full flex items-start justify-between gap-3 text-left rounded-lg px-2 py-1 hover:bg-navy-50/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-500", children: [_jsx("div", { className: "min-w-0 flex-1", children: _jsxs("div", { className: "flex items-center gap-2 flex-wrap", children: [_jsx("span", { className: cn("badge", styles.badge), children: step.agent_name }), _jsx("span", { className: "font-medium text-navy-900 text-sm", children: step.action })] }) }), _jsxs("div", { className: "flex items-center gap-2 text-xs text-navy-500 whitespace-nowrap", children: [_jsxs("span", { children: [step.duration_ms, " ms"] }), _jsx(ConfidenceDots, { value: step.confidence }), _jsx(ChevronDown, { className: cn("w-4 h-4 transition-transform", openIndex === index && "rotate-180") })] })] }), _jsx(AnimatePresence, { initial: false, children: openIndex === index && (_jsx(motion.div, { initial: { height: 0, opacity: 0 }, animate: { height: "auto", opacity: 1 }, exit: { height: 0, opacity: 0 }, transition: { duration: 0.2 }, className: "overflow-hidden", children: _jsx("pre", { className: "font-mono text-xs bg-navy-50 text-navy-800 p-3 rounded-lg overflow-x-auto mt-2 mx-2", children: JSON.stringify(step.output, null, 2) }) }, "details")) })] }, index));
                    })] }))] }));
}

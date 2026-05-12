import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lightbulb, ChevronDown, Wand2 } from "lucide-react";
import { cn } from "../../lib/utils";
const CONF_STYLES = {
    high: { borderL: "border-emerald-500", dot: "bg-emerald-500" },
    mid: { borderL: "border-amber-500", dot: "bg-amber-500" },
    low: { borderL: "border-red-400", dot: "bg-red-400" },
};
function getConfStyles(confidence) {
    if (confidence >= 0.8)
        return CONF_STYLES.high;
    if (confidence >= 0.5)
        return CONF_STYLES.mid;
    return CONF_STYLES.low;
}
function buildShortTitle(recommendation) {
    const firstSentence = recommendation.split(/[.!?]/)[0] ?? recommendation;
    const base = firstSentence.length > 0 ? firstSentence : recommendation;
    const truncated = base.length > 90;
    return truncated ? `${base.slice(0, 90)}…` : base;
}
export function TaxRecommendations({ recommendations }) {
    const [openIndex, setOpenIndex] = useState(null);
    const toggle = (i) => setOpenIndex((prev) => (prev === i ? null : i));
    return (_jsxs("div", { className: "card p-6 space-y-4", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: "w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600", children: _jsx(Lightbulb, { className: "w-4 h-4" }) }), _jsx("h3", { className: "font-display font-semibold text-lg text-navy-900", children: "Vergi \u00D6nerileri" })] }), recommendations.length === 0 ? (_jsx("p", { className: "text-sm text-navy-500 italic", children: "Bu d\u00F6nem i\u00E7in ek vergi optimizasyon \u00F6nerisi bulunamad\u0131." })) : (_jsx("ul", { className: "space-y-2", children: recommendations.map((rec, index) => {
                    const confStyles = getConfStyles(rec.confidence);
                    const shortTitle = buildShortTitle(rec.recommendation);
                    const isOpen = openIndex === index;
                    return (_jsx("li", { children: _jsxs("div", { className: cn("rounded-lg border border-l-4 border-border bg-surface", confStyles.borderL), children: [_jsxs("button", { type: "button", onClick: () => toggle(index), className: "w-full flex items-center gap-3 p-4 text-left rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-500", children: [_jsx("span", { className: cn("w-2 h-2 rounded-full flex-shrink-0", confStyles.dot) }), _jsx("span", { className: "flex-1 min-w-0 text-sm font-medium text-navy-900", children: shortTitle }), _jsx(ChevronDown, { className: cn("w-4 h-4 text-navy-400 transition-transform flex-shrink-0", isOpen && "rotate-180") })] }), _jsx(AnimatePresence, { initial: false, children: isOpen && (_jsx(motion.div, { initial: { height: 0, opacity: 0 }, animate: { height: "auto", opacity: 1 }, exit: { height: 0, opacity: 0 }, transition: { duration: 0.2 }, className: "overflow-hidden", children: _jsxs("div", { className: "px-4 pb-4 space-y-3 text-sm text-navy-700", children: [_jsx("p", { className: "leading-relaxed", children: rec.recommendation }), _jsxs("div", { className: "flex items-center gap-2 flex-wrap", children: [_jsxs("span", { className: "badge bg-navy-50 text-navy-700", children: [rec.source, " Md. ", rec.article] }), _jsxs("span", { className: "badge bg-navy-50 text-navy-600", children: ["G\u00FCven: %", Math.round(rec.confidence * 100)] })] }), rec.action && (_jsxs("button", { className: "btn-secondary text-xs", children: [_jsx(Wand2, { className: "w-3.5 h-3.5" }), rec.action] }))] }) }, "d")) })] }) }, index));
                }) }))] }));
}

import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Wallet, Receipt } from "lucide-react";
import { useCountUp } from "../../hooks/useCountUp";
import { formatTRY, cn } from "../../lib/utils";
const ACCENT_CLASSES = {
    emerald: { iconBg: "bg-emerald-50", iconText: "text-emerald-600" },
    red: { iconBg: "bg-red-50", iconText: "text-red-600" },
    navy: { iconBg: "bg-navy-50", iconText: "text-navy-600" },
    amber: { iconBg: "bg-amber-50", iconText: "text-amber-600" },
};
function KPICard({ title, value, icon: Icon, accent, index, }) {
    const animatedValue = useCountUp(value);
    const styles = ACCENT_CLASSES[accent];
    return (_jsxs(motion.div, { className: "card p-5 hover:shadow-card-hover transition-shadow", initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.3, delay: index * 0.1 }, children: [_jsxs("div", { className: "flex items-center justify-between mb-3", children: [_jsx("span", { className: "text-xs font-semibold text-navy-500 uppercase tracking-wider", children: title }), _jsx("div", { className: cn("w-8 h-8 rounded-lg flex items-center justify-center", styles.iconBg), children: _jsx(Icon, { className: cn("w-4 h-4", styles.iconText) }) })] }), _jsx("div", { className: "text-2xl font-display font-bold text-navy-900", children: formatTRY(animatedValue) })] }));
}
export default function KPICards({ income, expense, net, taxBurden }) {
    return (_jsxs("div", { className: "grid grid-cols-2 lg:grid-cols-4 gap-4", children: [_jsx(KPICard, { index: 0, title: "Toplam Gelir", value: income, icon: TrendingUp, accent: "emerald" }), _jsx(KPICard, { index: 1, title: "Toplam Gider", value: expense, icon: TrendingDown, accent: "red" }), _jsx(KPICard, { index: 2, title: "Net Nakit Ak\u0131\u015F\u0131", value: net, icon: Wallet, accent: "navy" }), _jsx(KPICard, { index: 3, title: "Tahmini Vergi Y\u00FCk\u00FC", value: taxBurden, icon: Receipt, accent: "amber" })] }));
}

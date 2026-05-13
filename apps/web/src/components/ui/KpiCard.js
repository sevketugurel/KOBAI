import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { ArrowDown, ArrowUp } from "lucide-react";
import { cn } from "../../lib/utils";
export function KpiCard({ label, value, trend, icon, loading = false, className, }) {
    const positive = trend ? trend.value >= 0 : false;
    return (_jsxs("div", { className: cn("bg-surface rounded-xl border border-border shadow-card hover:shadow-card-hover transition-shadow p-5", className), children: [_jsxs("div", { className: "flex items-start justify-between", children: [_jsx("p", { className: "text-xs uppercase tracking-wide text-navy-500 font-medium", children: label }), icon ? _jsx("div", { className: "text-navy-400", children: icon }) : null] }), loading ? (_jsx("div", { className: "skeleton h-8 w-24 mt-3" })) : (_jsx("p", { className: "text-2xl font-mono font-semibold text-navy-900 tabular-nums mt-2", children: value })), trend && !loading ? (_jsxs("div", { className: cn("mt-2 inline-flex items-center gap-1 text-xs font-medium", positive ? "text-emerald-600" : "text-red-600"), children: [positive ? _jsx(ArrowUp, { size: 12 }) : _jsx(ArrowDown, { size: 12 }), _jsxs("span", { className: "font-mono tabular-nums", children: [positive ? "+" : "", trend.value, "%"] }), _jsx("span", { className: "text-navy-500 font-normal", children: trend.label })] })) : null] }));
}
export default KpiCard;

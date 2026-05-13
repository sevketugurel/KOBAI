import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { cn } from "../../lib/utils";
const VARIANT_CLASSES = {
    success: "bg-emerald-100 text-emerald-700",
    warning: "bg-amber-100 text-amber-700",
    danger: "bg-red-100 text-red-700",
    neutral: "bg-navy-100 text-navy-600",
    info: "bg-navy-50 text-navy-600",
};
export function StatusBadge({ variant, label, dot, className }) {
    return (_jsxs("span", { className: cn("inline-flex items-center gap-1 px-2 py-0.5 text-2xs font-semibold rounded-full", VARIANT_CLASSES[variant], className), children: [dot ? (_jsx("span", { className: "w-1.5 h-1.5 rounded-full bg-current animate-pulse-dot", "aria-hidden": "true" })) : null, label] }));
}
export default StatusBadge;

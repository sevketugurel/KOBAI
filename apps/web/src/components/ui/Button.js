import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { cn } from "../../lib/utils";
const VARIANT_CLASSES = {
    primary: "bg-navy-600 text-white hover:bg-navy-700 active:bg-navy-800 disabled:opacity-50 disabled:cursor-not-allowed",
    secondary: "bg-surface text-navy-700 border border-border hover:bg-navy-50 active:bg-navy-100 disabled:opacity-50 disabled:cursor-not-allowed",
    ghost: "text-navy-600 hover:bg-navy-50 active:bg-navy-100 disabled:opacity-50 disabled:cursor-not-allowed",
    danger: "bg-red-600 text-white hover:bg-red-700 active:bg-red-800 disabled:opacity-50 disabled:cursor-not-allowed",
};
const SIZE_CLASSES = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2.5 text-sm",
    lg: "px-5 py-3 text-base",
};
const BASE = "inline-flex items-center justify-center gap-2 font-medium rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-500 focus-visible:ring-offset-2 transition-all duration-200";
export function Button({ variant = "primary", size = "md", loading = false, disabled, className, children, type = "button", ...rest }) {
    return (_jsxs("button", { type: type, disabled: disabled || loading, "aria-busy": loading || undefined, className: cn(BASE, VARIANT_CLASSES[variant], SIZE_CLASSES[size], className), ...rest, children: [loading ? (_jsx("span", { className: "inline-block w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin", "aria-hidden": "true" })) : null, _jsx("span", { children: children })] }));
}
export default Button;

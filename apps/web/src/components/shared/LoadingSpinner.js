import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export default function LoadingSpinner({ label = "Yükleniyor" }) {
    return (_jsxs("div", { role: "status", className: "flex flex-col items-center gap-3", children: [_jsxs("div", { className: "relative w-14 h-14", children: [_jsx("div", { className: "absolute inset-0 rounded-full border-4 border-navy-100 border-t-navy-600 animate-spin" }), _jsx("div", { className: "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-7 h-7 rounded-full border-2 border-emerald-100 border-b-emerald-500 animate-spin", style: { animationDirection: "reverse", animationDuration: "0.9s" } })] }), _jsx("span", { className: "text-sm text-navy-600", children: label }), _jsx("span", { className: "sr-only", children: "Loading" })] }));
}

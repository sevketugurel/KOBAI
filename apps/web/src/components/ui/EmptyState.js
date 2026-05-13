import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { cn } from "../../lib/utils";
export function EmptyState({ icon, title, message, action, className }) {
    return (_jsxs("div", { className: cn("flex flex-col items-center justify-center py-16 px-6 text-center", className), children: [icon ? _jsx("div", { className: "text-navy-400 mb-4", children: icon }) : null, _jsx("h4", { className: "font-display text-lg font-semibold text-navy-900", children: title }), message ? (_jsx("p", { className: "text-sm text-navy-500 mt-2 max-w-md", children: message })) : null, action ? _jsx("div", { className: "mt-6", children: action }) : null] }));
}
export default EmptyState;

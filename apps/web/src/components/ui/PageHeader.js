import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { cn } from "../../lib/utils";
export function PageHeader({ title, subtitle, actions, className }) {
    return (_jsxs("header", { className: cn("flex items-start justify-between gap-4", className), children: [_jsxs("div", { className: "min-w-0", children: [_jsx("h1", { className: "font-display text-2xl font-bold text-navy-900", children: title }), subtitle ? (_jsx("p", { className: "text-sm text-navy-500 mt-1", children: subtitle })) : null] }), actions ? _jsx("div", { className: "shrink-0 flex items-center gap-2", children: actions }) : null] }));
}
export default PageHeader;

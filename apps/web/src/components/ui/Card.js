import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { cn } from "../../lib/utils";
function CardRoot({ className, children, ...rest }) {
    return (_jsx("div", { className: cn("bg-surface rounded-xl border border-border shadow-card", className), ...rest, children: children }));
}
function CardHeader({ title, subtitle, action, className }) {
    return (_jsxs("div", { className: cn("flex items-start justify-between gap-4 p-6 border-b border-border", className), children: [_jsxs("div", { className: "min-w-0", children: [_jsx("h3", { className: "font-display text-base font-semibold text-navy-900", children: title }), subtitle ? (_jsx("p", { className: "text-sm text-navy-500 mt-1", children: subtitle })) : null] }), action ? _jsx("div", { className: "shrink-0", children: action }) : null] }));
}
function CardBody({ className, children, padded = true, ...rest }) {
    return (_jsx("div", { className: cn(padded && "p-6", className), ...rest, children: children }));
}
export const Card = CardRoot;
Card.Header = CardHeader;
Card.Body = CardBody;
export default Card;

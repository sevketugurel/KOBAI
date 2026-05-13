import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { forwardRef, useId } from "react";
import { cn } from "../../lib/utils";
const INPUT_BASE = "w-full rounded-lg border bg-surface px-3 py-2 text-sm text-navy-900 placeholder:text-navy-400 outline-none transition focus:ring-2 focus:ring-navy-500";
export const Input = forwardRef(function Input({ label, error, hint, id, className, ...rest }, ref) {
    const reactId = useId();
    const inputId = id ?? reactId;
    const describedBy = error
        ? `${inputId}-error`
        : hint
            ? `${inputId}-hint`
            : undefined;
    return (_jsxs("div", { className: "flex flex-col gap-1", children: [label ? (_jsx("label", { htmlFor: inputId, className: "text-xs font-medium text-navy-600", children: label })) : null, _jsx("input", { ref: ref, id: inputId, "aria-invalid": error ? true : undefined, "aria-describedby": describedBy, className: cn(INPUT_BASE, error
                    ? "border-red-500 focus:ring-red-500 focus:border-red-500"
                    : "border-border focus:border-navy-500", className), ...rest }), error ? (_jsx("p", { id: `${inputId}-error`, className: "text-xs text-red-600", children: error })) : hint ? (_jsx("p", { id: `${inputId}-hint`, className: "text-xs text-navy-500", children: hint })) : null] }));
});
export default Input;

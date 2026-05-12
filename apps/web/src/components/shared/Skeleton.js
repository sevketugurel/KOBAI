import { jsx as _jsx } from "react/jsx-runtime";
import { cn } from "../../lib/utils";
export function Skeleton({ className }) {
    return _jsx("div", { className: cn("skeleton", className), "aria-hidden": "true" });
}

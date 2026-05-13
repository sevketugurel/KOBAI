import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { cn } from "../../lib/utils";
import { EmptyState } from "./EmptyState";
const ALIGN_CLASSES = {
    left: "text-left",
    right: "text-right",
    center: "text-center",
};
export function DataTable({ columns, rows, keyField, loading = false, emptyTitle = "Kayıt bulunamadı", emptyMessage, emptyIcon, emptyAction, className, skeletonRows = 5, }) {
    return (_jsx("div", { className: cn("overflow-x-auto rounded-xl border border-border bg-surface", className), children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { className: "bg-navy-50", children: _jsx("tr", { children: columns.map((col, i) => (_jsx("th", { scope: "col", style: col.width ? { width: col.width } : undefined, className: cn("text-xs font-semibold uppercase tracking-wide text-navy-600 px-4 py-3", ALIGN_CLASSES[col.align ?? "left"], col.className), children: col.header }, String(col.key) + i))) }) }), _jsx("tbody", { children: loading ? (Array.from({ length: skeletonRows }).map((_, rowIdx) => (_jsx("tr", { className: "border-t border-border", children: columns.map((col, colIdx) => (_jsx("td", { className: "px-4 py-3", children: _jsx("div", { className: "skeleton h-4 w-full" }) }, `skeleton-${rowIdx}-${colIdx}`))) }, `skeleton-${rowIdx}`)))) : rows.length === 0 ? (_jsx("tr", { children: _jsx("td", { colSpan: columns.length, className: "p-0", children: _jsx(EmptyState, { icon: emptyIcon, title: emptyTitle, message: emptyMessage, action: emptyAction }) }) })) : (rows.map((row, idx) => (_jsx("tr", { className: "border-t border-border hover:bg-navy-50/50 transition-colors animate-slide-up", style: { animationDelay: `${Math.min(idx, 10) * 30}ms` }, children: columns.map((col, colIdx) => {
                            const content = col.render
                                ? col.render(row)
                                : row[col.key];
                            return (_jsx("td", { className: cn("px-4 py-3 text-navy-700", ALIGN_CLASSES[col.align ?? "left"], col.className), children: content }, String(col.key) + colIdx));
                        }) }, String(row[keyField]))))) })] }) }));
}
export default DataTable;

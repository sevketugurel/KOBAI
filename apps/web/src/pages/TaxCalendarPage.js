import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { v2 } from "../api/v2";
const TAX_TYPE_LABELS = {
    kdv: "KDV",
    muhtasar: "Muhtasar",
    gecici_vergi: "Geçici Vergi",
    sgk: "SGK",
    gelir_vergisi: "Gelir Vergisi",
    kurumlar_vergisi: "Kurumlar Vergisi",
};
const STATUS_LABELS = {
    pending: "Bekliyor",
    paid: "Ödendi",
    overdue: "Gecikmiş",
};
const STATUS_CLASSES = {
    pending: "bg-amber-100 text-amber-800 border-amber-300",
    paid: "bg-emerald-100 text-emerald-800 border-emerald-300",
    overdue: "bg-red-100 text-red-800 border-red-300",
};
const DATE_FMT = new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit", month: "long", year: "numeric",
});
function daysUntil(iso) {
    const d = new Date(iso);
    const diff = d.getTime() - new Date().setHours(0, 0, 0, 0);
    return Math.round(diff / 86400000);
}
export default function TaxCalendarPage() {
    const { slug = "" } = useParams();
    const qc = useQueryClient();
    const items = useQuery({
        queryKey: ["tax-calendar", slug],
        queryFn: () => v2.listTaxCalendar(slug),
        enabled: Boolean(slug),
    });
    const markPaid = useMutation({
        mutationFn: ({ itemId }) => v2.patchTaxCalendarItem(slug, itemId, { status: "paid" }),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["tax-calendar", slug] }),
    });
    if (items.isLoading)
        return _jsx("p", { className: "text-sm text-neutral-500", children: "Y\u00FCkleniyor\u2026" });
    if (items.isError)
        return _jsx("p", { className: "text-sm text-red-600", children: "Takvim y\u00FCklenemedi." });
    const rows = items.data ?? [];
    const pending = rows.filter((r) => r.status === "pending");
    const overdue = rows.filter((r) => r.status === "overdue");
    const paid = rows.filter((r) => r.status === "paid");
    return (_jsxs("div", { className: "space-y-8", children: [_jsxs("header", { children: [_jsx("h1", { className: "font-display text-xl", children: "Vergi Takvimi" }), _jsx("p", { className: "text-xs text-neutral-500", children: "KDV, Muhtasar, SGK, Ge\u00E7ici Vergi ve y\u0131ll\u0131k beyannameler i\u00E7in son \u00F6deme tarihleri." })] }), _jsx(Summary, { label: "Gecikmi\u015F", tone: "overdue", count: overdue.length }), overdue.length > 0 && _jsx(ItemList, { rows: overdue, onPaid: (id) => markPaid.mutate({ itemId: id }) }), _jsx(Summary, { label: "Yakla\u015Fan", tone: "pending", count: pending.length }), _jsx(ItemList, { rows: pending, onPaid: (id) => markPaid.mutate({ itemId: id }) }), paid.length > 0 && (_jsxs(_Fragment, { children: [_jsx(Summary, { label: "\u00D6denmi\u015F", tone: "paid", count: paid.length }), _jsx(ItemList, { rows: paid, muted: true })] }))] }));
}
function Summary({ label, count, tone }) {
    return (_jsxs("div", { className: `inline-block rounded border px-3 py-1 text-sm ${STATUS_CLASSES[tone]}`, children: [label, ": ", _jsx("strong", { children: count })] }));
}
function ItemList({ rows, onPaid, muted = false, }) {
    if (rows.length === 0) {
        return _jsx("p", { className: "text-sm text-neutral-500", children: "Kay\u0131t yok." });
    }
    return (_jsx("ul", { className: "space-y-2", children: rows.map((it) => {
            const dl = daysUntil(it.due_date);
            const urgency = it.status === "overdue" ? "text-red-700"
                : dl <= 3 ? "text-amber-700"
                    : "text-neutral-700";
            return (_jsxs("li", { className: `flex items-center justify-between rounded border border-border bg-surface px-4 py-3 ${muted ? "opacity-60" : ""}`, children: [_jsxs("div", { children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "text-xs uppercase tracking-wide text-neutral-500", children: TAX_TYPE_LABELS[it.tax_type] }), _jsx("span", { className: `text-xs ${STATUS_CLASSES[it.status]} rounded border px-2 py-0.5`, children: STATUS_LABELS[it.status] })] }), _jsx("div", { className: "mt-1 text-sm font-medium", children: it.title }), it.description && (_jsx("div", { className: "text-xs text-neutral-500", children: it.description }))] }), _jsxs("div", { className: "text-right", children: [_jsx("div", { className: `font-mono text-sm ${urgency}`, children: DATE_FMT.format(new Date(it.due_date)) }), _jsx("div", { className: "text-xs text-neutral-500", children: it.status === "overdue"
                                    ? `${Math.abs(dl)} gün geçti`
                                    : dl === 0 ? "Bugün"
                                        : dl > 0 ? `${dl} gün sonra`
                                            : `${Math.abs(dl)} gün önce` }), onPaid && it.status !== "paid" && (_jsx("button", { onClick: () => onPaid(it.id), className: "mt-1 text-xs text-navy-700 underline", children: "\u00D6dendi olarak i\u015Faretle" }))] })] }, it.id));
        }) }));
}

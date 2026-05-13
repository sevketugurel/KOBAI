import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useParams } from "react-router-dom";
import { Building2, Calendar, CreditCard, Link2, TrendingUp, TrendingDown, } from "lucide-react";
import { Card, EmptyState, KpiCard, PageHeader, StatusBadge, } from "../components/ui";
import { useTenantDashboard } from "../hooks/useTenantDashboard";
import { formatDate, formatDateTime, formatRelative, formatTRY, } from "../lib/utils";
function toNumber(s) {
    if (s == null)
        return 0;
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
}
function taxStatusVariant(item) {
    if (item.status === "overdue")
        return "danger";
    if (item.status === "paid")
        return "success";
    return "warning";
}
function activityIcon(type) {
    if (type === "bank")
        return _jsx(Building2, { size: 16 });
    if (type === "pos")
        return _jsx(CreditCard, { size: 16 });
    return _jsx(Calendar, { size: 16 });
}
export default function TenantDashboard() {
    const { slug = "" } = useParams();
    const { data, isLoading, isError } = useTenantDashboard(slug);
    const summary = data;
    const netFlow = toNumber(summary?.net_flow_this_month);
    const posSales = toNumber(summary?.pos_sales_this_month);
    return (_jsxs("div", { className: "max-w-7xl mx-auto px-6 py-8 space-y-8 animate-fade-in", children: [_jsx(PageHeader, { title: `${slug} Dashboard`, subtitle: summary?.updated_at
                    ? `Son güncelleme: ${formatDateTime(summary.updated_at)}`
                    : "Veriler yükleniyor…" }), _jsxs("section", { className: "grid grid-cols-2 md:grid-cols-4 gap-4", children: [_jsx(KpiCard, { label: "Bu Ay Net Ak\u0131\u015F", value: formatTRY(netFlow), icon: netFlow >= 0 ? _jsx(TrendingUp, { size: 20 }) : _jsx(TrendingDown, { size: 20 }), loading: isLoading }), _jsx(KpiCard, { label: "Bu Ay POS Sat\u0131\u015F\u0131", value: formatTRY(posSales), icon: _jsx(CreditCard, { size: 20 }), loading: isLoading }), _jsx(KpiCard, { label: "Yakla\u015Fan Vergi", value: `${summary?.upcoming_tax_count ?? 0} kalem`, icon: _jsx(Calendar, { size: 20 }), loading: isLoading }), _jsx(KpiCard, { label: "Aktif Entegrasyon", value: String(summary?.integration_count ?? 0), icon: _jsx(Link2, { size: 20 }), loading: isLoading })] }), _jsxs("section", { className: "grid md:grid-cols-3 gap-6", children: [_jsxs(Card, { className: "md:col-span-2", children: [_jsx(Card.Header, { title: "Yakla\u015Fan 3 Vergi Kalemi", subtitle: "\u00D6n\u00FCm\u00FCzdeki 30 g\u00FCn i\u00E7inde \u00F6denmesi gerekenler" }), _jsx(Card.Body, { children: isLoading ? (_jsx("div", { className: "space-y-3", children: Array.from({ length: 3 }).map((_, i) => (_jsx("div", { className: "skeleton h-12" }, i))) })) : !summary || summary.upcoming_taxes.length === 0 ? (_jsx(EmptyState, { icon: _jsx(Calendar, { size: 32 }), title: "Yakla\u015Fan vergi yok", message: "\u00D6n\u00FCm\u00FCzdeki 30 g\u00FCn i\u00E7in \u00F6denmemi\u015F vergi kalemi bulunmuyor." })) : (_jsx("ul", { className: "divide-y divide-border", children: summary.upcoming_taxes.map((item, i) => (_jsxs("li", { className: "py-3 flex items-center justify-between animate-slide-up", style: { animationDelay: `${i * 50}ms` }, children: [_jsxs("div", { className: "min-w-0", children: [_jsx("p", { className: "font-display font-semibold text-navy-900 truncate", children: item.title }), _jsxs("p", { className: "text-xs text-navy-500 mt-0.5", children: [item.tax_type.toUpperCase(), item.period ? ` • ${item.period}` : ""] })] }), _jsxs("div", { className: "flex items-center gap-3 shrink-0", children: [_jsx(StatusBadge, { variant: taxStatusVariant(item), label: item.status }), _jsx("span", { className: "font-mono text-sm text-navy-700 tabular-nums", children: formatDate(item.due_date) })] })] }, item.id))) })) })] }), _jsxs(Card, { children: [_jsx(Card.Header, { title: "Son Aktiviteler", subtitle: "Banka ve POS hareketleri" }), _jsx(Card.Body, { children: isLoading ? (_jsx("div", { className: "space-y-3", children: Array.from({ length: 4 }).map((_, i) => (_jsx("div", { className: "skeleton h-10" }, i))) })) : !summary || summary.recent_activities.length === 0 ? (_jsx(EmptyState, { icon: _jsx(Building2, { size: 28 }), title: "Aktivite yok", message: "Banka veya POS hareketi hen\u00FCz kaydedilmedi." })) : (_jsx("ul", { className: "space-y-3", children: summary.recent_activities.map((a, i) => {
                                        const amount = toNumber(a.amount);
                                        const positive = amount >= 0;
                                        return (_jsxs("li", { className: "flex items-start gap-3 animate-slide-up", style: { animationDelay: `${i * 40}ms` }, children: [_jsx("div", { className: "mt-0.5 text-navy-400", children: activityIcon(a.type) }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("p", { className: "text-sm text-navy-900 truncate", children: a.title }), _jsx("p", { className: "text-xs text-navy-500", children: formatRelative(a.timestamp) })] }), a.amount != null ? (_jsx("span", { className: "font-mono text-sm tabular-nums " +
                                                        (positive ? "text-emerald-600" : "text-red-600"), children: formatTRY(amount) })) : null] }, a.id));
                                    }) })) })] })] }), isError ? (_jsx("p", { className: "text-sm text-red-600", children: "Dashboard verisi y\u00FCklenemedi. L\u00FCtfen sayfay\u0131 yenileyin." })) : null] }));
}

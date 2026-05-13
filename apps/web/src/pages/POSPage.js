import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useParams } from "react-router-dom";
import { V2ApiError, v2, } from "../api/v2";
const TRY = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" });
const DATE_TIME = new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
});
const TXN_TYPE_LABELS = {
    sale: "Satış",
    refund: "İade",
    void: "İptal",
    preauth: "Ön Otorizasyon",
};
const STATUS_CLASSES = {
    success: "bg-emerald-100 text-emerald-800 border-emerald-300",
    failed: "bg-red-100 text-red-800 border-red-300",
    pending: "bg-amber-100 text-amber-800 border-amber-300",
    cancelled: "bg-neutral-100 text-neutral-700 border-neutral-300",
};
export default function POSPage() {
    const { slug = "" } = useParams();
    const qc = useQueryClient();
    const cfg = useQuery({
        queryKey: ["pos-config", slug],
        queryFn: () => v2.getPosConfig(slug),
        enabled: Boolean(slug),
    });
    const txns = useQuery({
        queryKey: ["pos-transactions", slug],
        queryFn: () => v2.listPosTransactions(slug, 50),
        enabled: Boolean(slug),
        // MVP: polling. Faz 7+'da Supabase Realtime subscription.
        refetchInterval: 15000,
    });
    const summary = useQuery({
        queryKey: ["pos-summary", slug],
        queryFn: () => v2.getPosSummary(slug),
        enabled: Boolean(slug),
        refetchInterval: 30000,
    });
    const [provider, setProvider] = useState("iyzico_checkout");
    const [apiKey, setApiKey] = useState("");
    const [secretKey, setSecretKey] = useState("");
    const [webhookSecret, setWebhookSecret] = useState("");
    const [okMsg, setOkMsg] = useState(null);
    const [err, setErr] = useState(null);
    const save = useMutation({
        mutationFn: () => v2.putPosConfig(slug, {
            provider,
            credentials: { api_key: apiKey, secret_key: secretKey },
            webhook_secret: webhookSecret,
        }),
        onSuccess: () => {
            setOkMsg("Yapılandırma kaydedildi.");
            setErr(null);
            setSecretKey("");
            setWebhookSecret("");
            qc.invalidateQueries({ queryKey: ["pos-config", slug] });
        },
        onError: (e) => {
            setOkMsg(null);
            if (e instanceof V2ApiError) {
                const d = e.detail?.detail;
                setErr(d ?? `HTTP ${e.status}`);
            }
            else {
                setErr(e instanceof Error ? e.message : "Bilinmeyen hata");
            }
        },
    });
    function onSubmit(e) {
        e.preventDefault();
        save.mutate();
    }
    const c = cfg.data;
    const webhookFull = c?.webhook_url
        ? `${window.location.origin.replace(/:\d+$/, ":8000")}${c.webhook_url}`
        : null;
    return (_jsxs("div", { className: "space-y-8", children: [_jsxs("header", { children: [_jsx("h1", { className: "font-display text-xl", children: "Sanal POS" }), _jsx("p", { className: "text-xs text-neutral-500", children: "iyzico Checkout BYOI. Webhook ile gelen online \u00F6demeleri yakalar." })] }), summary.data && (_jsxs("section", { className: "grid grid-cols-2 gap-3 md:grid-cols-4", children: [_jsx(Kpi, { label: "Bug\u00FCn Sat\u0131\u015F", value: TRY.format(Number(summary.data.total_sales)) }), _jsx(Kpi, { label: "Bug\u00FCn \u0130ade", value: TRY.format(Number(summary.data.total_refunds)) }), _jsx(Kpi, { label: "Net", value: TRY.format(Number(summary.data.net_amount)), tone: Number(summary.data.net_amount) >= 0 ? "good" : "bad" }), _jsx(Kpi, { label: "\u0130\u015Flem", value: String(summary.data.sale_count + summary.data.refund_count) })] })), _jsxs("section", { className: "rounded border border-border bg-surface p-4", children: [_jsx("h2", { className: "mb-2 text-sm font-medium", children: "Yap\u0131land\u0131rma" }), cfg.isLoading && _jsx("p", { className: "text-xs text-neutral-500", children: "Y\u00FCkleniyor\u2026" }), c && (_jsxs("p", { className: "text-xs text-neutral-600", children: ["Sa\u011Flay\u0131c\u0131: ", _jsx("strong", { children: c.provider ?? "—" }), " \u00B7 Aktif:", " ", _jsx("strong", { children: c.is_active ? "Evet" : "Hayır" }), " \u00B7 Son webhook:", " ", c.last_sync_at ? new Date(c.last_sync_at).toLocaleString("tr-TR") : "—"] })), webhookFull && (_jsxs("div", { className: "mt-3 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900", children: [_jsx("strong", { children: "Webhook URL:" }), " ", _jsx("code", { className: "font-mono", children: webhookFull }), _jsx("br", {}), "HMAC-SHA256, header: ", _jsx("code", { children: "X-Pos-Signature" })] })), _jsxs("form", { onSubmit: onSubmit, className: "mt-4 space-y-2 text-sm", children: [_jsxs("select", { value: provider, onChange: (e) => setProvider(e.target.value), className: "w-full rounded border border-neutral-300 px-2 py-1.5", children: [_jsx("option", { value: "iyzico_checkout", children: "iyzico Checkout" }), _jsx("option", { value: "craftgate", children: "Craftgate" })] }), _jsx("input", { type: "text", placeholder: "API Key", value: apiKey, onChange: (e) => setApiKey(e.target.value), required: true, className: "w-full rounded border border-neutral-300 px-2 py-1.5" }), _jsx("input", { type: "password", placeholder: "Secret Key", value: secretKey, onChange: (e) => setSecretKey(e.target.value), required: true, className: "w-full rounded border border-neutral-300 px-2 py-1.5" }), _jsx("input", { type: "text", placeholder: "Webhook Secret (8-128 karakter)", value: webhookSecret, onChange: (e) => setWebhookSecret(e.target.value), required: true, minLength: 8, className: "w-full rounded border border-neutral-300 px-2 py-1.5 font-mono" }), okMsg && _jsx("p", { className: "text-emerald-700", children: okMsg }), err && _jsx("p", { className: "text-red-600", children: err }), _jsx("button", { type: "submit", disabled: save.isPending, className: "rounded bg-navy-900 px-3 py-1.5 text-white disabled:opacity-60", children: save.isPending ? "Kaydediliyor…" : "Kaydet" })] })] }), _jsxs("section", { children: [_jsx("h2", { className: "mb-2 font-display text-lg", children: "Son \u0130\u015Flemler" }), txns.isLoading && _jsx("p", { className: "text-sm text-neutral-500", children: "Y\u00FCkleniyor\u2026" }), txns.data && txns.data.length === 0 && (_jsx("p", { className: "text-sm text-neutral-500", children: "Hen\u00FCz i\u015Flem yok." })), txns.data && txns.data.length > 0 && _jsx(TxTable, { rows: txns.data })] })] }));
}
function Kpi({ label, value, tone }) {
    const color = tone === "bad" ? "text-red-700" : tone === "good" ? "text-emerald-700" : "text-neutral-900";
    return (_jsxs("div", { className: "rounded border border-border bg-surface px-4 py-3", children: [_jsx("div", { className: "text-xs text-neutral-500", children: label }), _jsx("div", { className: `mt-1 font-mono text-lg ${color}`, children: value })] }));
}
function TxTable({ rows }) {
    return (_jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { className: "border-b border-border text-left text-xs text-neutral-500", children: _jsxs("tr", { children: [_jsx("th", { className: "py-2 pr-3", children: "Tarih" }), _jsx("th", { className: "py-2 pr-3", children: "T\u00FCr" }), _jsx("th", { className: "py-2 pr-3", children: "Durum" }), _jsx("th", { className: "py-2 pr-3", children: "Kart" }), _jsx("th", { className: "py-2 pr-3 text-right", children: "Tutar" })] }) }), _jsx("tbody", { children: rows.map((t) => (_jsxs("tr", { className: "border-b border-border/60", children: [_jsx("td", { className: "py-2 pr-3 font-mono text-xs", children: DATE_TIME.format(new Date(t.transacted_at)) }), _jsx("td", { className: "py-2 pr-3", children: TXN_TYPE_LABELS[t.txn_type] }), _jsx("td", { className: "py-2 pr-3", children: _jsx("span", { className: `rounded border px-2 py-0.5 text-xs ${STATUS_CLASSES[t.status]}`, children: t.status }) }), _jsxs("td", { className: "py-2 pr-3 font-mono text-xs text-neutral-600", children: [t.card_last_four ? `**** ${t.card_last_four}` : "—", t.installments > 1 && (_jsxs("span", { className: "ml-1 text-[10px] text-neutral-500", children: [t.installments, "x"] }))] }), _jsxs("td", { className: `py-2 pr-3 text-right font-mono ${t.txn_type === "refund" ? "text-red-700" : "text-emerald-700"}`, children: [t.txn_type === "refund" ? "−" : "", TRY.format(Number.parseFloat(t.amount))] })] }, t.id))) })] }) }));
}

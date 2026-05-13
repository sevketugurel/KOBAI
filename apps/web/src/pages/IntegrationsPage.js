import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { useParams } from "react-router-dom";
import { V2ApiError, v2 } from "../api/v2";
const BANK_LABELS = {
    is_bankasi: "İş Bankası",
    garanti: "Garanti BBVA",
    akbank: "Akbank",
    yapi_kredi: "Yapı Kredi",
    ziraat: "Ziraat Bankası",
    halkbank: "Halkbank",
    vakifbank: "VakıfBank",
    qnb_finansbank: "QNB Finansbank",
    denizbank: "DenizBank",
    diger: "Diğer",
};
const CATEGORY_LABELS = {
    personel: "Personel",
    kira: "Kira",
    hammadde: "Hammadde",
    vergi: "Vergi",
    sgk: "SGK",
    mal_satis: "Mal Satışı",
    hizmet_satis: "Hizmet Satışı",
    diger: "Diğer",
};
const TRY = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" });
export default function IntegrationsPage() {
    const { slug = "" } = useParams();
    const qc = useQueryClient();
    const integrations = useQuery({
        queryKey: ["integrations", slug],
        queryFn: () => v2.listIntegrations(slug),
        enabled: Boolean(slug),
    });
    const txs = useQuery({
        queryKey: ["bank-transactions", slug],
        queryFn: () => v2.listBankTransactions(slug, 100),
        enabled: Boolean(slug),
    });
    const [importMsg, setImportMsg] = useState(null);
    const [importErr, setImportErr] = useState(null);
    const upload = useMutation({
        mutationFn: (file) => v2.uploadBankStatement(slug, file),
        onSuccess: (res) => {
            setImportErr(null);
            setImportMsg(`${BANK_LABELS[res.bank_name] ?? res.bank_name}: ${res.transactions_imported} hareket eklendi` +
                (res.transactions_skipped_duplicate > 0
                    ? `, ${res.transactions_skipped_duplicate} mükerrer atlandı.`
                    : "."));
            qc.invalidateQueries({ queryKey: ["bank-transactions", slug] });
            qc.invalidateQueries({ queryKey: ["integrations", slug] });
        },
        onError: (err) => {
            setImportMsg(null);
            if (err instanceof V2ApiError) {
                const detail = err.detail?.detail;
                setImportErr(detail ?? `HTTP ${err.status}`);
            }
            else {
                setImportErr(err instanceof Error ? err.message : "Bilinmeyen hata");
            }
        },
    });
    const onDrop = useCallback((files) => {
        if (files[0])
            upload.mutate(files[0]);
    }, [upload]);
    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: { "application/pdf": [".pdf"] },
        maxFiles: 1,
        disabled: upload.isPending,
    });
    return (_jsxs("div", { className: "space-y-8", children: [_jsxs("section", { children: [_jsx("h1", { className: "mb-4 font-display text-xl", children: "Entegrasyonlar" }), _jsxs("div", { ...getRootProps(), className: `cursor-pointer rounded border-2 border-dashed p-8 text-center transition ${isDragActive ? "border-navy-700 bg-navy-50" : "border-neutral-300 bg-surface"} ${upload.isPending ? "opacity-60" : ""}`, children: [_jsx("input", { ...getInputProps() }), _jsx("p", { className: "text-sm", children: upload.isPending
                                    ? "PDF işleniyor… (Gemini Vision parse)"
                                    : "Banka ekstresi PDF'ini buraya sürükle veya tıklayıp seç" }), _jsx("p", { className: "mt-1 text-xs text-neutral-500", children: "Faz 3 \u2014 yaln\u0131zca PDF parse; banka API ba\u011Flant\u0131s\u0131 v2'de yok." })] }), importMsg && _jsx("p", { className: "mt-3 text-sm text-emerald-700", children: importMsg }), importErr && _jsxs("p", { className: "mt-3 text-sm text-red-600", children: ["Y\u00FCkleme hatas\u0131: ", importErr] }), _jsx("h2", { className: "mt-6 mb-2 text-sm font-medium text-neutral-700", children: "Ba\u011Fl\u0131 Servisler" }), integrations.isLoading && _jsx("p", { className: "text-sm text-neutral-500", children: "Y\u00FCkleniyor\u2026" }), integrations.data && integrations.data.length === 0 && (_jsx("p", { className: "text-sm text-neutral-500", children: "Hen\u00FCz entegrasyon yok." })), _jsx("ul", { className: "space-y-1", children: integrations.data?.map((i) => (_jsxs("li", { className: "rounded border border-border bg-surface px-3 py-2 text-sm", children: [_jsx("span", { className: "font-medium", children: i.provider }), i.last_sync_at && (_jsxs("span", { className: "ml-2 text-xs text-neutral-500", children: ["son senk: ", new Date(i.last_sync_at).toLocaleString("tr-TR")] })), i.last_error && (_jsxs("span", { className: "ml-2 text-xs text-red-600", children: ["son hata: ", i.last_error] }))] }, i.id))) })] }), _jsxs("section", { children: [_jsx("h2", { className: "mb-3 font-display text-lg", children: "Banka Hareketleri" }), txs.isLoading && _jsx("p", { className: "text-sm text-neutral-500", children: "Y\u00FCkleniyor\u2026" }), txs.data && txs.data.length === 0 && (_jsx("p", { className: "text-sm text-neutral-500", children: "Hen\u00FCz hareket yok. Bir ekstre y\u00FCkle." })), txs.data && txs.data.length > 0 && _jsx(TxTable, { rows: txs.data })] })] }));
}
function TxTable({ rows }) {
    return (_jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { className: "border-b border-border text-left text-xs text-neutral-500", children: _jsxs("tr", { children: [_jsx("th", { className: "py-2 pr-3", children: "Tarih" }), _jsx("th", { className: "py-2 pr-3", children: "A\u00E7\u0131klama" }), _jsx("th", { className: "py-2 pr-3", children: "Kategori" }), _jsx("th", { className: "py-2 pr-3 text-right", children: "Tutar" })] }) }), _jsx("tbody", { children: rows.map((t) => {
                        const sign = t.direction === "credit" ? 1 : -1;
                        const value = sign * Number.parseFloat(t.amount);
                        return (_jsxs("tr", { className: "border-b border-border/60", children: [_jsx("td", { className: "py-2 pr-3 font-mono text-xs", children: new Date(t.transacted_at).toLocaleDateString("tr-TR") }), _jsx("td", { className: "py-2 pr-3", children: t.description ?? "—" }), _jsx("td", { className: "py-2 pr-3 text-xs text-neutral-600", children: t.category ? CATEGORY_LABELS[t.category] ?? t.category : "—" }), _jsx("td", { className: `py-2 pr-3 text-right font-mono ${value >= 0 ? "text-emerald-700" : "text-red-700"}`, children: TRY.format(value) })] }, t.id));
                    }) })] }) }));
}

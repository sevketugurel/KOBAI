import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Calendar } from "lucide-react";
import { cn, formatTRY } from "../../lib/utils";
const URGENCY = {
    red: { pillBg: "bg-red-50", pillText: "text-red-700", badgeBg: "bg-red-100 text-red-800" },
    amber: { pillBg: "bg-amber-50", pillText: "text-amber-700", badgeBg: "bg-amber-100 text-amber-800" },
    navy: { pillBg: "bg-navy-50", pillText: "text-navy-700", badgeBg: "bg-navy-100 text-navy-700" },
};
const MONTHS_TR = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
function monthShortTR(date) {
    return MONTHS_TR[date.getMonth()] ?? "";
}
function parseYearMonth(month) {
    const [y, m] = month.split("-");
    return { year: Number(y), month: Number(m) };
}
export function TaxCalendar({ forecast }) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const entries = [];
    for (const row of forecast) {
        const { year, month } = parseYearMonth(row.month);
        if (row.kdv_payment > 0) {
            entries.push({ kind: "KDV", amount: row.kdv_payment, date: new Date(year, month - 1, 26) });
        }
        if (row.sgk_payment > 0) {
            entries.push({ kind: "SGK", amount: row.sgk_payment, date: new Date(year, month - 1, 7) });
        }
    }
    const upcoming = entries
        .filter((e) => e.date.getTime() >= today.getTime())
        .sort((a, b) => a.date.getTime() - b.date.getTime())
        .slice(0, 5);
    return (_jsxs("div", { className: "card p-6", children: [_jsxs("div", { className: "flex items-center gap-2 mb-4", children: [_jsx("div", { className: "w-8 h-8 rounded-lg bg-navy-50 flex items-center justify-center text-navy-600", children: _jsx(Calendar, { className: "w-4 h-4" }) }), _jsx("h3", { className: "font-display font-semibold text-lg text-navy-900", children: "Vergi Takvimi" })] }), upcoming.length === 0 ? (_jsx("p", { className: "text-sm text-navy-500 italic", children: "\u00D6n\u00FCm\u00FCzdeki d\u00F6nemde \u00F6deme plan\u0131 yok." })) : (_jsx("ul", { className: "space-y-2", children: upcoming.map((entry, idx) => {
                    const daysUntil = Math.ceil((entry.date.getTime() - today.getTime()) / 86_400_000);
                    const urgencyKey = daysUntil < 30 ? "red" : daysUntil < 60 ? "amber" : "navy";
                    const urgency = URGENCY[urgencyKey];
                    return (_jsxs("li", { className: "flex items-center justify-between gap-3", children: [_jsxs("div", { className: "flex items-center gap-3 min-w-0", children: [_jsxs("div", { className: cn("w-12 h-12 rounded-lg flex flex-col items-center justify-center flex-shrink-0", urgency.pillBg, urgency.pillText), children: [_jsx("span", { className: "text-2xs uppercase", children: monthShortTR(entry.date) }), _jsx("span", { className: "font-display font-bold text-base leading-none", children: entry.date.getDate() })] }), _jsxs("div", { className: "min-w-0", children: [_jsx("div", { className: "font-medium text-navy-900 text-sm", children: entry.kind === "KDV" ? "KDV Ödemesi" : "SGK Ödemesi" }), _jsx("div", { className: "text-2xs text-navy-500", children: daysUntil >= 0 ? `${daysUntil} gün kaldı` : "Bugün" })] })] }), _jsxs("div", { className: "flex items-center gap-2 flex-shrink-0", children: [_jsx("span", { className: "font-display font-bold text-navy-900 text-sm", children: formatTRY(entry.amount) }), daysUntil < 30 && _jsx("span", { className: cn("badge", URGENCY.red.badgeBg), children: "Yakla\u015F\u0131yor" })] })] }, `${entry.kind}-${entry.date.toISOString()}-${idx}`));
                }) }))] }));
}

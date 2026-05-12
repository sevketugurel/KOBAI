import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, } from "recharts";
import { formatTRY } from "../../lib/utils";
const AY_KISALTMA = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
function ayLabel(month) {
    const [, mm] = month.split("-");
    if (!mm)
        return month;
    return AY_KISALTMA[Number(mm) - 1] ?? month;
}
// Recharts' dot prop typings are intentionally loose; using `any` keeps this readable.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function NetDot(props) {
    const { cx, cy, payload } = props;
    if (cx == null || cy == null)
        return null;
    if (payload?.kdv_payment > 0) {
        return (_jsxs("g", { children: [_jsx("circle", { cx: cx, cy: cy, r: 5, fill: "#EF4444", stroke: "white", strokeWidth: 2 }), _jsx("text", { x: cx, y: cy - 12, textAnchor: "middle", fontSize: 9, fontWeight: 600, fill: "#EF4444", children: "KDV" })] }));
    }
    return _jsx("circle", { cx: cx, cy: cy, r: 3, fill: "#10C896" });
}
function CustomTooltip({ active, payload, label }) {
    if (!active || !payload || payload.length === 0)
        return null;
    return (_jsxs("div", { className: "card p-3 text-sm space-y-1", children: [_jsx("div", { className: "font-semibold text-navy-900 mb-1", children: label }), payload.map((p) => (_jsxs("div", { className: "flex items-center justify-between gap-4", children: [_jsxs("span", { className: "flex items-center gap-2 text-navy-600", children: [_jsx("span", { className: "w-2 h-2 rounded-sm", style: { background: p.color } }), p.name] }), _jsx("span", { className: "font-medium text-navy-900", children: formatTRY(Number(p.value ?? 0)) })] }, String(p.dataKey))))] }));
}
const LEGEND = [
    { label: "Gelir", color: "#2A5298" },
    { label: "Gider", color: "#F87171" },
    { label: "Net", color: "#10C896" },
    { label: "Kümülatif", color: "#94A3B8" },
];
export default function CashFlowChart({ data }) {
    const chartData = data.map((d) => ({ ...d, ay: ayLabel(d.month) }));
    return (_jsxs("div", { className: "card p-6", children: [_jsxs("div", { className: "flex items-center justify-between mb-4", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("h3", { className: "font-display font-semibold text-lg text-navy-900", children: "Nakit Ak\u0131\u015F\u0131 Tahmini" }), _jsxs("span", { className: "badge bg-navy-50 text-navy-600", children: [data.length, " ay"] })] }), _jsx("div", { className: "flex items-center gap-3 text-xs text-navy-600", children: LEGEND.map((item) => (_jsxs("span", { className: "flex items-center gap-1.5", children: [_jsx("span", { className: "w-2.5 h-2.5 rounded-sm", style: { background: item.color } }), item.label] }, item.label))) })] }), _jsx(ResponsiveContainer, { width: "100%", height: 280, children: _jsxs(ComposedChart, { data: chartData, margin: { top: 10, right: 12, left: 0, bottom: 0 }, children: [_jsxs("defs", { children: [_jsxs("linearGradient", { id: "incomeFill", x1: "0", y1: "0", x2: "0", y2: "1", children: [_jsx("stop", { offset: "5%", stopColor: "#2A5298", stopOpacity: 0.35 }), _jsx("stop", { offset: "95%", stopColor: "#2A5298", stopOpacity: 0 })] }), _jsxs("linearGradient", { id: "expenseFill", x1: "0", y1: "0", x2: "0", y2: "1", children: [_jsx("stop", { offset: "5%", stopColor: "#F87171", stopOpacity: 0.3 }), _jsx("stop", { offset: "95%", stopColor: "#F87171", stopOpacity: 0 })] })] }), _jsx(CartesianGrid, { strokeDasharray: "3 3", stroke: "#E2E7F0", vertical: false }), _jsx(XAxis, { dataKey: "ay", stroke: "#94A3B8", fontSize: 11, tickLine: false, axisLine: false }), _jsx(YAxis, { yAxisId: "left", stroke: "#94A3B8", fontSize: 11, tickLine: false, axisLine: false, tickFormatter: (v) => formatTRY(v), width: 80 }), _jsx(YAxis, { yAxisId: "right", orientation: "right", stroke: "#94A3B8", fontSize: 11, tickLine: false, axisLine: false, tickFormatter: (v) => formatTRY(v), width: 70 }), _jsx(Tooltip, { content: _jsx(CustomTooltip, {}) }), _jsx(Area, { yAxisId: "left", type: "monotone", dataKey: "income", name: "Gelir", stroke: "#2A5298", strokeWidth: 2, fill: "url(#incomeFill)" }), _jsx(Area, { yAxisId: "left", type: "monotone", dataKey: "expense", name: "Gider", stroke: "#F87171", strokeWidth: 2, fill: "url(#expenseFill)" }), _jsx(Line, { yAxisId: "left", type: "monotone", dataKey: "net", name: "Net", stroke: "#10C896", strokeWidth: 2.5, dot: _jsx(NetDot, {}), activeDot: { r: 5 } }), _jsx(Line, { yAxisId: "right", type: "monotone", dataKey: "cumulative", name: "K\u00FCm\u00FClatif", stroke: "#94A3B8", strokeWidth: 1.5, strokeDasharray: "4 4", dot: false })] }) })] }));
}

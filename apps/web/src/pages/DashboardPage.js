import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useParams, Link } from "react-router-dom";
import { useAnalysis } from "../hooks/useAnalysis";
import { Navbar } from "../components/layout/Navbar";
import { DashboardHeader } from "../components/dashboard/DashboardHeader";
import KPICards from "../components/dashboard/KPICards";
import CashFlowChart from "../components/dashboard/CashFlowChart";
import RiskIndicator from "../components/dashboard/RiskIndicator";
import AgentTrace from "../components/dashboard/AgentTrace";
import { TaxCalendar } from "../components/dashboard/TaxCalendar";
import { TaxRecommendations } from "../components/dashboard/TaxRecommendations";
import { KosgebCards } from "../components/dashboard/KosgebCards";
import ChatPanel from "../components/chat/ChatPanel";
import { Skeleton } from "../components/shared/Skeleton";
import { reportUrl } from "../api/client";
import { AlertCircle } from "lucide-react";
export default function DashboardPage() {
    const { jobId = "" } = useParams();
    const { data, isLoading, error } = useAnalysis(jobId);
    if (error) {
        return (_jsxs(_Fragment, { children: [_jsx(Navbar, { showNewAnalysis: true }), _jsx("main", { className: "max-w-3xl mx-auto px-6 py-12", children: _jsxs("div", { className: "card p-6 flex items-start gap-3", children: [_jsx("div", { className: "w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center text-red-600 flex-shrink-0", children: _jsx(AlertCircle, { className: "w-5 h-5" }) }), _jsxs("div", { className: "flex-1", children: [_jsx("h2", { className: "font-display font-bold text-navy-900", children: "Bir hata olu\u015Ftu" }), _jsx("p", { className: "text-sm text-navy-600 mt-1", children: error.message }), _jsx(Link, { to: "/", className: "btn-primary mt-4", children: "Ana sayfaya d\u00F6n" })] })] }) })] }));
    }
    if (isLoading || !data) {
        return (_jsxs(_Fragment, { children: [_jsx(Navbar, { showNewAnalysis: true }), _jsxs("main", { className: "max-w-7xl mx-auto px-6 py-8 space-y-6", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx(Skeleton, { className: "h-8 w-64" }), _jsx(Skeleton, { className: "h-10 w-32" })] }), _jsx("div", { className: "grid grid-cols-2 lg:grid-cols-4 gap-4", children: Array.from({ length: 4 }).map((_, i) => (_jsxs("div", { className: "card p-5 space-y-3", children: [_jsx(Skeleton, { className: "h-3 w-24" }), _jsx(Skeleton, { className: "h-7 w-32" }), _jsx(Skeleton, { className: "h-3 w-16" })] }, i))) }), _jsxs("div", { className: "grid lg:grid-cols-3 gap-6", children: [_jsxs("div", { className: "lg:col-span-2 space-y-6", children: [_jsxs("div", { className: "card p-6 space-y-4", children: [_jsx(Skeleton, { className: "h-4 w-40" }), _jsx(Skeleton, { className: "h-64 w-full" })] }), _jsxs("div", { className: "grid sm:grid-cols-2 gap-6", children: [_jsxs("div", { className: "card p-6 space-y-3", children: [_jsx(Skeleton, { className: "h-4 w-32" }), _jsx(Skeleton, { className: "h-32 w-full" })] }), _jsxs("div", { className: "card p-6 space-y-3", children: [_jsx(Skeleton, { className: "h-4 w-32" }), _jsx(Skeleton, { className: "h-32 w-full" })] })] }), _jsxs("div", { className: "card p-6 space-y-3", children: [_jsx(Skeleton, { className: "h-4 w-32" }), _jsx(Skeleton, { className: "h-24 w-full" })] })] }), _jsx("div", { className: "lg:col-span-1", children: _jsxs("div", { className: "card p-6 space-y-3 h-96", children: [_jsx(Skeleton, { className: "h-4 w-32" }), _jsx(Skeleton, { className: "flex-1 w-full" })] }) })] })] })] }));
    }
    const income = data.cash_flow_forecast.reduce((a, b) => a + b.income, 0);
    const expense = data.cash_flow_forecast.reduce((a, b) => a + b.expense, 0);
    const net = income - expense;
    const taxBurden = data.cash_flow_forecast.reduce((a, b) => a + b.kdv_payment + b.sgk_payment, 0);
    const periodLabel = data.cash_flow_forecast.length > 0
        ? `${data.cash_flow_forecast[0].month} – ${data.cash_flow_forecast[data.cash_flow_forecast.length - 1].month}`
        : undefined;
    const handleExport = () => window.open(reportUrl(jobId), "_blank", "noopener,noreferrer");
    return (_jsxs(_Fragment, { children: [_jsx(Navbar, { showNewAnalysis: true }), _jsxs("main", { className: "max-w-7xl mx-auto px-6 py-8", children: [_jsx(DashboardHeader, { businessName: "Analiz Sonu\u00E7lar\u0131", periodLabel: periodLabel, onExportPdf: handleExport }), _jsx(KPICards, { income: income, expense: expense, net: net, taxBurden: taxBurden }), _jsxs("div", { className: "grid lg:grid-cols-3 gap-6 mt-6", children: [_jsxs("div", { className: "lg:col-span-2 space-y-6", children: [_jsx(CashFlowChart, { data: data.cash_flow_forecast }), _jsxs("div", { className: "grid sm:grid-cols-2 gap-6", children: [_jsx(RiskIndicator, { risk_label: data.risk_label, risk_score: data.risk_score, explanation: data.risk_explanation }), _jsx(TaxCalendar, { forecast: data.cash_flow_forecast })] }), _jsx(TaxRecommendations, { recommendations: data.tax_recommendations }), _jsx(KosgebCards, { suggestions: data.kosgeb_suggestions }), _jsx(AgentTrace, { trace: data.agent_trace })] }), _jsx("div", { className: "lg:col-span-1", children: _jsx(ChatPanel, { jobId: jobId }) })] })] })] }));
}

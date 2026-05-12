import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Sparkles, Search, Scale, ArrowRight, CheckCircle2, FileText } from "lucide-react";
import UploadZone from "../components/upload/UploadZone";
import OnboardingWizard from "../components/onboarding/OnboardingWizard";
import { Navbar } from "../components/layout/Navbar";
import LoadingSpinner from "../components/shared/LoadingSpinner";
import { useToast } from "../components/shared/Toast";
import { startAnalysis } from "../api/client";
import { formatTRY } from "../lib/utils";
export default function HomePage() {
    const [invoices, setInvoices] = useState([]);
    const [stage, setStage] = useState("upload");
    const navigate = useNavigate();
    const { toast } = useToast();
    const handleUpload = (id, data) => setInvoices((prev) => [...prev, { id, data }]);
    const onComplete = async (p) => {
        setStage("starting");
        const r = await startAnalysis({ invoice_ids: invoices.map((i) => i.id), ...p });
        navigate(`/dashboard/${r.job_id}`);
    };
    const loadDemoData = () => toast({
        variant: "info",
        title: "Demo verisi yakında",
        description: "Ahmet Usta Fırını demo seti hazırlanıyor.",
    });
    return (_jsxs(_Fragment, { children: [_jsx(Navbar, {}), _jsx("main", { className: "min-h-[calc(100vh-4rem)] bg-hero-grid", children: _jsxs("section", { className: "max-w-7xl mx-auto px-6", children: [_jsx(HeroSection, { onDemo: loadDemoData }), stage === "upload" && (_jsx(UploadSection, { invoices: invoices, onUploadSuccess: handleUpload, onNext: () => setStage("wizard") })), stage === "wizard" && (_jsx("div", { className: "py-10", children: _jsx(OnboardingWizard, { onComplete: onComplete }) })), stage === "starting" && _jsx(StartingSection, {})] }) })] }));
}
function HeroSection({ onDemo }) {
    return (_jsxs("div", { className: "grid md:grid-cols-2 gap-10 items-center py-16", children: [_jsxs("div", { className: "flex flex-col gap-6", children: [_jsx("h1", { className: "font-display font-extrabold text-3xl md:text-5xl text-balance text-navy-900 leading-tight", children: "T\u00FCrkiye'nin \u0130lk AI Mali M\u00FC\u015Faviri" }), _jsx("p", { className: "text-lg text-navy-600 max-w-md", children: "KDV, SGK ve nakit ak\u0131\u015F\u0131 \u2014 tek y\u00FCklemede anl\u0131k analiz." }), _jsxs("div", { className: "flex flex-wrap gap-2", children: [_jsxs("span", { className: "badge bg-navy-50 text-navy-700 px-3 py-1.5", children: [_jsx(Sparkles, { className: "w-3.5 h-3.5" }), " Gemini AI"] }), _jsxs("span", { className: "badge bg-navy-50 text-navy-700 px-3 py-1.5", children: [_jsx(Search, { className: "w-3.5 h-3.5" }), " Anl\u0131k RAG"] }), _jsxs("span", { className: "badge bg-navy-50 text-navy-700 px-3 py-1.5", children: [_jsx(Scale, { className: "w-3.5 h-3.5" }), " T\u00FCrk Mevzuat\u0131"] })] }), _jsxs("div", { className: "flex flex-wrap items-center gap-3", children: [_jsxs("a", { href: "#upload", className: "btn-primary", children: ["Hemen Ba\u015Fla ", _jsx(ArrowRight, { className: "w-4 h-4" })] }), _jsx("button", { onClick: onDemo, className: "btn-ghost", children: "Demo ile Dene" })] })] }), _jsxs(motion.div, { className: "card p-6 space-y-4", initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, transition: { delay: 0.2 }, children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { className: "text-2xs uppercase tracking-wider text-navy-500", children: "\u00D6nizleme" }), _jsx("span", { className: "w-2 h-2 rounded-full bg-emerald-500 animate-pulse-dot" })] }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("div", { className: "rounded-lg border border-border p-3", children: [_jsx("div", { className: "text-2xs uppercase tracking-wider text-navy-500", children: "Gelir" }), _jsx("div", { className: "font-display font-bold text-lg text-navy-900", children: "\u20BA 124.500" })] }), _jsxs("div", { className: "rounded-lg border border-border p-3", children: [_jsx("div", { className: "text-2xs uppercase tracking-wider text-navy-500", children: "Gider" }), _jsx("div", { className: "font-display font-bold text-lg text-navy-900", children: "\u20BA 89.200" })] }), _jsxs("div", { className: "rounded-lg border border-border p-3", children: [_jsx("div", { className: "text-2xs uppercase tracking-wider text-navy-500", children: "Net" }), _jsx("div", { className: "font-display font-bold text-lg text-navy-900", children: "\u20BA 35.300" })] }), _jsxs("div", { className: "rounded-lg border border-border p-3", children: [_jsx("div", { className: "text-2xs uppercase tracking-wider text-navy-500", children: "Vergi" }), _jsx("div", { className: "font-display font-bold text-lg text-navy-900", children: "\u20BA 14.800" })] })] }), _jsxs("div", { className: "flex items-center gap-2 text-xs text-navy-600", children: [_jsx("span", { className: "w-2 h-2 rounded-full bg-emerald-500 animate-pulse-dot" }), " Risk: D\u00FC\u015F\u00FCk"] })] })] }));
}
function UploadSection({ invoices, onUploadSuccess, onNext, }) {
    return (_jsxs("section", { id: "upload", className: "pb-16 space-y-6", children: [_jsxs("header", { className: "space-y-1", children: [_jsx("h2", { className: "font-display text-2xl text-navy-900", children: "Faturalar\u0131n\u0131z\u0131 Y\u00FCkleyin" }), _jsx("p", { className: "text-sm text-navy-600", children: "PDF faturalar\u0131n\u0131z\u0131 s\u00FCr\u00FCkle-b\u0131rak ya da dosya se\u00E7erek ekleyin." })] }), _jsx(UploadZone, { onUploadSuccess: onUploadSuccess }), invoices.length > 0 && (_jsxs("div", { className: "space-y-3", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("span", { className: "badge bg-emerald-50 text-emerald-700", children: [_jsx(CheckCircle2, { className: "w-3.5 h-3.5" }), " ", invoices.length, " fatura y\u00FCklendi"] }), _jsxs("button", { onClick: onNext, className: "btn-primary", children: ["Analizi Ba\u015Flat ", _jsx(ArrowRight, { className: "w-4 h-4" })] })] }), _jsx("ul", { className: "space-y-2", children: invoices.map(({ id, data }) => (_jsxs("li", { className: "card p-3 flex items-center justify-between gap-4", children: [_jsxs("div", { className: "flex items-center gap-3 min-w-0", children: [_jsx("div", { className: "w-9 h-9 rounded-lg bg-navy-50 flex items-center justify-center text-navy-600 flex-shrink-0", children: _jsx(FileText, { className: "w-4 h-4" }) }), _jsxs("div", { className: "min-w-0", children: [_jsx("div", { className: "font-medium text-navy-900 truncate", children: data.vendor_name }), _jsx("div", { className: "text-xs text-navy-500", children: data.date })] })] }), _jsxs("div", { className: "flex items-center gap-3 flex-shrink-0", children: [_jsx("span", { className: "badge bg-navy-50 text-navy-600", children: data.category }), _jsx("span", { className: "font-display font-bold text-navy-900", children: formatTRY(data.total_amount) })] })] }, id))) })] }))] }));
}
function StartingSection() {
    return (_jsx("section", { className: "py-20 flex justify-center", children: _jsx(LoadingSpinner, { label: "Ajanlar \u00E7al\u0131\u015F\u0131yor\u2026" }) }));
}

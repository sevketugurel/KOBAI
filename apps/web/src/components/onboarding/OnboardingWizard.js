import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { User, Building2, Landmark, ShoppingCart, UtensilsCrossed, Briefcase, Factory, CalendarDays, CalendarRange, CalendarCheck, ArrowLeft, ArrowRight, CheckCircle2, } from "lucide-react";
import { cn } from "../../lib/utils";
function formatMonthYear(d) {
    return d.toLocaleDateString("tr-TR", { month: "short", year: "numeric" });
}
function rangeFor(months) {
    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - months);
    return `${formatMonthYear(start)} — ${formatMonthYear(end)}`;
}
const companyOptions = [
    { value: "Şahıs Şirketi", label: "Şahıs Şirketi", description: "Bireysel girişimci", icon: User },
    { value: "Limited Şirketi", label: "Limited Şirketi", description: "1-50 çalışan", icon: Building2 },
    { value: "Anonim Şirket", label: "Anonim Şirket", description: "Büyük ölçek", icon: Landmark },
];
const sectorOptions = [
    { value: "Perakende", label: "Perakende", description: "Mağaza, e-ticaret, butik", icon: ShoppingCart },
    { value: "Gıda & İçecek", label: "Gıda & İçecek", description: "Restoran, kafe, fırın", icon: UtensilsCrossed },
    { value: "Hizmet", label: "Hizmet", description: "Danışmanlık, yazılım, sağlık", icon: Briefcase },
    { value: "İmalat", label: "İmalat", description: "Üretim, atölye, fabrika", icon: Factory },
];
function periodOptions() {
    return [
        { value: "3m", label: "Son 3 ay", description: rangeFor(3), icon: CalendarDays },
        { value: "6m", label: "Son 6 ay", description: rangeFor(6), icon: CalendarRange },
        { value: "12m", label: "Son 1 yıl", description: rangeFor(12), icon: CalendarCheck },
    ];
}
function SelectableCard({ option, selected, onSelect }) {
    const Icon = option.icon;
    return (_jsxs(motion.button, { type: "button", onClick: () => onSelect(option.value), whileHover: { scale: 1.02 }, whileTap: { scale: 0.99 }, "aria-pressed": selected, className: cn("relative card p-6 text-left w-full transition-shadow hover:shadow-card-hover", selected && "border-navy-500 bg-navy-50 ring-2 ring-navy-200"), children: [_jsx("div", { className: "w-10 h-10 rounded-lg bg-navy-100 text-navy-700 flex items-center justify-center mb-4", children: _jsx(Icon, { className: "w-5 h-5" }) }), _jsx("div", { className: "font-display font-semibold text-navy-900", children: option.label }), _jsx("div", { className: "text-sm text-navy-600 mt-1", children: option.description }), selected && (_jsx(CheckCircle2, { className: "absolute top-3 right-3 w-5 h-5 text-navy-600" }))] }));
}
export default function OnboardingWizard({ onComplete }) {
    const [step, setStep] = useState(0);
    const [companyType, setCompanyType] = useState("Şahıs Şirketi");
    const [sector, setSector] = useState("Perakende");
    const [period, setPeriod] = useState("6m");
    const stepLabels = ["Şirket", "Sektör", "Dönem"];
    return (_jsxs(motion.div, { className: "max-w-3xl mx-auto card p-8", children: [_jsxs("div", { className: "mb-8 space-y-3", children: [_jsxs("div", { className: "flex items-center justify-between text-xs uppercase tracking-wider text-navy-500", children: [_jsxs("span", { children: ["Ad\u0131m ", step + 1, " / 3"] }), _jsx("span", { children: stepLabels[step] })] }), _jsx("div", { className: "h-1 bg-navy-100 rounded-full overflow-hidden", children: _jsx(motion.div, { className: "h-full bg-navy-600", animate: { width: `${((step + 1) / 3) * 100}%` }, transition: { duration: 0.3, ease: "easeOut" } }) })] }), _jsx(AnimatePresence, { initial: false, children: _jsxs(motion.div, { initial: { x: 30, opacity: 0 }, animate: { x: 0, opacity: 1 }, exit: { x: -30, opacity: 0 }, transition: { duration: 0.25 }, children: [step === 0 && (_jsx("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-4", children: companyOptions.map((opt) => (_jsx(SelectableCard, { option: opt, selected: companyType === opt.value, onSelect: setCompanyType }, opt.value))) })), step === 1 && (_jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: sectorOptions.map((opt) => (_jsx(SelectableCard, { option: opt, selected: sector === opt.value, onSelect: setSector }, opt.value))) })), step === 2 && (_jsx("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-4", children: periodOptions().map((opt) => (_jsx(SelectableCard, { option: opt, selected: period === opt.value, onSelect: setPeriod }, opt.value))) }))] }, step) }), _jsxs("div", { className: "flex items-center justify-between mt-8 pt-6 border-t border-border", children: [_jsxs("button", { type: "button", disabled: step === 0, onClick: () => setStep((s) => s - 1), className: "btn-secondary", children: [_jsx(ArrowLeft, { className: "w-4 h-4" }), " Geri"] }), step < 2 ? (_jsxs("button", { type: "button", onClick: () => setStep((s) => s + 1), className: "btn-primary", children: ["\u0130leri ", _jsx(ArrowRight, { className: "w-4 h-4" })] })) : (_jsxs("button", { type: "button", onClick: () => onComplete({ company_type: companyType, sector, period }), className: "btn-primary", children: ["Analizi Ba\u015Flat ", _jsx(ArrowRight, { className: "w-4 h-4" })] }))] })] }));
}

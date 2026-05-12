import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  User,
  Building2,
  Landmark,
  ShoppingCart,
  UtensilsCrossed,
  Briefcase,
  Factory,
  CalendarDays,
  CalendarRange,
  CalendarCheck,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "../../lib/utils";

type CompanyType = "Şahıs Şirketi" | "Limited Şirketi" | "Anonim Şirket";
type Sector = "Perakende" | "Gıda & İçecek" | "Hizmet" | "İmalat";
type Period = "3m" | "6m" | "12m";

export interface OnboardingPayload {
  company_type: CompanyType;
  sector: Sector;
  period: Period;
}

interface OptionCard<T extends string> {
  value: T;
  label: string;
  description: string;
  icon: LucideIcon;
}

function formatMonthYear(d: Date): string {
  return d.toLocaleDateString("tr-TR", { month: "short", year: "numeric" });
}

function rangeFor(months: number): string {
  const end = new Date();
  const start = new Date();
  start.setMonth(start.getMonth() - months);
  return `${formatMonthYear(start)} — ${formatMonthYear(end)}`;
}

const companyOptions: OptionCard<CompanyType>[] = [
  { value: "Şahıs Şirketi", label: "Şahıs Şirketi", description: "Bireysel girişimci", icon: User },
  { value: "Limited Şirketi", label: "Limited Şirketi", description: "1-50 çalışan", icon: Building2 },
  { value: "Anonim Şirket", label: "Anonim Şirket", description: "Büyük ölçek", icon: Landmark },
];

const sectorOptions: OptionCard<Sector>[] = [
  { value: "Perakende", label: "Perakende", description: "Mağaza, e-ticaret, butik", icon: ShoppingCart },
  { value: "Gıda & İçecek", label: "Gıda & İçecek", description: "Restoran, kafe, fırın", icon: UtensilsCrossed },
  { value: "Hizmet", label: "Hizmet", description: "Danışmanlık, yazılım, sağlık", icon: Briefcase },
  { value: "İmalat", label: "İmalat", description: "Üretim, atölye, fabrika", icon: Factory },
];

function periodOptions(): OptionCard<Period>[] {
  return [
    { value: "3m", label: "Son 3 ay", description: rangeFor(3), icon: CalendarDays },
    { value: "6m", label: "Son 6 ay", description: rangeFor(6), icon: CalendarRange },
    { value: "12m", label: "Son 1 yıl", description: rangeFor(12), icon: CalendarCheck },
  ];
}

interface SelectableCardProps<T extends string> {
  option: OptionCard<T>;
  selected: boolean;
  onSelect: (value: T) => void;
}

function SelectableCard<T extends string>({ option, selected, onSelect }: SelectableCardProps<T>) {
  const Icon = option.icon;
  return (
    <motion.button
      type="button"
      onClick={() => onSelect(option.value)}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.99 }}
      aria-pressed={selected}
      className={cn(
        "relative card p-6 text-left w-full transition-shadow hover:shadow-card-hover",
        selected && "border-navy-500 bg-navy-50 ring-2 ring-navy-200"
      )}
    >
      <div className="w-10 h-10 rounded-lg bg-navy-100 text-navy-700 flex items-center justify-center mb-4">
        <Icon className="w-5 h-5" />
      </div>
      <div className="font-display font-semibold text-navy-900">{option.label}</div>
      <div className="text-sm text-navy-600 mt-1">{option.description}</div>
      {selected && (
        <CheckCircle2 className="absolute top-3 right-3 w-5 h-5 text-navy-600" />
      )}
    </motion.button>
  );
}

export default function OnboardingWizard({ onComplete }: { onComplete: (p: OnboardingPayload) => void }) {
  const [step, setStep] = useState(0);
  const [companyType, setCompanyType] = useState<CompanyType>("Şahıs Şirketi");
  const [sector, setSector] = useState<Sector>("Perakende");
  const [period, setPeriod] = useState<Period>("6m");

  const stepLabels = ["Şirket", "Sektör", "Dönem"];

  return (
    <motion.div className="max-w-3xl mx-auto card p-8">
      <div className="mb-8 space-y-3">
        <div className="flex items-center justify-between text-xs uppercase tracking-wider text-navy-500">
          <span>Adım {step + 1} / 3</span>
          <span>{stepLabels[step]}</span>
        </div>
        <div className="h-1 bg-navy-100 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-navy-600"
            animate={{ width: `${((step + 1) / 3) * 100}%` }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          />
        </div>
      </div>

      <AnimatePresence initial={false}>
        <motion.div
          key={step}
          initial={{ x: 30, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: -30, opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          {step === 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {companyOptions.map((opt) => (
                <SelectableCard
                  key={opt.value}
                  option={opt}
                  selected={companyType === opt.value}
                  onSelect={setCompanyType}
                />
              ))}
            </div>
          )}
          {step === 1 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sectorOptions.map((opt) => (
                <SelectableCard
                  key={opt.value}
                  option={opt}
                  selected={sector === opt.value}
                  onSelect={setSector}
                />
              ))}
            </div>
          )}
          {step === 2 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {periodOptions().map((opt) => (
                <SelectableCard
                  key={opt.value}
                  option={opt}
                  selected={period === opt.value}
                  onSelect={setPeriod}
                />
              ))}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="flex items-center justify-between mt-8 pt-6 border-t border-border">
        <button
          type="button"
          disabled={step === 0}
          onClick={() => setStep((s) => s - 1)}
          className="btn-secondary"
        >
          <ArrowLeft className="w-4 h-4" /> Geri
        </button>
        {step < 2 ? (
          <button type="button" onClick={() => setStep((s) => s + 1)} className="btn-primary">
            İleri <ArrowRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onComplete({ company_type: companyType, sector, period })}
            className="btn-primary"
          >
            Analizi Başlat <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </motion.div>
  );
}

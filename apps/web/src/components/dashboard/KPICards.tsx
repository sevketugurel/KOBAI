import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Wallet, Receipt, type LucideIcon } from "lucide-react";
import { useCountUp } from "../../hooks/useCountUp";
import { formatTRY, cn } from "../../lib/utils";

const ACCENT_CLASSES = {
  emerald: { iconBg: "bg-emerald-50", iconText: "text-emerald-600" },
  red: { iconBg: "bg-red-50", iconText: "text-red-600" },
  navy: { iconBg: "bg-navy-50", iconText: "text-navy-600" },
  amber: { iconBg: "bg-amber-50", iconText: "text-amber-600" },
} as const;

type Accent = keyof typeof ACCENT_CLASSES;

type KPICardsProps = {
  income: number;
  expense: number;
  net: number;
  taxBurden: number;
};

function KPICard({
  title,
  value,
  icon: Icon,
  accent,
  index,
}: {
  title: string;
  value: number;
  icon: LucideIcon;
  accent: Accent;
  index: number;
}) {
  const animatedValue = useCountUp(value);
  const styles = ACCENT_CLASSES[accent];

  return (
    <motion.div
      className="card p-5 hover:shadow-card-hover transition-shadow"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.1 }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-navy-500 uppercase tracking-wider">{title}</span>
        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", styles.iconBg)}>
          <Icon className={cn("w-4 h-4", styles.iconText)} />
        </div>
      </div>
      <div className="text-2xl font-display font-bold text-navy-900">
        {formatTRY(animatedValue)}
      </div>
    </motion.div>
  );
}

export default function KPICards({ income, expense, net, taxBurden }: KPICardsProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <KPICard index={0} title="Toplam Gelir" value={income} icon={TrendingUp} accent="emerald" />
      <KPICard index={1} title="Toplam Gider" value={expense} icon={TrendingDown} accent="red" />
      <KPICard index={2} title="Net Nakit Akışı" value={net} icon={Wallet} accent="navy" />
      <KPICard index={3} title="Tahmini Vergi Yükü" value={taxBurden} icon={Receipt} accent="amber" />
    </div>
  );
}

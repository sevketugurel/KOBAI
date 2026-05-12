import { Calendar } from "lucide-react";
import type { CashFlowMonth } from "../../api/types";
import { cn, formatTRY } from "../../lib/utils";

interface TaxCalendarProps {
  forecast: CashFlowMonth[];
}

type UrgencyKey = "red" | "amber" | "navy";

interface PaymentEntry {
  kind: "KDV" | "SGK";
  amount: number;
  date: Date;
}

const URGENCY = {
  red: { pillBg: "bg-red-50", pillText: "text-red-700", badgeBg: "bg-red-100 text-red-800" },
  amber: { pillBg: "bg-amber-50", pillText: "text-amber-700", badgeBg: "bg-amber-100 text-amber-800" },
  navy: { pillBg: "bg-navy-50", pillText: "text-navy-700", badgeBg: "bg-navy-100 text-navy-700" },
} as const;

const MONTHS_TR = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"] as const;

function monthShortTR(date: Date): string {
  return MONTHS_TR[date.getMonth()] ?? "";
}

function parseYearMonth(month: string): { year: number; month: number } {
  const [y, m] = month.split("-");
  return { year: Number(y), month: Number(m) };
}

export function TaxCalendar({ forecast }: TaxCalendarProps): JSX.Element {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const entries: PaymentEntry[] = [];
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

  return (
    <div className="card p-6">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-navy-50 flex items-center justify-center text-navy-600">
          <Calendar className="w-4 h-4" />
        </div>
        <h3 className="font-display font-semibold text-lg text-navy-900">Vergi Takvimi</h3>
      </div>

      {upcoming.length === 0 ? (
        <p className="text-sm text-navy-500 italic">Önümüzdeki dönemde ödeme planı yok.</p>
      ) : (
        <ul className="space-y-2">
          {upcoming.map((entry, idx) => {
            const daysUntil = Math.ceil((entry.date.getTime() - today.getTime()) / 86_400_000);
            const urgencyKey: UrgencyKey = daysUntil < 30 ? "red" : daysUntil < 60 ? "amber" : "navy";
            const urgency = URGENCY[urgencyKey];
            return (
              <li key={`${entry.kind}-${entry.date.toISOString()}-${idx}`} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={cn("w-12 h-12 rounded-lg flex flex-col items-center justify-center flex-shrink-0", urgency.pillBg, urgency.pillText)}>
                    <span className="text-2xs uppercase">{monthShortTR(entry.date)}</span>
                    <span className="font-display font-bold text-base leading-none">{entry.date.getDate()}</span>
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-navy-900 text-sm">{entry.kind === "KDV" ? "KDV Ödemesi" : "SGK Ödemesi"}</div>
                    <div className="text-2xs text-navy-500">{daysUntil >= 0 ? `${daysUntil} gün kaldı` : "Bugün"}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="font-display font-bold text-navy-900 text-sm">{formatTRY(entry.amount)}</span>
                  {daysUntil < 30 && <span className={cn("badge", URGENCY.red.badgeBg)}>Yaklaşıyor</span>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

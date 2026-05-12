import type { RiskLabel } from "../../api/types";
const COLORS: Record<RiskLabel, string> = { green: "bg-emerald-500", yellow: "bg-amber-400", red: "bg-red-500" };
export default function RiskIndicator({ risk_label, risk_score, explanation }: { risk_label: RiskLabel; risk_score: number; explanation: string }) {
  return (
    <div className="border border-stone-200 rounded p-4 bg-white/60">
      <div className="flex gap-3">
        {(["red","yellow","green"] as RiskLabel[]).map(c => (
          <div key={c} data-testid={`light-${c}`}
               className={`h-6 w-6 rounded-full ${COLORS[c]} ${c === risk_label ? "opacity-100" : "opacity-25"}`} />
        ))}
      </div>
      <p className="mt-3 text-sm text-stone-700">{explanation}</p>
      <div className="mt-2 text-xs text-stone-600">Güven: {"★".repeat(risk_score)}{"☆".repeat(5 - risk_score)}</div>
    </div>
  );
}

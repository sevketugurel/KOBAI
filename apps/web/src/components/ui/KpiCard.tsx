import type { ReactNode } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { cn } from "../../lib/utils";

export interface KpiTrend {
  value: number;
  label: string;
}

export interface KpiCardProps {
  label: string;
  value: ReactNode;
  trend?: KpiTrend;
  icon?: ReactNode;
  loading?: boolean;
  className?: string;
}

export function KpiCard({
  label,
  value,
  trend,
  icon,
  loading = false,
  className,
}: KpiCardProps) {
  const positive = trend ? trend.value >= 0 : false;
  return (
    <div
      className={cn(
        "bg-surface rounded-xl border border-border shadow-card hover:shadow-card-hover transition-shadow p-5",
        className,
      )}
    >
      <div className="flex items-start justify-between">
        <p className="text-xs uppercase tracking-wide text-navy-500 font-medium">
          {label}
        </p>
        {icon ? <div className="text-navy-400">{icon}</div> : null}
      </div>
      {loading ? (
        <div className="skeleton h-8 w-24 mt-3" />
      ) : (
        <p className="text-2xl font-mono font-semibold text-navy-900 tabular-nums mt-2">
          {value}
        </p>
      )}
      {trend && !loading ? (
        <div
          className={cn(
            "mt-2 inline-flex items-center gap-1 text-xs font-medium",
            positive ? "text-emerald-600" : "text-red-600",
          )}
        >
          {positive ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
          <span className="font-mono tabular-nums">
            {positive ? "+" : ""}
            {trend.value}%
          </span>
          <span className="text-navy-500 font-normal">{trend.label}</span>
        </div>
      ) : null}
    </div>
  );
}

export default KpiCard;

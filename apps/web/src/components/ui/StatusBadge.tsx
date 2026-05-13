import { cn } from "../../lib/utils";

export type StatusBadgeVariant =
  | "success"
  | "warning"
  | "danger"
  | "neutral"
  | "info";

export interface StatusBadgeProps {
  variant: StatusBadgeVariant;
  label: string;
  dot?: boolean;
  className?: string;
}

const VARIANT_CLASSES: Record<StatusBadgeVariant, string> = {
  success: "bg-emerald-100 text-emerald-700",
  warning: "bg-amber-100 text-amber-700",
  danger: "bg-red-100 text-red-700",
  neutral: "bg-navy-100 text-navy-600",
  info: "bg-navy-50 text-navy-600",
};

export function StatusBadge({ variant, label, dot, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 text-2xs font-semibold rounded-full",
        VARIANT_CLASSES[variant],
        className,
      )}
    >
      {dot ? (
        <span
          className="w-1.5 h-1.5 rounded-full bg-current animate-pulse-dot"
          aria-hidden="true"
        />
      ) : null}
      {label}
    </span>
  );
}

export default StatusBadge;

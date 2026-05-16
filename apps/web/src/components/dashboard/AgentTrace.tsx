import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  TrendingUp,
  Receipt,
  FileText,
  Activity,
  ChevronDown,
  type LucideIcon,
} from "lucide-react";
import { Skeleton } from "../shared/Skeleton";
import { cn } from "../../lib/utils";
import type { AgentStep } from "../../api/types";

const AGENT_STYLES: Record<string, { bg: string; badge: string; icon: LucideIcon }> = {
  rag_agent: { bg: "bg-navy-500", badge: "bg-navy-50 text-navy-700", icon: Search },
  cashflow_agent: { bg: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-700", icon: TrendingUp },
  tax_optimization_agent: { bg: "bg-amber-500", badge: "bg-amber-50 text-amber-700", icon: Receipt },
  report_agent: { bg: "bg-red-400", badge: "bg-red-50 text-red-700", icon: FileText },
  nakit_akisi: { bg: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-700", icon: TrendingUp },
  risk: { bg: "bg-red-400", badge: "bg-red-50 text-red-700", icon: Activity },
  mevzuat_rag: { bg: "bg-amber-500", badge: "bg-amber-50 text-amber-700", icon: Receipt },
  kosgeb: { bg: "bg-navy-500", badge: "bg-navy-50 text-navy-700", icon: Search },
  tax_calendar: { bg: "bg-amber-500", badge: "bg-amber-50 text-amber-700", icon: Receipt },
};

function stylesFor(name: string): { bg: string; badge: string; icon: LucideIcon } {
  return AGENT_STYLES[name] ?? { bg: "bg-navy-300", badge: "bg-navy-50 text-navy-700", icon: Activity };
}

function ConfidenceDots({ value }: { value: number }) {
  const filled = Math.max(0, Math.min(5, Math.round(value)));
  return (
    <span className="inline-flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <span
          key={i}
          className={cn("w-1.5 h-1.5 rounded-full", i < filled ? "bg-emerald-500" : "bg-navy-100")}
        />
      ))}
    </span>
  );
}

function statusLabel(status?: AgentStep["status"], durationMs?: number) {
  if (status === "running") return "çalışıyor";
  if (status === "failed") return "hata";
  if (durationMs === 0) return "tamamlandı";
  return `${durationMs} ms`;
}

export default function AgentTrace({
  trace,
  isLoading = false,
}: {
  trace: AgentStep[];
  isLoading?: boolean;
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const toggle = (i: number) => setOpenIndex((prev) => (prev === i ? null : i));

  return (
    <div className="card p-6">
      <h3 className="font-display font-semibold text-lg text-navy-900 mb-4">Ajan Akışı</h3>

      {isLoading ? (
        <ul className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <li key={i} className="flex items-start gap-3">
              <Skeleton className="w-6 h-6 rounded-full" />
              <div className="flex-1 space-y-2 pt-1">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-40" />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <ol className="relative space-y-3">
          <div className="absolute left-3 top-2 bottom-2 w-px bg-border" aria-hidden="true" />
          {trace.map((step, index) => {
            const styles = stylesFor(step.agent_name);
            const Icon = styles.icon;
            const isRunning = step.status === "running";
            const isFailed = step.status === "failed";
            return (
              <motion.li
                key={index}
                className="relative pl-10"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: index * 0.12 }}
              >
                <span
                  className={cn(
                    "absolute left-0 top-0.5 w-6 h-6 rounded-full flex items-center justify-center text-white",
                    styles.bg,
                    isRunning && "animate-pulse",
                    isFailed && "bg-red-600",
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                </span>

                <button
                  type="button"
                  onClick={() => toggle(index)}
                  className="w-full flex items-start justify-between gap-3 text-left rounded-lg px-2 py-1 hover:bg-navy-50/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-500"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={cn("badge", styles.badge)}>{step.agent_name}</span>
                      <span className="font-medium text-navy-900 text-sm">{step.action}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-navy-500 whitespace-nowrap">
                    <span className={cn(isRunning && "text-amber-700", isFailed && "text-red-700")}>
                      {statusLabel(step.status, step.duration_ms)}
                    </span>
                    {isRunning ? null : <ConfidenceDots value={step.confidence} />}
                    <ChevronDown
                      className={cn("w-4 h-4 transition-transform", openIndex === index && "rotate-180")}
                    />
                  </div>
                </button>

                <AnimatePresence initial={false}>
                  {openIndex === index && (
                    <motion.div
                      key="details"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <pre className="font-mono text-xs bg-navy-50 text-navy-800 p-3 rounded-lg overflow-x-auto mt-2 mx-2">
                        {JSON.stringify(step.output, null, 2)}
                      </pre>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

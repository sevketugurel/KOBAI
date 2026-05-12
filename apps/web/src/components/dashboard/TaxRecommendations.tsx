import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lightbulb, ChevronDown, Wand2 } from "lucide-react";
import { cn } from "../../lib/utils";
import type { TaxRecommendation } from "../../api/types";

interface TaxRecommendationsProps {
  recommendations: TaxRecommendation[];
}

const CONF_STYLES = {
  high: { borderL: "border-emerald-500", dot: "bg-emerald-500" },
  mid: { borderL: "border-amber-500", dot: "bg-amber-500" },
  low: { borderL: "border-red-400", dot: "bg-red-400" },
} as const;

function getConfStyles(confidence: number): (typeof CONF_STYLES)[keyof typeof CONF_STYLES] {
  if (confidence >= 0.8) return CONF_STYLES.high;
  if (confidence >= 0.5) return CONF_STYLES.mid;
  return CONF_STYLES.low;
}

function buildShortTitle(recommendation: string): string {
  const firstSentence = recommendation.split(/[.!?]/)[0] ?? recommendation;
  const base = firstSentence.length > 0 ? firstSentence : recommendation;
  const truncated = base.length > 90;
  return truncated ? `${base.slice(0, 90)}…` : base;
}

export function TaxRecommendations({ recommendations }: TaxRecommendationsProps): JSX.Element {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const toggle = (i: number) => setOpenIndex((prev) => (prev === i ? null : i));

  return (
    <div className="card p-6 space-y-4">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600">
          <Lightbulb className="w-4 h-4" />
        </div>
        <h3 className="font-display font-semibold text-lg text-navy-900">Vergi Önerileri</h3>
      </div>

      {recommendations.length === 0 ? (
        <p className="text-sm text-navy-500 italic">
          Bu dönem için ek vergi optimizasyon önerisi bulunamadı.
        </p>
      ) : (
        <ul className="space-y-2">
          {recommendations.map((rec, index) => {
            const confStyles = getConfStyles(rec.confidence);
            const shortTitle = buildShortTitle(rec.recommendation);
            const isOpen = openIndex === index;

            return (
              <li key={index}>
                <div
                  className={cn(
                    "rounded-lg border border-l-4 border-border bg-surface",
                    confStyles.borderL,
                  )}
                >
                  <button
                    type="button"
                    onClick={() => toggle(index)}
                    className="w-full flex items-center gap-3 p-4 text-left rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-500"
                  >
                    <span
                      className={cn("w-2 h-2 rounded-full flex-shrink-0", confStyles.dot)}
                    />
                    <span className="flex-1 min-w-0 text-sm font-medium text-navy-900">
                      {shortTitle}
                    </span>
                    <ChevronDown
                      className={cn(
                        "w-4 h-4 text-navy-400 transition-transform flex-shrink-0",
                        isOpen && "rotate-180",
                      )}
                    />
                  </button>

                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        key="d"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="px-4 pb-4 space-y-3 text-sm text-navy-700">
                          <p className="leading-relaxed">{rec.recommendation}</p>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="badge bg-navy-50 text-navy-700">
                              {rec.source} Md. {rec.article}
                            </span>
                            <span className="badge bg-navy-50 text-navy-600">
                              Güven: %{Math.round(rec.confidence * 100)}
                            </span>
                          </div>
                          {rec.action && (
                            <button className="btn-secondary text-xs">
                              <Wand2 className="w-3.5 h-3.5" />
                              {rec.action}
                            </button>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

import { motion } from "framer-motion";
import { Banknote, Award, ArrowUpRight } from "lucide-react";
import type { KosgebSuggestion } from "../../api/types";

interface KosgebCardsProps {
  suggestions: KosgebSuggestion[];
}

export function KosgebCards({ suggestions }: KosgebCardsProps): JSX.Element {
  return (
    <div className="card p-6 space-y-4">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600">
          <Banknote className="w-4 h-4" />
        </div>
        <h3 className="font-display font-semibold text-lg text-navy-900">
          KOSGEB Destek Fırsatları
        </h3>
      </div>

      {suggestions.length === 0 ? (
        <p className="text-sm text-navy-500 italic">
          Bu sektör için aktif destek bulunamadı.
        </p>
      ) : (
        <ul className="space-y-3">
          {suggestions.map((suggestion, index) => (
            <motion.li
              key={`${suggestion.title}-${index}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: index * 0.08 }}
              className="rounded-xl border border-border bg-surface p-4 flex items-start gap-3 hover:shadow-card transition-shadow"
            >
              <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600 flex-shrink-0">
                <Award className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-navy-900 text-sm">
                  {suggestion.title}
                </div>
                <div className="text-sm text-navy-600 mt-0.5">
                  {suggestion.detail}
                </div>
              </div>
              {suggestion.url && (
                <a
                  href={suggestion.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-ghost flex-shrink-0 text-xs"
                  aria-label={`${suggestion.title} detayına git`}
                >
                  İncele
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </a>
              )}
            </motion.li>
          ))}
        </ul>
      )}
    </div>
  );
}

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, FileDown } from "lucide-react";

interface DashboardHeaderProps {
  businessName?: string;
  periodLabel?: string;
  onExportPdf?: () => void;
}

export function DashboardHeader({
  businessName,
  periodLabel,
  onExportPdf,
}: DashboardHeaderProps): JSX.Element {
  const [open, setOpen] = useState(false);

  const handleConfirm = (): void => {
    onExportPdf?.();
    setOpen(false);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="flex items-start justify-between gap-4 mb-6">
      <div className="space-y-1">
        <h1 className="font-display font-extrabold text-2xl md:text-3xl text-navy-900">
          {businessName ?? "Analiz Sonuçları"}
        </h1>
        {periodLabel && <p className="text-sm text-navy-500">{periodLabel}</p>}
      </div>

      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={!onExportPdf}
        className="btn-primary flex-shrink-0"
      >
        <Download className="w-4 h-4" />
        PDF İndir
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 bg-navy-950/40 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setOpen(false)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="pdf-confirm-title"
          >
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.96 }}
              transition={{ duration: 0.18 }}
              className="card p-6 max-w-md w-full space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-navy-50 flex items-center justify-center text-navy-600 flex-shrink-0">
                  <FileDown className="w-5 h-5" />
                </div>
                <div>
                  <h2
                    id="pdf-confirm-title"
                    className="font-display font-bold text-navy-900"
                  >
                    PDF İndirilsin mi?
                  </h2>
                  <p className="text-sm text-navy-600 mt-1">
                    Analiz raporu yüksek kaliteli bir PDF olarak hazırlanacak.
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="btn-secondary"
                >
                  İptal
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  className="btn-primary"
                >
                  <Download className="w-4 h-4" />
                  İndir
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

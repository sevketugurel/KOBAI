import { useCallback, useState } from "react";
import { useDropzone, type FileRejection } from "react-dropzone";
import { motion, AnimatePresence } from "framer-motion";
import { UploadCloud, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { uploadInvoice } from "../../api/client";
import { cn } from "../../lib/utils";
import type { InvoiceData } from "../../api/types";

type State =
  | { kind: "idle" }
  | { kind: "uploading"; name: string }
  | { kind: "success"; name: string }
  | { kind: "error"; message: string };

type StateKind = State["kind"] | "dragging";

type Props = {
  onUploadSuccess: (invoiceId: string, data: InvoiceData) => void;
};

const STATE_BORDER: Record<StateKind, string> = {
  idle: "border-border bg-surface hover:bg-navy-50/30",
  dragging: "border-navy-500 bg-navy-50",
  uploading: "border-navy-300 bg-surface",
  success: "border-emerald-500 bg-emerald-50/50",
  error: "border-red-400 bg-red-50/50",
};

const variantTransition = { duration: 0.18 };
const variantProps = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: variantTransition,
};

export default function UploadZone({ onUploadSuccess }: Props) {
  const [state, setState] = useState<State>({ kind: "idle" });

  const onDrop = useCallback(
    async (accepted: File[], rejected: FileRejection[]) => {
      if (rejected.length > 0) {
        setState({ kind: "error", message: "Sadece 10 MB altı PDF dosyaları yükleyebilirsiniz." });
        return;
      }
      const f = accepted[0];
      if (!f) return;
      setState({ kind: "uploading", name: f.name });
      try {
        const r = await uploadInvoice(f);
        setState({ kind: "success", name: f.name });
        onUploadSuccess(r.invoice_id, r.data);
      } catch (e) {
        setState({ kind: "error", message: e instanceof Error ? e.message : "Yükleme hatası" });
      }
    },
    [onUploadSuccess]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    maxSize: 10 * 1024 * 1024,
    multiple: false,
  });

  const visualKind: StateKind = isDragActive && state.kind === "idle" ? "dragging" : state.kind;

  return (
    <div className="w-full">
      <div
        {...getRootProps()}
        className={cn(
          "relative p-12 rounded-2xl border-2 border-dashed cursor-pointer transition-colors duration-200",
          STATE_BORDER[visualKind]
        )}
      >
        <input {...getInputProps()} aria-label="PDF yükle" />
        <div className="flex flex-col items-center gap-3 text-center min-h-[180px] justify-center">
          <AnimatePresence mode="wait">
            {visualKind === "idle" && (
              <motion.div key="idle" {...variantProps} className="flex flex-col items-center gap-3">
                <UploadCloud className="w-12 h-12 text-navy-400" />
                <p className="font-medium text-navy-900">PDF faturalarınızı buraya bırakın</p>
                <p className="text-sm text-navy-600">
                  veya{" "}
                  <span className="text-navy-700 font-medium underline-offset-2 hover:underline">
                    dosya seçin
                  </span>
                </p>
              </motion.div>
            )}

            {visualKind === "dragging" && (
              <motion.div
                key="dragging"
                {...variantProps}
                className="flex flex-col items-center gap-3"
              >
                <motion.div
                  animate={{ scale: 1.12 }}
                  transition={{ type: "spring", stiffness: 240, damping: 14 }}
                >
                  <UploadCloud className="w-12 h-12 text-navy-500" />
                </motion.div>
                <p className="font-medium text-navy-900">Bırakın, ekleyelim.</p>
                <p className="text-sm text-navy-600">
                  veya{" "}
                  <span className="text-navy-700 font-medium underline-offset-2 hover:underline">
                    dosya seçin
                  </span>
                </p>
              </motion.div>
            )}

            {visualKind === "uploading" && state.kind === "uploading" && (
              <motion.div
                key="uploading"
                {...variantProps}
                className="flex flex-col items-center gap-3 pointer-events-none"
              >
                <Loader2 className="w-12 h-12 text-navy-500 animate-spin" />
                <p className="font-medium text-navy-900">Yükleniyor…</p>
                <p className="text-sm text-navy-600 max-w-full truncate">{state.name}</p>
                <div className="w-48 h-1.5 bg-navy-100 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-navy-500"
                    initial={{ width: "0%" }}
                    animate={{ width: "85%" }}
                    transition={{ duration: 1.8, ease: "easeInOut" }}
                  />
                </div>
              </motion.div>
            )}

            {visualKind === "success" && state.kind === "success" && (
              <motion.div
                key="success"
                {...variantProps}
                className="flex flex-col items-center gap-3"
              >
                <motion.div
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 260, damping: 16 }}
                >
                  <CheckCircle2 className="w-12 h-12 text-emerald-500" />
                </motion.div>
                <p className="font-medium text-emerald-700">Yükleme tamamlandı</p>
                <p className="text-sm text-navy-600 truncate">{state.name}</p>
              </motion.div>
            )}

            {visualKind === "error" && state.kind === "error" && (
              <motion.div
                key="error"
                {...variantProps}
                className="flex flex-col items-center gap-3"
              >
                <AlertCircle className="w-12 h-12 text-red-500" />
                <p className="font-medium text-red-700">Yükleme başarısız</p>
                <p className="text-sm text-navy-600 max-w-md">{state.message}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      <p className="text-2xs text-navy-400 mt-3 text-center">PDF, maks. 10MB</p>
    </div>
  );
}

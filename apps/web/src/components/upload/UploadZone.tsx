import { useCallback, useState } from "react";
import { useDropzone, type FileRejection } from "react-dropzone";
import { uploadInvoice } from "../../api/client";
import type { InvoiceData } from "../../api/types";

type State = { kind: "idle" } | { kind: "uploading"; name: string } | { kind: "success"; name: string } | { kind: "error"; message: string };

export default function UploadZone({ onUploadSuccess }: { onUploadSuccess: (invoiceId: string, data: InvoiceData) => void }) {
  const [state, setState] = useState<State>({ kind: "idle" });

  const onDrop = useCallback(async (accepted: File[], rejected: FileRejection[]) => {
    if (rejected.length > 0) {
      setState({ kind: "error", message: "Sadece 10 MB altı PDF dosyaları yükleyebilirsiniz." });
      return;
    }
    const f = accepted[0]; if (!f) return;
    setState({ kind: "uploading", name: f.name });
    try {
      const r = await uploadInvoice(f);
      setState({ kind: "success", name: f.name });
      onUploadSuccess(r.invoice_id, r.data);
    } catch (e) {
      setState({ kind: "error", message: e instanceof Error ? e.message : "Yükleme hatası" });
    }
  }, [onUploadSuccess]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: { "application/pdf": [".pdf"] }, maxSize: 10 * 1024 * 1024, multiple: false,
  });

  const border = state.kind === "error" ? "border-red-400" : isDragActive ? "border-emerald-500" : "border-stone-300";
  return (
    <div {...getRootProps()} className={`border-2 border-dashed rounded p-8 text-center cursor-pointer ${border}`}>
      <input {...getInputProps()} aria-label="PDF yükle" />
      {state.kind === "idle" && <p>Fatura PDF'sini buraya sürükleyin veya tıklayın</p>}
      {state.kind === "uploading" && <p>Yükleniyor: {state.name}…</p>}
      {state.kind === "success" && <p className="text-emerald-700">✓ {state.name}</p>}
      {state.kind === "error" && <p className="text-red-700">{state.message}</p>}
    </div>
  );
}

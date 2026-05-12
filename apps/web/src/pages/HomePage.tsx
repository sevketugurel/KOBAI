import { useState } from "react";
import { useNavigate } from "react-router-dom";
import UploadZone from "../components/upload/UploadZone";
import OnboardingWizard, { type OnboardingPayload } from "../components/onboarding/OnboardingWizard";
import { startAnalysis } from "../api/client";

export default function HomePage() {
  const [invoiceIds, setInvoiceIds] = useState<string[]>([]);
  const [stage, setStage] = useState<"upload" | "wizard" | "starting">("upload");
  const navigate = useNavigate();

  const onComplete = async (p: OnboardingPayload) => {
    setStage("starting");
    const r = await startAnalysis({ invoice_ids: invoiceIds, ...p });
    navigate(`/dashboard/${r.job_id}`);
  };

  return (
    <main className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-semibold">KOBİ Advisor</h1>
      <p className="text-stone-600">Faturalarınızı yükleyin, AI CFO'nuz analiz etsin.</p>
      {stage === "upload" && (
        <div className="space-y-4">
          <UploadZone onUploadSuccess={(id) => setInvoiceIds(ids => [...ids, id])} />
          <div className="text-sm text-stone-600">Yüklenen fatura: {invoiceIds.length}</div>
          {invoiceIds.length > 0 && (
            <button onClick={() => setStage("wizard")} className="px-4 py-2 bg-emerald-600 text-white rounded">Devam et</button>
          )}
        </div>
      )}
      {stage === "wizard" && <OnboardingWizard onComplete={onComplete} />}
      {stage === "starting" && <p>Analiz başlatılıyor…</p>}
    </main>
  );
}

import { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Sparkles, Search, Scale, ArrowRight, CheckCircle2, FileText } from "lucide-react";
import UploadZone from "../components/upload/UploadZone";
import OnboardingWizard, { type OnboardingPayload } from "../components/onboarding/OnboardingWizard";
import { Navbar } from "../components/layout/Navbar";
import LoadingSpinner from "../components/shared/LoadingSpinner";
import { useToast } from "../components/shared/Toast";
import { startAnalysis } from "../api/client";
import { formatTRY } from "../lib/utils";
import type { InvoiceData } from "../api/types";

type StoredInvoice = { id: string; data: InvoiceData };

export default function HomePage() {
  const [invoices, setInvoices] = useState<StoredInvoice[]>([]);
  const [stage, setStage] = useState<"upload" | "wizard" | "starting">("upload");
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleUpload = (id: string, data: InvoiceData) =>
    setInvoices((prev) => [...prev, { id, data }]);

  const onComplete = async (p: OnboardingPayload) => {
    setStage("starting");
    const r = await startAnalysis({ invoice_ids: invoices.map((i) => i.id), ...p });
    navigate(`/dashboard/${r.job_id}`);
  };

  const loadDemoData = () => {
    toast({
      variant: "info",
      title: "Demo yükleniyor",
      description: "Ahmet Usta Fırını verisi kuzey-market'e açılıyor…",
    });
    navigate("/dashboard/kuzey-market?demo=1");
  };

  return (
    <>
      <Navbar />
      <main className="min-h-[calc(100vh-4rem)] bg-hero-grid">
        <section className="max-w-7xl mx-auto px-6">
          <HeroSection onDemo={loadDemoData} />
          {stage === "upload" && (
            <UploadSection
              invoices={invoices}
              onUploadSuccess={handleUpload}
              onNext={() => setStage("wizard")}
            />
          )}
          {stage === "wizard" && (
            <div className="py-10">
              <OnboardingWizard onComplete={onComplete} />
            </div>
          )}
          {stage === "starting" && <StartingSection />}
        </section>
      </main>
    </>
  );
}

function HeroSection({ onDemo }: { onDemo: () => void }) {
  return (
    <div className="grid md:grid-cols-2 gap-10 items-center py-16">
      <div className="flex flex-col gap-6">
        <h1 className="font-display font-extrabold text-3xl md:text-5xl text-balance text-navy-900 leading-tight">
          Türkiye'nin İlk AI Mali Müşaviri
        </h1>
        <p className="text-lg text-navy-600 max-w-md">
          KDV, SGK ve nakit akışı — tek yüklemede anlık analiz.
        </p>
        <div className="flex flex-wrap gap-2">
          <span className="badge bg-navy-50 text-navy-700 px-3 py-1.5">
            <Sparkles className="w-3.5 h-3.5" /> Gemini AI
          </span>
          <span className="badge bg-navy-50 text-navy-700 px-3 py-1.5">
            <Search className="w-3.5 h-3.5" /> Anlık RAG
          </span>
          <span className="badge bg-navy-50 text-navy-700 px-3 py-1.5">
            <Scale className="w-3.5 h-3.5" /> Türk Mevzuatı
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <a href="#upload" className="btn-primary">
            Hemen Başla <ArrowRight className="w-4 h-4" />
          </a>
          <button onClick={onDemo} className="btn-ghost">
            Demo ile Dene
          </button>
        </div>
      </div>

      <motion.div
        className="card p-6 space-y-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <div className="flex items-center justify-between">
          <span className="text-2xs uppercase tracking-wider text-navy-500">Önizleme</span>
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse-dot" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-border p-3">
            <div className="text-2xs uppercase tracking-wider text-navy-500">Gelir</div>
            <div className="font-display font-bold text-lg text-navy-900">₺ 124.500</div>
          </div>
          <div className="rounded-lg border border-border p-3">
            <div className="text-2xs uppercase tracking-wider text-navy-500">Gider</div>
            <div className="font-display font-bold text-lg text-navy-900">₺ 89.200</div>
          </div>
          <div className="rounded-lg border border-border p-3">
            <div className="text-2xs uppercase tracking-wider text-navy-500">Net</div>
            <div className="font-display font-bold text-lg text-navy-900">₺ 35.300</div>
          </div>
          <div className="rounded-lg border border-border p-3">
            <div className="text-2xs uppercase tracking-wider text-navy-500">Vergi</div>
            <div className="font-display font-bold text-lg text-navy-900">₺ 14.800</div>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-navy-600">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse-dot" /> Risk: Düşük
        </div>
      </motion.div>
    </div>
  );
}

function UploadSection({
  invoices,
  onUploadSuccess,
  onNext,
}: {
  invoices: StoredInvoice[];
  onUploadSuccess: (id: string, data: InvoiceData) => void;
  onNext: () => void;
}) {
  return (
    <section id="upload" className="pb-16 space-y-6">
      <header className="space-y-1">
        <h2 className="font-display text-2xl text-navy-900">Faturalarınızı Yükleyin</h2>
        <p className="text-sm text-navy-600">
          PDF faturalarınızı sürükle-bırak ya da dosya seçerek ekleyin.
        </p>
      </header>

      <UploadZone onUploadSuccess={onUploadSuccess} />

      {invoices.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="badge bg-emerald-50 text-emerald-700">
              <CheckCircle2 className="w-3.5 h-3.5" /> {invoices.length} fatura yüklendi
            </span>
            <button onClick={onNext} className="btn-primary">
              Analizi Başlat <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          <ul className="space-y-2">
            {invoices.map(({ id, data }) => (
              <li key={id} className="card p-3 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-navy-50 flex items-center justify-center text-navy-600 flex-shrink-0">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-navy-900 truncate">{data.vendor_name}</div>
                    <div className="text-xs text-navy-500">{data.date}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="badge bg-navy-50 text-navy-600">{data.category}</span>
                  <span className="font-display font-bold text-navy-900">
                    {formatTRY(data.total_amount)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function StartingSection() {
  return (
    <section className="py-20 flex justify-center">
      <LoadingSpinner label="Ajanlar çalışıyor…" />
    </section>
  );
}

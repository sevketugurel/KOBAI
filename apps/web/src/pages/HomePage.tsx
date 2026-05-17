import { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  Clock3,
  FileText,
  Landmark,
  Scale,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import UploadZone from "../components/upload/UploadZone";
import OnboardingWizard, { type OnboardingPayload } from "../components/onboarding/OnboardingWizard";
import { Navbar } from "../components/layout/Navbar";
import LoadingSpinner from "../components/shared/LoadingSpinner";
import { useToast } from "../components/shared/Toast";
import { startAnalysis } from "../api/client";
import { formatTRY } from "../lib/utils";
import type { InvoiceData } from "../api/types";

type StoredInvoice = { id: string; data: InvoiceData };

const SIGNAL_CARDS = [
  {
    title: "Tahmini nakit açığı",
    value: "12 gün önce uyar",
    detail: "Banka, POS ve fatura akışını birlikte okuyup erken alarm üretir.",
    tone: "amber",
  },
  {
    title: "Vergi kör noktası",
    value: "KDV + Muhtasar",
    detail: "Mevzuat RAG, sadece genel bilgi değil tenant bağlamlı aksiyon önerir.",
    tone: "navy",
  },
  {
    title: "Operasyon riski",
    value: "Tedarikçi yoğunlaşması",
    detail: "Gider baskısını ve marj kaymasını erken görmek için doğru yüzey.",
    tone: "emerald",
  },
] as const;

const FEATURE_PILLARS = [
  {
    icon: BrainCircuit,
    eyebrow: "AI Katmanı",
    title: "Soru cevap değil, çalışan finans copilotu",
    description:
      "Ajanlar event bazlı koşar; veri geldiğinde yeniden düşünür, snapshot üretir ve önerileri günceller.",
  },
  {
    icon: Landmark,
    eyebrow: "Bağlam",
    title: "Banka, POS, fatura ve vergi takvimi aynı tenant hafızasında",
    description:
      "Private RAG ve structured tenant context ile yanıtlar soyut değil, işletmenin kendi durumuna bağlıdır.",
  },
  {
    icon: ShieldCheck,
    eyebrow: "Güven",
    title: "Kaynaklı mevzuat ve açıklanabilir risk mantığı",
    description:
      "Rule-based çekirdek korunur; AI katmanı bunun üstüne neden, etki ve sonraki adımı açıklar.",
  },
] as const;

const EXECUTION_STEPS = [
  "Belgeleri veya entegrasyon verisini içeri al",
  "Ajanlar nakit, risk, vergi ve destek alanlarını tarasın",
  "Dashboard ve AI panelinde aksiyon listesi üret",
] as const;

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
      <main className="min-h-[calc(100vh-4rem)] overflow-hidden bg-hero-grid">
        <section className="mx-auto max-w-7xl px-6">
          <HeroSection onDemo={loadDemoData} />
          <TrustSection />
          <SignalsSection />
          <FeatureSection />
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
    <div className="grid gap-12 py-16 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:py-24">
      <div className="relative flex flex-col gap-7">
        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-navy-200 bg-white/80 px-3 py-1.5 text-xs font-semibold text-navy-700 shadow-sm backdrop-blur">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-navy-600 text-white">
            <Sparkles className="h-3 w-3" />
          </span>
          KOBİ'ler için AI CFO işletim katmanı
        </div>

        <div className="space-y-5">
          <h1 className="max-w-3xl font-display text-4xl font-extrabold leading-tight text-balance text-navy-950 md:text-6xl">
            Finansal kör noktaları sohbet etmeden önce bulan bir AI sistem.
          </h1>
          <p className="max-w-2xl text-lg leading-8 text-navy-600 md:text-xl">
            KOBİ Advisor; fatura, banka, POS ve vergi takvimini tek tenant bağlamında
            birleştirir. Sadece rapor üretmez, riskin nedenini, etkisini ve bir sonraki
            hamleyi çıkarır.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="badge bg-white px-3 py-1.5 text-navy-700 shadow-sm">
            <Search className="w-3.5 h-3.5" /> Tenant-Aware RAG
          </span>
          <span className="badge bg-white px-3 py-1.5 text-navy-700 shadow-sm">
            <Scale className="w-3.5 h-3.5" /> Kaynaklı Türk Mevzuatı
          </span>
          <span className="badge bg-white px-3 py-1.5 text-navy-700 shadow-sm">
            <Activity className="w-3.5 h-3.5" /> Event-Driven Ajanlar
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <a href="#upload" className="btn-primary">
            Analizi Başlat <ArrowRight className="w-4 h-4" />
          </a>
          <button onClick={onDemo} className="btn-secondary">
            Demo ile Dene
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {EXECUTION_STEPS.map((step, index) => (
            <div
              key={step}
              className="rounded-2xl border border-white/70 bg-white/70 p-4 shadow-sm backdrop-blur"
            >
              <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-full bg-navy-900 text-sm font-bold text-white">
                0{index + 1}
              </div>
              <p className="text-sm leading-6 text-navy-700">{step}</p>
            </div>
          ))}
        </div>
      </div>

      <motion.div
        className="relative"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.45 }}
      >
        <div className="absolute -left-8 top-10 hidden h-40 w-40 rounded-full bg-emerald-200/60 blur-3xl lg:block" />
        <div className="absolute -right-6 bottom-8 hidden h-48 w-48 rounded-full bg-navy-200/70 blur-3xl lg:block" />

        <div className="relative rounded-[28px] border border-white/70 bg-white/90 p-5 shadow-[0_24px_80px_rgba(8,20,41,0.14)] backdrop-blur">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <div className="text-2xs uppercase tracking-[0.24em] text-navy-500">Canlı Sistem Mantığı</div>
              <div className="mt-1 font-display text-xl font-bold text-navy-950">
                Kuzey Market / Mayıs Özeti
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse-dot" />
              Güncel
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <MetricCard label="Bu ay net akış" value="₺ 182.400" tone="navy" />
            <MetricCard label="Yaklaşan yükümlülük" value="₺ 46.800" tone="amber" />
            <MetricCard label="Başarılı POS satış" value="₺ 318.250" tone="emerald" />
            <MetricCard label="Risk seviyesi" value="Orta / izlenmeli" tone="navy" />
          </div>

          <div className="mt-5 grid gap-4">
            <div className="rounded-2xl border border-border bg-background/80 p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-sm font-semibold text-navy-900">Ajan Çıktısı</div>
                <span className="badge bg-amber-50 text-amber-700">
                  <Clock3 className="h-3.5 w-3.5" /> Erken uyarı
                </span>
              </div>
              <p className="text-sm leading-6 text-navy-700">
                Son 2 dönemde POS satış büyümesine rağmen tedarikçi gider yoğunlaşması
                artmış görünüyor. Önümüzdeki vergi penceresi öncesinde stok alımı ve nakit
                çıkışı tekrar dengelenmeli.
              </p>
            </div>

            <div className="rounded-2xl bg-navy-950 p-4 text-white">
              <div className="mb-3 flex items-center gap-2 text-emerald-300">
                <TrendingUp className="h-4 w-4" />
                <span className="text-xs font-semibold uppercase tracking-[0.18em]">
                  Sonraki Aksiyon
                </span>
              </div>
              <ul className="space-y-2 text-sm leading-6 text-navy-100">
                <li>3 büyük tedarikçide vade ve fiyat yeniden görüşülsün.</li>
                <li>Bekleyen KDV kalemleri ödeme önceliğine alınsın.</li>
                <li>Haziran ilk haftası için stres senaryosu çalıştırılsın.</li>
              </ul>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "navy" | "emerald" | "amber";
}) {
  const toneMap = {
    navy: "bg-navy-50 text-navy-900",
    emerald: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
  } as const;

  return (
    <div className={`rounded-2xl border border-border p-4 ${toneMap[tone]}`}>
      <div className="text-2xs uppercase tracking-[0.2em] opacity-70">{label}</div>
      <div className="mt-2 font-display text-xl font-bold">{value}</div>
    </div>
  );
}

function TrustSection() {
  return (
    <section className="pb-8">
      <div className="grid gap-4 rounded-[28px] border border-white/70 bg-white/80 p-6 shadow-card backdrop-blur lg:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-2">
          <div className="text-2xs font-semibold uppercase tracking-[0.24em] text-navy-500">
            Neden farklı
          </div>
          <h2 className="font-display text-2xl font-bold text-navy-950">
            Finans dashboard&apos;u değil, karar destek katmanı
          </h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <TrustStat label="Kaynaklı mevzuat" value="GVK / KDV / SGK" />
          <TrustStat label="Çalışan ajanlar" value="Nakit / Risk / RAG / KOSGEB" />
          <TrustStat label="Hedef çıktı" value="Uyarı + aksiyon + gerekçe" />
        </div>
      </div>
    </section>
  );
}

function TrustStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-background/70 p-4">
      <div className="text-2xs uppercase tracking-[0.2em] text-navy-500">{label}</div>
      <div className="mt-2 text-sm font-semibold text-navy-900">{value}</div>
    </div>
  );
}

function SignalsSection() {
  return (
    <section className="py-10">
      <div className="mb-6 max-w-2xl space-y-2">
        <div className="text-2xs font-semibold uppercase tracking-[0.24em] text-navy-500">
          AI için en kritik yüzeyler
        </div>
        <h2 className="font-display text-3xl font-bold text-navy-950">
          Değeri raporda değil, doğru anda üretilen içgörüde yaratın
        </h2>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {SIGNAL_CARDS.map((card, index) => (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.35, delay: index * 0.08 }}
            className="card p-6"
          >
            <span
              className={[
                "badge px-3 py-1.5",
                card.tone === "amber"
                  ? "bg-amber-50 text-amber-700"
                  : card.tone === "emerald"
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-navy-50 text-navy-700",
              ].join(" ")}
            >
              İçgörü Alanı
            </span>
            <div className="mt-5 font-display text-2xl font-bold text-navy-950">{card.value}</div>
            <div className="mt-2 text-lg font-semibold text-navy-900">{card.title}</div>
            <p className="mt-3 text-sm leading-6 text-navy-600">{card.detail}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

function FeatureSection() {
  return (
    <section className="py-10">
      <div className="grid gap-4 lg:grid-cols-3">
        {FEATURE_PILLARS.map(({ icon: Icon, eyebrow, title, description }, index) => (
          <motion.div
            key={title}
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.35, delay: index * 0.08 }}
            className="rounded-[28px] border border-navy-100 bg-navy-950 p-6 text-white shadow-card"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-emerald-300">
              <Icon className="h-5 w-5" />
            </div>
            <div className="mt-6 text-2xs font-semibold uppercase tracking-[0.22em] text-navy-300">
              {eyebrow}
            </div>
            <h3 className="mt-2 font-display text-2xl font-bold leading-tight">{title}</h3>
            <p className="mt-4 text-sm leading-6 text-navy-100/85">{description}</p>
          </motion.div>
        ))}
      </div>
    </section>
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
    <section id="upload" className="space-y-6 pb-20 pt-8">
      <header className="space-y-2">
        <div className="text-2xs font-semibold uppercase tracking-[0.24em] text-navy-500">
          İlk adım
        </div>
        <h2 className="font-display text-3xl text-navy-950">Belgelerinizi içeri alın</h2>
        <p className="text-sm text-navy-600">
          PDF faturalarınızı sürükle-bırak ile yükleyin. Sonraki aşamada şirket tipi ve
          sektör bağlamını alıp ilk analizi başlatacağız.
        </p>
      </header>

      <UploadZone onUploadSuccess={onUploadSuccess} />

      {invoices.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <span className="badge bg-emerald-50 text-emerald-700">
              <CheckCircle2 className="w-3.5 h-3.5" /> {invoices.length} fatura yüklendi
            </span>
            <button onClick={onNext} className="btn-primary">
              Analizi Başlat <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          <ul className="space-y-2">
            {invoices.map(({ id, data }) => (
              <li key={id} className="card flex items-center justify-between gap-4 p-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-navy-50 text-navy-600">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate font-medium text-navy-900">{data.vendor_name}</div>
                    <div className="text-xs text-navy-500">{data.date}</div>
                  </div>
                </div>
                <div className="flex flex-shrink-0 items-center gap-3">
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
    <section className="flex justify-center py-20">
      <LoadingSpinner label="Ajanlar çalışıyor…" />
    </section>
  );
}

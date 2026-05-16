import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useSearchParams } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  Bot,
  Building2,
  Calendar,
  CreditCard,
  Download,
  FileText,
  Link2,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  TrendingUp,
  UploadCloud,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  Card,
  EmptyState,
  KpiCard,
  PageHeader,
  StatusBadge,
} from "../components/ui";
import ChatPanelV2 from "../components/chat/ChatPanelV2";
import AgentTrace from "../components/dashboard/AgentTrace";
import { useTenantDashboard } from "../hooks/useTenantDashboard";
import { cn, formatDate, formatDateTime, formatRelative, formatTRY } from "../lib/utils";
import { isMockMode, v2 } from "../api/v2";
import type {
  AnalysisResult,
  DashboardActivity,
  DashboardSummary,
  InvoiceUploadOut,
  RiskLabel,
  TaxCalendarItem,
} from "../api/v2";

function toNumber(s: string | null | undefined): number {
  if (s == null) return 0;
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function taxStatusVariant(item: TaxCalendarItem) {
  if (item.status === "overdue") return "danger" as const;
  if (item.status === "paid") return "success" as const;
  return "warning" as const;
}

function activityIcon(type: DashboardActivity["type"]) {
  if (type === "bank") return <Building2 size={16} />;
  if (type === "pos") return <CreditCard size={16} />;
  return <Calendar size={16} />;
}

function getOrCreateSessionId(slug: string): string {
  if (typeof window === "undefined" || !slug) return "default";
  const key = `kobai.chat.session.${slug}`;
  let id = window.localStorage.getItem(key);
  if (!id) {
    id = (window.crypto?.randomUUID?.() ?? `s-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    window.localStorage.setItem(key, id);
  }
  return id;
}

function getStoredJobId(slug: string): string | null {
  if (!slug) return null;
  if (isMockMode) return `mock-job-${slug}`;
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(`kobai.analysis.job.${slug}`);
}

function storeJobId(slug: string, jobId: string) {
  if (typeof window === "undefined" || !slug) return;
  window.localStorage.setItem(`kobai.analysis.job.${slug}`, jobId);
}

function riskCopy(label?: RiskLabel) {
  if (label === "green") return { label: "Düşük", className: "text-emerald-700 bg-emerald-50 border-emerald-200" };
  if (label === "red") return { label: "Yüksek", className: "text-red-700 bg-red-50 border-red-200" };
  return { label: "Orta", className: "text-amber-700 bg-amber-50 border-amber-200" };
}

function confidenceLabel(value: number) {
  return `${Math.round(value * 20)}% güven`;
}

function AnalysisBadge({ analysis }: { analysis?: AnalysisResult }) {
  if (!analysis) return <span className="badge bg-navy-50 text-navy-600">Analiz bekliyor</span>;
  if (analysis.status === "completed") return <span className="badge bg-emerald-50 text-emerald-700">Tamamlandı</span>;
  if (analysis.status === "failed") return <span className="badge bg-red-50 text-red-700">Hata</span>;
  return <span className="badge bg-amber-50 text-amber-700">Çalışıyor</span>;
}

function AnalysisControlPanel({
  slug,
  analysis,
  uploaded,
  selectedDocumentIds,
  uploadPending,
  startPending,
  reportPending,
  approvePending,
  onUpload,
  onStart,
  onApprove,
  onDownloadReport,
}: {
  slug: string;
  analysis?: AnalysisResult;
  uploaded: InvoiceUploadOut[];
  selectedDocumentIds: string[];
  uploadPending: boolean;
  startPending: boolean;
  reportPending: boolean;
  approvePending: boolean;
  onUpload: (file: File) => void;
  onStart: () => void;
  onApprove: () => void;
  onDownloadReport: () => void;
}) {
  const completed = analysis?.status === "completed";
  const approved = Boolean(analysis?.approved);
  return (
    <Card>
      <Card.Header
        title="Belge ve Analiz"
        subtitle="Fatura, RAG ve ajan akışını tenant içinde çalıştırır"
        action={<AnalysisBadge analysis={analysis} />}
        className="flex-col sm:flex-row"
      />
      <Card.Body className="space-y-4">
        <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-navy-200 bg-navy-50/50 p-4 text-sm text-navy-700 hover:bg-navy-50">
          <UploadCloud size={18} className="shrink-0" />
          <span className="min-w-0 flex-1">
            {uploadPending ? "Fatura yükleniyor..." : "PDF fatura yükle"}
          </span>
          <input
            type="file"
            accept="application/pdf"
            className="sr-only"
            disabled={!slug || uploadPending}
            onChange={(e: ChangeEvent<HTMLInputElement>) => {
              const file = e.target.files?.[0];
              if (file) onUpload(file);
              e.target.value = "";
            }}
          />
        </label>

        <div className="space-y-2">
          {uploaded.length === 0 ? (
            <p className="text-xs text-navy-500">
              {isMockMode
                ? "Mock modda demo analizi belge yüklemeden de başlatılabilir."
                : "Fatura olmadan da banka, POS ve vergi takvimi verileriyle analiz başlatılabilir."}
            </p>
          ) : (
            uploaded.map((item) => (
              <div key={item.document_id} className="flex items-center gap-2 rounded-lg bg-surface-muted px-3 py-2">
                <FileText size={15} className="text-navy-500" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-navy-900">
                    {item.invoice.vendor_name}
                  </p>
                  <p className="text-xs text-navy-500">{formatTRY(item.invoice.total_amount)}</p>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={onStart}
            disabled={startPending}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-navy-700 px-3 text-sm font-medium text-white transition-colors hover:bg-navy-800 disabled:cursor-not-allowed disabled:opacity-45"
          >
            <Sparkles size={16} />
            {startPending ? "Başlatılıyor" : "Analiz Başlat"}
          </button>
          {completed && !approved ? (
            <button
              type="button"
              onClick={onApprove}
              disabled={approvePending}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 text-sm font-medium text-emerald-800 transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <ShieldCheck size={16} />
              {approvePending ? "Onaylanıyor" : "Analizi Onayla"}
            </button>
          ) : (
            <button
              type="button"
              onClick={onDownloadReport}
              disabled={!completed || !approved || reportPending}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border px-3 text-sm font-medium text-navy-700 transition-colors hover:bg-navy-50 disabled:cursor-not-allowed disabled:opacity-45"
              title={!approved ? "Önce analizi onaylayın" : undefined}
            >
              <Download size={16} />
              Rapor
            </button>
          )}
        </div>
      </Card.Body>
    </Card>
  );
}

function CashFlowPanel({ analysis }: { analysis?: AnalysisResult }) {
  const rows = analysis?.cash_flow_forecast ?? [];
  return (
    <Card className="xl:col-span-2">
      <Card.Header
        title="Nakit Akışı Projeksiyonu"
        subtitle="LangGraph nakit akışı ajanından 3 aylık görünüm"
      />
      <Card.Body className="h-80">
        {rows.length === 0 ? (
          <EmptyState
            icon={<Activity size={30} />}
            title="Analiz bekleniyor"
            message="Fatura analizi tamamlandığında tahmin grafiği burada görünür."
          />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={rows} margin={{ top: 12, right: 12, bottom: 4, left: 0 }}>
              <defs>
                <linearGradient id="cashNet" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="5%" stopColor="#16a34a" stopOpacity={0.26} />
                  <stop offset="95%" stopColor="#16a34a" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${Math.round(Number(v) / 1000)}K`} />
              <Tooltip formatter={(value) => formatTRY(Number(value))} />
              <Area type="monotone" dataKey="income" name="Gelir" stroke="#2563eb" fill="transparent" strokeWidth={2} />
              <Area type="monotone" dataKey="expense" name="Gider" stroke="#dc2626" fill="transparent" strokeWidth={2} />
              <Area type="monotone" dataKey="net" name="Net" stroke="#16a34a" fill="url(#cashNet)" strokeWidth={3} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </Card.Body>
    </Card>
  );
}

function RiskPanel({ analysis }: { analysis?: AnalysisResult }) {
  const risk = riskCopy(analysis?.risk_label);
  return (
    <Card>
      <Card.Header title="Risk Değerlendirmesi" subtitle="Risk ajanı skoru ve açıklaması" />
      <Card.Body className="space-y-4">
        <div className={cn("inline-flex items-center gap-2 rounded-lg border px-3 py-2", risk.className)}>
          {analysis?.risk_label === "green" ? <ShieldCheck size={18} /> : <AlertTriangle size={18} />}
          <span className="text-sm font-semibold">{risk.label} Risk</span>
        </div>
        <div>
          <p className="font-mono text-4xl font-semibold text-navy-900">
            {analysis?.risk_score ?? "-"}
            <span className="text-base text-navy-400">/5</span>
          </p>
          <p className="mt-2 text-sm leading-6 text-navy-600">
            {analysis?.risk_explanation ?? "Analiz tamamlandığında dönem risk açıklaması burada gösterilir."}
          </p>
        </div>
      </Card.Body>
    </Card>
  );
}

function TaxRecommendationsPanel({ analysis }: { analysis?: AnalysisResult }) {
  const rows = analysis?.tax_recommendations ?? [];
  return (
    <Card>
      <Card.Header title="RAG Vergi Önerileri" subtitle="Global mevzuat ve tenant belgeleri" />
      <Card.Body>
        {rows.length === 0 ? (
          <EmptyState
            icon={<ReceiptText size={30} />}
            title="Öneri yok"
            message="RAG ajanı çalıştığında kaynaklı öneriler listelenir."
          />
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((row, index) => (
              <li key={`${row.article}-${index}`} className="py-3 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="badge bg-navy-50 text-navy-700">{row.source}</span>
                  <span className="badge bg-emerald-50 text-emerald-700">{confidenceLabel(row.confidence)}</span>
                  {row.scope ? (
                    <span className="badge bg-amber-50 text-amber-700">
                      {row.scope === "private" ? "Tenant RAG" : "Global RAG"}
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 text-sm font-medium leading-6 text-navy-900">{row.recommendation}</p>
                <p className="mt-1 text-xs text-navy-500">{row.article}</p>
              </li>
            ))}
          </ul>
        )}
      </Card.Body>
    </Card>
  );
}

function KosgebPanel({ analysis }: { analysis?: AnalysisResult }) {
  const rows = analysis?.kosgeb_suggestions ?? [];
  return (
    <Card>
      <Card.Header title="KOSGEB Eşleşmeleri" subtitle="Sektör ve dönem verisine göre" />
      <Card.Body>
        {rows.length === 0 ? (
          <EmptyState
            icon={<Bot size={30} />}
            title="Eşleşme yok"
            message="Destek ajanı çalıştığında program önerileri burada görünür."
          />
        ) : (
          <ul className="space-y-3">
            {rows.map((row) => (
              <li key={row.title} className="rounded-lg border border-border p-3">
                <p className="font-medium text-navy-900">{row.title}</p>
                <p className="mt-1 text-sm leading-6 text-navy-600">{row.detail}</p>
              </li>
            ))}
          </ul>
        )}
      </Card.Body>
    </Card>
  );
}

function ActivitiesPanel({
  isLoading,
  summary,
  filteredActivities,
  activityFilter,
  setActivityFilter,
}: {
  isLoading: boolean;
  summary?: DashboardSummary;
  filteredActivities: DashboardActivity[];
  activityFilter: "all" | DashboardActivity["type"];
  setActivityFilter: (filter: "all" | DashboardActivity["type"]) => void;
}) {
  return (
    <Card>
      <Card.Header
        title="Son Operasyon Aktiviteleri"
        subtitle="Banka, POS ve vergi hareketleri tek tenant zaman çizgisinde"
        className="flex-col sm:flex-row"
        action={
          <div className="flex flex-wrap rounded-lg border border-border bg-background p-1">
            {[
              ["all", "Tümü"],
              ["bank", "Banka"],
              ["pos", "POS"],
              ["tax", "Vergi"],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setActivityFilter(key as typeof activityFilter)}
                className={cn(
                  "rounded-md px-3 py-1 text-xs transition-colors",
                  activityFilter === key
                    ? "bg-navy-900 text-white"
                    : "text-neutral-600 hover:bg-navy-50",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        }
      />
      <Card.Body>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="skeleton h-12" />
            ))}
          </div>
        ) : !summary || filteredActivities.length === 0 ? (
          <EmptyState
            icon={<Building2 size={28} />}
            title="Aktivite yok"
            message="Seçili filtre için hareket bulunmuyor."
          />
        ) : (
          <ul className="divide-y divide-border">
            {filteredActivities.map((a, i) => {
              const amount = toNumber(a.amount);
              const positive = amount >= 0;
              return (
                <li
                  key={a.id}
                  className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 py-3 animate-slide-up"
                  style={{ animationDelay: `${i * 35}ms` }}
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-navy-50 text-navy-500">
                    {activityIcon(a.type)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-navy-900">{a.title}</p>
                    <p className="text-xs text-navy-500">{formatRelative(a.timestamp)}</p>
                  </div>
                  {a.amount != null ? (
                    <span
                      className={cn(
                        "whitespace-nowrap font-mono text-sm tabular-nums",
                        positive ? "text-emerald-600" : "text-red-600",
                      )}
                    >
                      {formatTRY(amount)}
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </Card.Body>
    </Card>
  );
}

export default function TenantDashboard() {
  const { slug = "" } = useParams<{ slug: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const qc = useQueryClient();
  const { data, isLoading, isError } = useTenantDashboard(slug);
  const summary = data as DashboardSummary | undefined;
  const [activityFilter, setActivityFilter] = useState<"all" | DashboardActivity["type"]>("all");
  const [uploaded, setUploaded] = useState<InvoiceUploadOut[]>([]);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([]);
  const [activeJobId, setActiveJobId] = useState<string | null>(() => getStoredJobId(slug));

  const netFlow = toNumber(summary?.net_flow_this_month);
  const posSales = toNumber(summary?.pos_sales_this_month);
  const upcomingTaxTotal = (summary?.upcoming_taxes ?? []).reduce(
    (sum, item) => sum + toNumber(item.amount),
    0,
  );
  const sessionId = useMemo(() => getOrCreateSessionId(slug), [slug]);
  const filteredActivities = (summary?.recent_activities ?? []).filter(
    (a) => activityFilter === "all" || a.type === activityFilter,
  );

  const analysis = useQuery({
    queryKey: ["tenant-analysis", slug, activeJobId],
    queryFn: () => v2.getAnalysis(slug, activeJobId as string),
    enabled: Boolean(slug && activeJobId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "pending" || status === "processing" ? 2000 : false;
    },
  });

  const upload = useMutation({
    mutationFn: (file: File) => v2.uploadInvoice(slug, file),
    onSuccess: (result) => {
      setUploaded((rows) => [result, ...rows.filter((row) => row.document_id !== result.document_id)]);
      setSelectedDocumentIds((ids) => Array.from(new Set([result.document_id, ...ids])));
    },
  });

  const start = useMutation({
    mutationFn: async () => {
      return v2.startAnalysis(slug, {
        document_ids: selectedDocumentIds,
        period: new Date().toISOString().slice(0, 7),
        include_all_tenant_data: true,
      });
    },
    onSuccess: (result) => {
      setActiveJobId(result.job_id);
      storeJobId(slug, result.job_id);
      void qc.invalidateQueries({ queryKey: ["tenant-analysis", slug, result.job_id] });
    },
  });

  const demoLoad = useMutation({
    mutationFn: () => v2.loadDemo(slug),
    onSuccess: (r) => {
      setActiveJobId(r.job_id);
      storeJobId(slug, r.job_id);
      void qc.invalidateQueries({ queryKey: ["tenant-analysis", slug, r.job_id] });
    },
  });

  const demoAutoTriggered = useRef(false);
  useEffect(() => {
    if (demoAutoTriggered.current) return;
    if (searchParams.get("demo") !== "1") return;
    if (!slug || demoLoad.isPending || activeJobId) return;
    demoAutoTriggered.current = true;
    demoLoad.mutate();
    const next = new URLSearchParams(searchParams);
    next.delete("demo");
    setSearchParams(next, { replace: true });
  }, [searchParams, slug, activeJobId, demoLoad, setSearchParams]);

  const approve = useMutation({
    mutationFn: async () => {
      if (!activeJobId) throw new Error("Analiz bulunamadı");
      return v2.approveAnalysis(slug, activeJobId);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["tenant-analysis", slug, activeJobId] });
    },
  });

  const report = useMutation({
    mutationFn: async () => {
      if (!activeJobId) throw new Error("Analiz bulunamadı");
      return v2.downloadAnalysisReport(slug, activeJobId);
    },
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${slug || "tenant"}-analiz-raporu.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    },
  });

  const analysisData = analysis.data;
  const cashFlowNext = analysisData?.cash_flow_forecast?.[0]?.net ?? null;

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6 lg:px-8 space-y-8 animate-fade-in">
      <PageHeader
        title={`${slug} Dashboard`}
        subtitle={
          summary?.updated_at
            ? `Son güncelleme: ${formatDateTime(summary.updated_at)}`
            : "Veriler yükleniyor..."
        }
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <KpiCard
          label="Bu Ay Net Akış"
          value={formatTRY(netFlow)}
          icon={netFlow >= 0 ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
          loading={isLoading}
          className="xl:col-span-2"
        />
        <KpiCard
          label="Bu Ay POS Satışı"
          value={formatTRY(posSales)}
          icon={<CreditCard size={20} />}
          loading={isLoading}
        />
        <KpiCard
          label="Yaklaşan Vergi"
          value={`${summary?.upcoming_tax_count ?? 0} kalem`}
          icon={<Calendar size={20} />}
          loading={isLoading}
        />
        <KpiCard
          label="Vergi Tutarı"
          value={formatTRY(upcomingTaxTotal)}
          icon={<ReceiptText size={20} />}
          loading={isLoading}
        />
        <KpiCard
          label="Sonraki Ay Net"
          value={cashFlowNext == null ? "-" : formatTRY(cashFlowNext)}
          icon={<Activity size={20} />}
          loading={analysis.isLoading && Boolean(activeJobId)}
        />
      </section>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(380px,1fr)]">
        <main className="min-w-0 space-y-6">
          <section className="grid gap-6 xl:grid-cols-3">
            <CashFlowPanel analysis={analysisData} />
            <RiskPanel analysis={analysisData} />
          </section>

          <section className="grid gap-6 xl:grid-cols-2">
            <TaxRecommendationsPanel analysis={analysisData} />
            <KosgebPanel analysis={analysisData} />
          </section>

          <section className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
            <Card>
              <Card.Header
                title="Yaklaşan 3 Vergi Kalemi"
                subtitle="Önümüzdeki 30 gün içinde ödenmesi gerekenler"
              />
              <Card.Body>
                {isLoading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="skeleton h-12" />
                    ))}
                  </div>
                ) : !summary || summary.upcoming_taxes.length === 0 ? (
                  <EmptyState
                    icon={<Calendar size={32} />}
                    title="Yaklaşan vergi yok"
                    message="Önümüzdeki 30 gün için ödenmemiş vergi kalemi bulunmuyor."
                  />
                ) : (
                  <ul className="divide-y divide-border">
                    {summary.upcoming_taxes.map((item, i) => (
                      <li
                        key={item.id}
                        className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 py-3 animate-slide-up"
                        style={{ animationDelay: `${i * 50}ms` }}
                      >
                        <div className="min-w-0">
                          <p className="truncate font-display font-semibold text-navy-900">
                            {item.title}
                          </p>
                          <p className="mt-0.5 text-xs text-navy-500">
                            {item.tax_type.toUpperCase()}
                            {item.period ? ` - ${item.period}` : ""}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-3">
                          <StatusBadge variant={taxStatusVariant(item)} label={item.status} />
                          <span className="whitespace-nowrap font-mono text-sm tabular-nums text-navy-700">
                            {formatDate(item.due_date)}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Card.Body>
            </Card>

            <ActivitiesPanel
              isLoading={isLoading}
              summary={summary}
              filteredActivities={filteredActivities}
              activityFilter={activityFilter}
              setActivityFilter={setActivityFilter}
            />
          </section>

          {analysisData?.agent_trace?.length ? (
            <AgentTrace trace={analysisData.agent_trace} isLoading={analysis.isLoading} />
          ) : (
            <Card>
              <Card.Header title="Ajan Akışı" subtitle="LangGraph adımları ve çıktı özeti" />
              <Card.Body>
                <EmptyState
                  icon={<Bot size={30} />}
                  title="Ajan izi bekleniyor"
                  message="Analiz başladığında nakit akışı, risk, RAG ve KOSGEB ajanları burada izlenir."
                />
              </Card.Body>
            </Card>
          )}

          {isError || analysisData?.status === "failed" || upload.isError || start.isError || report.isError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {isError
                ? "Dashboard verisi yüklenemedi. Lütfen sayfayı yenileyin."
                : analysisData?.error ?? "İşlem tamamlanamadı. API bağlantısını ve tenant erişimini kontrol edin."}
            </div>
          ) : null}
        </main>

        <aside className="min-w-0 space-y-6 xl:sticky xl:top-24">
          <AnalysisControlPanel
            slug={slug}
            analysis={analysisData}
            uploaded={uploaded}
            selectedDocumentIds={selectedDocumentIds}
            uploadPending={upload.isPending}
            startPending={start.isPending}
            reportPending={report.isPending}
            approvePending={approve.isPending}
            onUpload={(file) => upload.mutate(file)}
            onStart={() => start.mutate()}
            onApprove={() => approve.mutate()}
            onDownloadReport={() => report.mutate()}
          />
          {slug ? <ChatPanelV2 slug={slug} sessionId={sessionId} jobId={activeJobId} /> : null}
        </aside>
      </div>
    </div>
  );
}

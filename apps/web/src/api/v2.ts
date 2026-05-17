/** v2 tenant-aware API çağrıları. v1 client.ts korunur; Faz 1'de paralel yaşar. */
import { supabase } from "../auth/supabaseClient";
import { mockV2 } from "./mockV2";

const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:8000";
export const isMockMode = import.meta.env.VITE_USE_MOCK === "true";

export interface TenantOut {
  id: string;
  slug: string;
  display_name: string;
  sector: string;
  company_type: string;
  tax_number: string | null;
  is_active: boolean;
  created_at: string;
}

export interface TenantCreate {
  slug: string;
  display_name: string;
  sector: string;
  company_type: string;
  tax_number?: string | null;
}

export interface MembershipOut {
  id: string;
  tenant_id: string;
  user_id: string;
  role: "owner" | "admin" | "member" | "viewer";
  created_at: string;
}

export interface InvoiceItem {
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
  kdv_rate: number;
}

export interface InvoiceData {
  invoice_id: string;
  vendor_name: string;
  vendor_tax_no: string | null;
  date: string;
  due_date: string | null;
  items: InvoiceItem[];
  subtotal: number;
  kdv_amount: number;
  total_amount: number;
  currency: string;
  category: string;
  raw_text: string | null;
}

export interface AgentStep {
  agent_name: string;
  action: string;
  status?: "running" | "completed" | "failed";
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  duration_ms: number;
  confidence: number;
}

export type RiskLabel = "green" | "yellow" | "red";
export type JobStatus = "pending" | "processing" | "completed" | "failed";

export interface CashFlowMonth {
  month: string;
  income: number;
  expense: number;
  net: number;
  kdv_payment: number;
  sgk_payment: number;
  cumulative: number;
}

export interface TaxRecommendation {
  recommendation: string;
  source: string;
  article: string;
  confidence: number;
  action: string;
  scope?: "global" | "private";
}

export interface KosgebSuggestion {
  title: string;
  detail: string;
  url?: string;
}

export type RiskPriority = "low" | "medium" | "high";
export type RiskTimeHorizon = "immediate" | "this_week" | "this_month";

export interface RecommendedAction {
  title: string;
  detail: string;
  priority: RiskPriority;
  due_hint: string;
  source_agent: string;
}

export type AIPageKind = "dashboard" | "integrations" | "tax-calendar" | "pos";

export interface AIInsightCard {
  id: string;
  title: string;
  detail: string;
  tone?: "neutral" | "success" | "warning" | "danger";
  badge?: string;
}

export interface AIQuickAction {
  id: string;
  label: string;
  prompt: string;
}

export interface TenantPageAIView {
  page: AIPageKind;
  title: string;
  subtitle: string;
  summary: string;
  insights: AIInsightCard[];
  quick_actions: AIQuickAction[];
  sample_prompts: string[];
}

export interface AnalysisResult {
  job_id: string;
  status: JobStatus;
  invoices: InvoiceData[];
  cash_flow_forecast: CashFlowMonth[];
  risk_score: number;
  risk_label: RiskLabel;
  risk_explanation: string;
  risk_key_drivers?: string[];
  risk_recommended_actions?: RecommendedAction[];
  risk_priority?: RiskPriority;
  risk_time_horizon?: RiskTimeHorizon;
  tax_recommendations: TaxRecommendation[];
  kosgeb_suggestions: KosgebSuggestion[];
  agent_trace: AgentStep[];
  created_at: string;
  completed_at: string | null;
  error: string | null;
  approved?: boolean;
}

export interface InvoiceUploadOut {
  document_id: string;
  invoice: InvoiceData;
}

export interface AnalyzeRequestV2 {
  document_ids?: string[];
  period?: string | null;
  include_all_tenant_data?: boolean;
}

export interface JobStartedOut {
  job_id: string;
  status: "pending";
}

export class V2ApiError extends Error {
  constructor(public status: number, message: string, public detail?: unknown) {
    super(message);
  }
}

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function _json<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(await authHeader()),
    ...((init.headers as Record<string, string>) ?? {}),
  };
  const r = await fetch(`${BASE_URL}${path}`, { ...init, headers });
  if (!r.ok) {
    let detail: unknown = null;
    try {
      detail = await r.json();
    } catch {
      /* ignore */
    }
    throw new V2ApiError(r.status, `HTTP ${r.status}`, detail);
  }
  return (await r.json()) as T;
}

export interface BankTransaction {
  id: string;
  tenant_id: string;
  source_document_id: string | null;
  bank_name: string;
  account_iban: string | null;
  amount: string;
  currency: string;
  direction: "credit" | "debit";
  description: string | null;
  reference_no: string | null;
  category: string | null;
  transacted_at: string;
  created_at: string;
}

export interface BankImportResult {
  document_id: string;
  transactions_imported: number;
  transactions_skipped_duplicate: number;
  bank_name: string;
  period_start: string | null;
  period_end: string | null;
}

export interface Integration {
  id: string;
  provider: string;
  is_active: boolean;
  config: Record<string, unknown>;
  last_sync_at: string | null;
  last_error: string | null;
}

// Faz 7 — event-driven ajan snapshot'ı
export type AgentName =
  | "nakit_akisi"
  | "risk"
  | "mevzuat_rag"
  | "kosgeb"
  | "collections_agent"
  | "supplier_dependency_agent"
  | "margin_agent";
export type AgentSnapshotStatus =
  | "idle"
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "stale";

export interface AgentSnapshot {
  agent_name: AgentName;
  status: AgentSnapshotStatus;
  input_version_hash: string | null;
  output: Record<string, unknown> | null;
  trace: Array<Record<string, unknown>>;
  missing: string[];
  error: string | null;
  last_event: string | null;
  updated_at: string | null;
}

async function _multipart<T>(path: string, file: File): Promise<T> {
  const fd = new FormData();
  fd.append("file", file);
  const r = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: await authHeader(),
    body: fd,
  });
  if (!r.ok) {
    let detail: unknown = null;
    try {
      detail = await r.json();
    } catch {
      /* ignore */
    }
    throw new V2ApiError(r.status, `HTTP ${r.status}`, detail);
  }
  return (await r.json()) as T;
}

async function _blob(path: string, init: RequestInit = {}): Promise<Blob> {
  const headers: Record<string, string> = {
    ...(await authHeader()),
    ...((init.headers as Record<string, string>) ?? {}),
  };
  const r = await fetch(`${BASE_URL}${path}`, { ...init, headers });
  if (!r.ok) {
    let detail: unknown = null;
    try {
      detail = await r.json();
    } catch {
      /* ignore */
    }
    throw new V2ApiError(r.status, `HTTP ${r.status}`, detail);
  }
  return await r.blob();
}

async function claimDemoTenantIfAvailable(slug: string): Promise<boolean> {
  if (slug !== "kuzey-market") return false;
  const { error } = await supabase.rpc("claim_kuzey_market_demo");
  return !error;
}

async function getTenantWithDemoClaim(slug: string): Promise<TenantOut> {
  try {
    return await _json<TenantOut>(`/v2/tenants/${encodeURIComponent(slug)}`);
  } catch (e) {
    if (
      e instanceof V2ApiError &&
      (e.status === 403 || e.status === 404) &&
      await claimDemoTenantIfAvailable(slug)
    ) {
      return _json<TenantOut>(`/v2/tenants/${encodeURIComponent(slug)}`);
    }
    throw e;
  }
}

async function getTenantPageAIViewFallback(
  slug: string,
  page: AIPageKind,
): Promise<TenantPageAIView> {
  const dashboard = await _json<DashboardSummary>(
    `/v2/tenants/${encodeURIComponent(slug)}/dashboard/summary`,
  );

  const actionPrompt =
    dashboard.recommended_actions?.[0]?.detail ??
    "Bu tenant için bugün hangi finansal aksiyonu öne almalıyım?";

  if (page === "integrations") {
    const [integrations, transactions] = await Promise.all([
      _json<Integration[]>(`/v2/${encodeURIComponent(slug)}/integrations`),
      _json<BankTransaction[]>(
        `/v2/${encodeURIComponent(slug)}/bank-transactions?limit=20`,
      ),
    ]);
    const failing = integrations.filter((item) => item.last_error);
    const lastTxn = transactions[0];
    return {
      page,
      title: "AI Entegrasyon Özeti",
      subtitle: "Bağlantı sağlığı ve veri akışı sinyalleri",
      summary:
        failing.length > 0
          ? `${failing.length} entegrasyonda takip gerektiren hata var.`
          : "Bağlantılar aktif görünüyor; veri akışı düzenli izlenmeli.",
      insights: [
        {
          id: "integration-health",
          title: "Bağlantı Sağlığı",
          detail:
            failing.length > 0
              ? `${failing.map((item) => item.provider).join(", ")} için hata veya yetki yenileme ihtiyacı görünüyor.`
              : `${integrations.filter((item) => item.is_active).length} aktif entegrasyon veri taşıyor.`,
          tone: failing.length > 0 ? "warning" : "success",
        },
        {
          id: "bank-activity",
          title: "Son Veri Akışı",
          detail: lastTxn
            ? `En son banka hareketi ${lastTxn.description ?? "işlem"} olarak içeri alınmış.`
            : "Henüz işlenmiş banka hareketi görünmüyor.",
          tone: lastTxn ? "neutral" : "warning",
        },
      ],
      quick_actions: [
        {
          id: "integration-risk",
          label: "Bağlantı riskini sor",
          prompt: "Entegrasyonlar içinde bugün en kritik operasyonel risk nedir?",
        },
        {
          id: "sync-priority",
          label: "Sync önceliği çıkar",
          prompt: "Bu entegrasyonları bugün hangi sırayla kontrol etmeliyim?",
        },
      ],
      sample_prompts: [
        "Bugün hangi entegrasyon daha fazla risk taşıyor?",
        "Banka ve POS veri akışında kopukluk görüyor musun?",
        "Hangi bağlantıyı önce stabilize etmeliyim?",
      ],
    };
  }

  if (page === "tax-calendar") {
    const items = await _json<TaxCalendarItem[]>(
      `/v2/${encodeURIComponent(slug)}/tax-calendar`,
    );
    const open = items.filter((item) => item.status !== "paid");
    const overdue = open.filter((item) => item.status === "overdue");
    const next = open.sort((a, b) => a.due_date.localeCompare(b.due_date))[0];
    return {
      page,
      title: "AI Vergi Öncelikleri",
      subtitle: "Ödeme sırası ve nakit etkisi",
      summary: next
        ? `${next.title} sonraki kritik ödeme adımı olarak öne çıkıyor.`
        : "Yakın tarihli açık vergi kalemi görünmüyor.",
      insights: [
        {
          id: "tax-next",
          title: "Sıradaki Kalem",
          detail: next
            ? `${next.title} için vade ${next.due_date} ve tutar ${next.amount ?? "0"} ${next.currency}.`
            : "Tüm vergi kalemleri kapalı görünüyor.",
          tone: next?.status === "overdue" ? "danger" : "warning",
        },
        {
          id: "tax-overdue",
          title: "Gecikme Riski",
          detail:
            overdue.length > 0
              ? `${overdue.length} kalem gecikmiş durumda; ceza riskine göre sıralama gerekli.`
              : "Gecikmiş vergi kalemi görünmüyor.",
          tone: overdue.length > 0 ? "danger" : "success",
        },
      ],
      quick_actions: [
        {
          id: "payment-order",
          label: "Ödeme sırası üret",
          prompt: "Vergi kalemlerini nakit etkisine göre hangi sırayla ödemeliyim?",
        },
        {
          id: "tax-risk",
          label: "Ceza riskini sor",
          prompt: "Vergi takviminde bugün en çok ceza riski taşıyan kalem hangisi?",
        },
      ],
      sample_prompts: [
        "Bu hafta hangi vergi ödemesini önce kapatmalıyım?",
        "Gecikmiş kalemlerin nakit akışına etkisi ne olur?",
        "KDV ve SGK'yı aynı haftada nasıl planlamalıyım?",
      ],
    };
  }

  if (page === "pos") {
    const [summary, transactions] = await Promise.all([
      _json<PosDailySummary>(`/v2/${encodeURIComponent(slug)}/pos/summary`),
      _json<PosTransaction[]>(
        `/v2/${encodeURIComponent(slug)}/pos/transactions?limit=20`,
      ),
    ]);
    const pending = transactions.filter((item) => item.status === "pending").length;
    const refunds = transactions.filter((item) => item.txn_type === "refund").length;
    return {
      page,
      title: "AI POS Analizi",
      subtitle: "Tahsilat kalitesi ve işlem sinyalleri",
      summary:
        Number(summary.net_amount) > 0
          ? `POS tarafı pozitif net akış üretiyor; işlem kalitesi yine de izlenmeli.`
          : "POS akışı zayıflıyor; işlem dönüşümü ve iade paterni gözden geçirilmeli.",
      insights: [
        {
          id: "pos-net",
          title: "Net Tahsilat",
          detail: `Bugün net POS akışı ${summary.net_amount} TRY seviyesinde.`,
          tone: Number(summary.net_amount) > 0 ? "success" : "warning",
        },
        {
          id: "pos-quality",
          title: "İşlem Kalitesi",
          detail:
            pending > 0 || refunds > 0
              ? `${pending} bekleyen ve ${refunds} iade işlemi izlenmeli.`
              : "Bekleyen veya iade baskısı oluşturan belirgin sinyal görünmüyor.",
          tone: pending > 0 ? "warning" : "neutral",
        },
      ],
      quick_actions: [
        {
          id: "pos-risk",
          label: "POS riskini sor",
          prompt: "POS tarafında bugün en kritik tahsilat riski nedir?",
        },
        {
          id: "failed-sales",
          label: "Kayıp satışları incele",
          prompt: "Bekleyen veya başarısız POS işlemlerinden ne öğrenmeliyim?",
        },
      ],
      sample_prompts: [
        "POS işlemlerinde kayıp tahsilat sinyali var mı?",
        "İade ve bekleyen işlemler ne anlatıyor?",
        "Bugünkü POS performansına göre hangi aksiyonu almalıyım?",
      ],
    };
  }

  return {
    page,
    title: "AI Dashboard Özeti",
    subtitle: "Risk, aksiyon ve operasyon sinyalleri",
    summary:
      dashboard.recommended_actions?.[0]?.detail ??
      "Bugünün finansal öncelikleri dashboard sinyallerinden türetilir.",
    insights: (dashboard.recommended_actions ?? []).slice(0, 2).map((action, index) => ({
      id: `dashboard-${index}`,
      title: action.title,
      detail: action.detail,
      tone: action.priority === "high" ? "danger" : action.priority === "medium" ? "warning" : "success",
      badge: action.due_hint,
    })),
    quick_actions: [
      {
        id: "dashboard-priority",
        label: "Önceliği sor",
        prompt: actionPrompt,
      },
    ],
    sample_prompts: [
      "Bugün en kritik finansal riskim ne?",
      "Bu hafta hangi ödemeleri öne almalıyım?",
      "Tahsilat ve POS tarafında nerede sorun görüyor musun?",
    ],
  };
}

export const v2 = {
  registerTenant: (payload: TenantCreate) =>
    isMockMode
      ? mockV2.registerTenant(payload)
      : _json<TenantOut>("/v2/tenants", { method: "POST", body: JSON.stringify(payload) }),
  listMyTenants: () =>
    isMockMode ? mockV2.listMyTenants() : _json<TenantOut[]>("/v2/tenants/me"),
  getTenant: (slug: string) =>
    isMockMode
      ? mockV2.getTenant(slug)
      : getTenantWithDemoClaim(slug),
  updateTenant: (slug: string, patch: Partial<Pick<TenantCreate, "display_name" | "sector" | "tax_number">>) =>
    isMockMode
      ? mockV2.updateTenant(slug, patch)
      : _json<TenantOut>(`/v2/tenants/${encodeURIComponent(slug)}`, {
          method: "PUT",
          body: JSON.stringify(patch),
        }),
  listMembers: (slug: string) =>
    isMockMode
      ? mockV2.listMembers(slug)
      : _json<MembershipOut[]>(`/v2/tenants/${encodeURIComponent(slug)}/members`),

  // Faz 3 — entegrasyonlar
  uploadBankStatement: (slug: string, file: File) =>
    isMockMode
      ? mockV2.uploadBankStatement(slug, file)
      : _multipart<BankImportResult>(
          `/v2/${encodeURIComponent(slug)}/integrations/bank-statement`,
          file,
        ),
  listIntegrations: (slug: string) =>
    isMockMode
      ? mockV2.listIntegrations(slug)
      : _json<Integration[]>(`/v2/${encodeURIComponent(slug)}/integrations`),
  listBankTransactions: (slug: string, limit = 100) =>
    isMockMode
      ? mockV2.listBankTransactions(slug, limit)
      : _json<BankTransaction[]>(
          `/v2/${encodeURIComponent(slug)}/bank-transactions?limit=${limit}`,
        ),

  // Faz 4 — vergi takvimi (PR'da v2 client'a eklenmemişti; restore)
  listTaxCalendar: (slug: string, opts?: { upcomingDays?: number; status?: TaxStatus }) => {
    const q = new URLSearchParams();
    if (opts?.upcomingDays) q.set("upcoming_days", String(opts.upcomingDays));
    if (opts?.status) q.set("status_filter", opts.status);
    const qs = q.toString();
    if (isMockMode) return mockV2.listTaxCalendar(slug, opts);
    return _json<TaxCalendarItem[]>(
      `/v2/${encodeURIComponent(slug)}/tax-calendar${qs ? "?" + qs : ""}`,
    );
  },
  patchTaxCalendarItem: (slug: string, itemId: string, patch: TaxCalendarPatch) =>
    isMockMode
      ? mockV2.patchTaxCalendarItem(slug, itemId, patch)
      : _json<TaxCalendarItem>(
          `/v2/${encodeURIComponent(slug)}/tax-calendar/${encodeURIComponent(itemId)}`,
          { method: "PATCH", body: JSON.stringify(patch) },
        ),

  // Faz 6 — sanal POS
  getPosConfig: (slug: string) =>
    isMockMode
      ? mockV2.getPosConfig(slug)
      : _json<PosConfigOut>(`/v2/${encodeURIComponent(slug)}/integrations/pos`),
  putPosConfig: (slug: string, payload: PosConfigIn) =>
    isMockMode
      ? mockV2.putPosConfig(slug, payload)
      : _json<PosConfigOut>(`/v2/${encodeURIComponent(slug)}/integrations/pos`, {
          method: "PUT",
          body: JSON.stringify(payload),
        }),
  listPosTransactions: (slug: string, limit = 100) =>
    isMockMode
      ? mockV2.listPosTransactions(slug, limit)
      : _json<PosTransaction[]>(
          `/v2/${encodeURIComponent(slug)}/pos/transactions?limit=${limit}`,
        ),
  getPosSummary: (slug: string, targetDate?: string) => {
    const qs = targetDate ? `?target_date=${encodeURIComponent(targetDate)}` : "";
    if (isMockMode) return mockV2.getPosSummary(slug, targetDate);
    return _json<PosDailySummary>(`/v2/${encodeURIComponent(slug)}/pos/summary${qs}`);
  },

  // Sprint B — tenant dashboard özeti
  getDashboardSummary: (slug: string) =>
    isMockMode
      ? mockV2.getDashboardSummary(slug)
      : _json<DashboardSummary>(
          `/v2/tenants/${encodeURIComponent(slug)}/dashboard/summary`,
        ),
  getTenantPageAIView: (slug: string, page: AIPageKind) =>
    isMockMode
      ? mockV2.getTenantPageAIView(slug, page)
      : getTenantPageAIViewFallback(slug, page),

  // Faz 7 — event-driven ajan snapshot listesi
  getAgentSnapshots: (slug: string): Promise<AgentSnapshot[]> =>
    isMockMode
      ? Promise.resolve([])
      : _json<AgentSnapshot[]>(
          `/v2/tenants/${encodeURIComponent(slug)}/agents/snapshots`,
        ),

  // v2 analyze — tenant-scoped invoice upload + LangGraph analysis
  uploadInvoice: (slug: string, file: File) =>
    isMockMode
      ? mockV2.uploadInvoice(slug, file)
      : _multipart<InvoiceUploadOut>(`/v2/${encodeURIComponent(slug)}/invoices`, file),
  startAnalysis: (slug: string, payload: AnalyzeRequestV2) =>
    isMockMode
      ? mockV2.startAnalysis(slug, payload)
      : _json<JobStartedOut>(`/v2/${encodeURIComponent(slug)}/analyze`, {
          method: "POST",
          body: JSON.stringify(payload),
        }),
  getAnalysis: (slug: string, jobId: string) =>
    isMockMode
      ? mockV2.getAnalysis(slug, jobId)
      : _json<AnalysisResult>(
          `/v2/${encodeURIComponent(slug)}/analyze/${encodeURIComponent(jobId)}`,
        ),
  downloadAnalysisReport: (slug: string, jobId: string) =>
    isMockMode
      ? mockV2.downloadAnalysisReport(slug, jobId)
      : _blob(
          `/v2/${encodeURIComponent(slug)}/analyze/${encodeURIComponent(jobId)}/report`,
        ),
  approveAnalysis: (slug: string, jobId: string) =>
    isMockMode
      ? Promise.resolve({ job_id: jobId, approved: true })
      : _json<{ job_id: string; approved: boolean }>(
          `/v2/${encodeURIComponent(slug)}/analyze/${encodeURIComponent(jobId)}/approve`,
          { method: "POST", body: "{}" },
        ),
  loadDemo: (slug: string) =>
    isMockMode
      ? mockV2.startAnalysis(slug, { document_ids: [], period: null, include_all_tenant_data: true }).then(
          (r) => ({ ...r, invoice_count: 24, document_ids: [] as string[] }),
        )
      : _json<{ job_id: string; status: "pending"; invoice_count: number; document_ids: string[] }>(
          `/v2/${encodeURIComponent(slug)}/demo/load`,
          { method: "POST", body: JSON.stringify({}) },
        ),

  // v2 chat — tenant + session-scoped, SSE
  getChatHistory: (slug: string, sessionId: string, limit = 50) =>
    isMockMode
      ? mockV2.getChatHistory(slug, sessionId, limit)
      : _json<ChatMessageV2[]>(
          `/v2/${encodeURIComponent(slug)}/chat/${encodeURIComponent(sessionId)}/history?limit=${limit}`,
        ),
  streamChatV2: async (
    slug: string,
    payload: ChatRequestV2,
    onChunk: (text: string) => void,
    signal?: AbortSignal,
  ): Promise<void> => {
    if (isMockMode) return mockV2.streamChatV2(slug, payload, onChunk, signal);
    const r = await fetch(`${BASE_URL}/v2/${encodeURIComponent(slug)}/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(await authHeader()),
      },
      body: JSON.stringify(payload),
      signal,
    });
    if (!r.ok || !r.body) {
      let detail: unknown = null;
      try { detail = await r.json(); } catch { /* ignore */ }
      throw new V2ApiError(r.status, `HTTP ${r.status}`, detail);
    }
    const reader = r.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const chunk = line.slice(6);
          if (chunk === "[DONE]") return;
          if (chunk.startsWith("[HATA]")) throw new V2ApiError(0, chunk);
          onChunk(chunk);
        }
      }
    }
  },
};

// ── Faz 4 tipleri (vergi takvimi) ────────────────────────────────────

export type TaxType =
  | "kdv" | "muhtasar" | "gecici_vergi" | "sgk"
  | "gelir_vergisi" | "kurumlar_vergisi";

export type TaxStatus = "pending" | "paid" | "overdue";

export interface TaxCalendarItem {
  id: string;
  tenant_id: string;
  title: string;
  description: string | null;
  tax_type: TaxType;
  due_date: string;
  amount: string | null;
  currency: string;
  status: TaxStatus;
  period: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaxCalendarPatch {
  status?: TaxStatus;
  amount?: string;
  notes?: string;
}

// ── Faz 6 tipleri ────────────────────────────────────────────────────

export type PosProvider = "iyzico_checkout" | "craftgate";

export interface PosConfigIn {
  provider: PosProvider;
  credentials: Record<string, string>;
  webhook_secret: string;
}

export interface PosConfigOut {
  provider: PosProvider | null;
  is_active: boolean;
  has_credentials: boolean;
  has_webhook_secret: boolean;
  last_sync_at: string | null;
  last_error: string | null;
  webhook_url: string | null;
}

export interface PosTransaction {
  id: string;
  tenant_id: string;
  pos_provider: string;
  external_id: string;
  amount: string;
  currency: string;
  txn_type: "sale" | "refund" | "void" | "preauth";
  status: "success" | "failed" | "pending" | "cancelled";
  payment_method: "credit_card" | "debit_card" | "wallet" | "contactless" | null;
  installments: number;
  card_last_four: string | null;
  description: string | null;
  transacted_at: string;
  created_at: string;
}

export interface PosDailySummary {
  date: string;
  total_sales: string;
  total_refunds: string;
  net_amount: string;
  sale_count: number;
  refund_count: number;
  avg_ticket: string | null;
}

// ── v2 chat tipleri ──────────────────────────────────────────────────

export interface ChatMessageV2 {
  id?: string | null;
  role: "user" | "assistant";
  content: string;
  created_at?: string | null;
}

export interface ChatRequestV2 {
  message: string;
  session_id: string;
  job_id?: string | null;
}

// ── Sprint B — dashboard ─────────────────────────────────────────────

export type DashboardActivityType = "bank" | "pos" | "tax";

export interface DashboardActivity {
  id: string;
  type: DashboardActivityType;
  title: string;
  amount: string | null;
  currency: string;
  timestamp: string;
}

export interface DashboardSummary {
  period_start: string;
  period_end: string;
  net_flow_this_month: string;
  pos_sales_this_month: string;
  upcoming_tax_count: number;
  integration_count: number;
  upcoming_taxes: TaxCalendarItem[];
  recent_activities: DashboardActivity[];
  recommended_actions?: RecommendedAction[];
  updated_at: string;
}

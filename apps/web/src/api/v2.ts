/** v2 tenant-aware API çağrıları. v1 client.ts korunur; Faz 1'de paralel yaşar. */
import { supabase } from "../auth/supabaseClient";

const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:8000";

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

export const v2 = {
  registerTenant: (payload: TenantCreate) =>
    _json<TenantOut>("/v2/tenants", { method: "POST", body: JSON.stringify(payload) }),
  listMyTenants: () => _json<TenantOut[]>("/v2/tenants/me"),
  getTenant: (slug: string) => _json<TenantOut>(`/v2/tenants/${encodeURIComponent(slug)}`),
  updateTenant: (slug: string, patch: Partial<Pick<TenantCreate, "display_name" | "sector" | "tax_number">>) =>
    _json<TenantOut>(`/v2/tenants/${encodeURIComponent(slug)}`, {
      method: "PUT",
      body: JSON.stringify(patch),
    }),
  listMembers: (slug: string) =>
    _json<MembershipOut[]>(`/v2/tenants/${encodeURIComponent(slug)}/members`),

  // Faz 3 — entegrasyonlar
  uploadBankStatement: (slug: string, file: File) =>
    _multipart<BankImportResult>(
      `/v2/${encodeURIComponent(slug)}/integrations/bank-statement`,
      file,
    ),
  listIntegrations: (slug: string) =>
    _json<Integration[]>(`/v2/${encodeURIComponent(slug)}/integrations`),
  listBankTransactions: (slug: string, limit = 100) =>
    _json<BankTransaction[]>(
      `/v2/${encodeURIComponent(slug)}/bank-transactions?limit=${limit}`,
    ),

  // Faz 4 — vergi takvimi (PR'da v2 client'a eklenmemişti; restore)
  listTaxCalendar: (slug: string, opts?: { upcomingDays?: number; status?: TaxStatus }) => {
    const q = new URLSearchParams();
    if (opts?.upcomingDays) q.set("upcoming_days", String(opts.upcomingDays));
    if (opts?.status) q.set("status_filter", opts.status);
    const qs = q.toString();
    return _json<TaxCalendarItem[]>(
      `/v2/${encodeURIComponent(slug)}/tax-calendar${qs ? "?" + qs : ""}`,
    );
  },
  patchTaxCalendarItem: (slug: string, itemId: string, patch: TaxCalendarPatch) =>
    _json<TaxCalendarItem>(
      `/v2/${encodeURIComponent(slug)}/tax-calendar/${encodeURIComponent(itemId)}`,
      { method: "PATCH", body: JSON.stringify(patch) },
    ),

  // Faz 6 — sanal POS
  getPosConfig: (slug: string) =>
    _json<PosConfigOut>(`/v2/${encodeURIComponent(slug)}/integrations/pos`),
  putPosConfig: (slug: string, payload: PosConfigIn) =>
    _json<PosConfigOut>(`/v2/${encodeURIComponent(slug)}/integrations/pos`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  listPosTransactions: (slug: string, limit = 100) =>
    _json<PosTransaction[]>(
      `/v2/${encodeURIComponent(slug)}/pos/transactions?limit=${limit}`,
    ),
  getPosSummary: (slug: string, targetDate?: string) => {
    const qs = targetDate ? `?target_date=${encodeURIComponent(targetDate)}` : "";
    return _json<PosDailySummary>(`/v2/${encodeURIComponent(slug)}/pos/summary${qs}`);
  },

  // Sprint B — tenant dashboard özeti
  getDashboardSummary: (slug: string) =>
    _json<DashboardSummary>(
      `/v2/tenants/${encodeURIComponent(slug)}/dashboard/summary`,
    ),
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
  updated_at: string;
}

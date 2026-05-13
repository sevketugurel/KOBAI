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

// ── Faz 4 — Vergi Takvimi ────────────────────────────────────────────

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
  due_date: string;             // ISO date
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

  // Faz 4 — vergi takvimi
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
};

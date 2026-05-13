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
};

import { useQuery } from "@tanstack/react-query";

import { v2, type TenantOut } from "../api/v2";
import { useAuth } from "../auth/AuthContext";

export interface UseTenantResult {
  tenant: TenantOut | null;
  loading: boolean;
  error: Error | null;
  /** 403 → kullanıcı bu tenant'a üye değil. 404 → tenant yok. */
  status: "idle" | "loading" | "ok" | "forbidden" | "not_found" | "error";
}

/** URL slug'ını alır, /v2/tenants/{slug} sorgular. JWT yoksa idle. */
export function useTenant(slug: string | undefined): UseTenantResult {
  const { session, loading: authLoading } = useAuth();
  const enabled = Boolean(slug) && Boolean(session);

  const q = useQuery({
    queryKey: ["tenant", slug],
    queryFn: () => v2.getTenant(slug as string),
    enabled,
    retry: false,
  });

  if (!slug) return { tenant: null, loading: false, error: null, status: "idle" };
  if (authLoading || (enabled && q.isLoading)) return { tenant: null, loading: true, error: null, status: "loading" };
  if (q.isError) {
    const err = q.error as { status?: number } | undefined;
    if (err?.status === 403) return { tenant: null, loading: false, error: q.error as Error, status: "forbidden" };
    if (err?.status === 404) return { tenant: null, loading: false, error: q.error as Error, status: "not_found" };
    return { tenant: null, loading: false, error: q.error as Error, status: "error" };
  }
  return { tenant: q.data ?? null, loading: false, error: null, status: "ok" };
}

export function useMyTenants() {
  const { session, loading } = useAuth();
  return useQuery({
    queryKey: ["my-tenants"],
    queryFn: v2.listMyTenants,
    enabled: Boolean(session) && !loading,
  });
}

import { useQuery } from "@tanstack/react-query";

import { isMockMode, v2, type DashboardSummary } from "../api/v2";
import { useAuth } from "../auth/AuthContext";

/** GET /v2/tenants/{slug}/dashboard/summary — KPI + son aktivite snapshot'ı. */
export function useTenantDashboard(slug: string | undefined) {
  const { session, loading: authLoading } = useAuth();
  const enabled = Boolean(slug) && (Boolean(session) || isMockMode) && !authLoading;
  return useQuery<DashboardSummary>({
    queryKey: ["tenant", slug, "dashboard-summary"],
    queryFn: () => v2.getDashboardSummary(slug as string),
    enabled,
    retry: false,
    staleTime: 60_000,
  });
}

import { useQuery } from "@tanstack/react-query";
import { v2 } from "../api/v2";
import { useAuth } from "../auth/AuthContext";
/** GET /v2/tenants/{slug}/dashboard/summary — KPI + son aktivite snapshot'ı. */
export function useTenantDashboard(slug) {
    const { session, loading: authLoading } = useAuth();
    const enabled = Boolean(slug) && Boolean(session) && !authLoading;
    return useQuery({
        queryKey: ["tenant", slug, "dashboard-summary"],
        queryFn: () => v2.getDashboardSummary(slug),
        enabled,
        retry: false,
        staleTime: 60_000,
    });
}

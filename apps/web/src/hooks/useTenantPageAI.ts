import { useQuery } from "@tanstack/react-query";

import { isMockMode, v2, type AIPageKind, type TenantPageAIView } from "../api/v2";
import { useAuth } from "../auth/AuthContext";

export function useTenantPageAI(slug: string | undefined, page: AIPageKind) {
  const { session, loading: authLoading } = useAuth();
  const enabled = Boolean(slug) && (Boolean(session) || isMockMode) && !authLoading;

  return useQuery<TenantPageAIView>({
    queryKey: ["tenant", slug, "page-ai", page],
    queryFn: () => v2.getTenantPageAIView(slug as string, page),
    enabled,
    retry: false,
    staleTime: 30_000,
  });
}

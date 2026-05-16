import { useQuery } from "@tanstack/react-query";

import { isMockMode, v2, type AgentSnapshot } from "../api/v2";
import { useAuth } from "../auth/AuthContext";

/** GET /v2/tenants/{slug}/agents/snapshots — Faz 7 ajan snapshot listesi.
 *
 * Polling: 15s; running snapshot varsa 5s'ye düşer. SSE eklenince (Faz 4b)
 * polling kaldırılır.
 */
export function useAgentSnapshots(slug: string | undefined) {
  const { session, loading: authLoading } = useAuth();
  const enabled = Boolean(slug) && (Boolean(session) || isMockMode) && !authLoading;
  return useQuery<AgentSnapshot[]>({
    queryKey: ["tenant", slug, "agent-snapshots"],
    queryFn: () => v2.getAgentSnapshots(slug as string),
    enabled,
    retry: false,
    staleTime: 10_000,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return 15_000;
      return data.some((s) => s.status === "running") ? 5_000 : 15_000;
    },
  });
}

export function getSnapshot(
  snapshots: AgentSnapshot[] | undefined,
  name: AgentSnapshot["agent_name"],
): AgentSnapshot | undefined {
  return snapshots?.find((s) => s.agent_name === name);
}

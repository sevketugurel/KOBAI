import { useEffect, useRef, useState } from "react";
import { getAnalysisStatus, ApiError } from "../api/client";
import type { AnalysisResult, JobStatus } from "../api/types";

export function useAnalysis(jobId: string | null, intervalMs = 2000) {
  const [data, setData] = useState<AnalysisResult | null>(null);
  const [status, setStatus] = useState<JobStatus>("pending");
  const [error, setError] = useState<Error | null>(null);
  const stopped = useRef(false);

  useEffect(() => {
    if (!jobId) return;
    stopped.current = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      if (stopped.current) return;
      try {
        const r = await getAnalysisStatus(jobId);
        setData(r); setStatus(r.status);
        if (r.status === "completed" || r.status === "failed") return;
      } catch (e) {
        setError(e instanceof Error ? e : new ApiError(0, "unknown"));
      }
      timer = setTimeout(tick, intervalMs);
    };
    tick();
    return () => { stopped.current = true; clearTimeout(timer!); };
  }, [jobId, intervalMs]);

  return { data, status, isLoading: status === "pending" || status === "processing", error };
}

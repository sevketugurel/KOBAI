import { useEffect, useRef, useState } from "react";
import { getAnalysisStatus, ApiError } from "../api/client";
export function useAnalysis(jobId, intervalMs = 2000) {
    const [data, setData] = useState(null);
    const [status, setStatus] = useState("pending");
    const [error, setError] = useState(null);
    const stopped = useRef(false);
    useEffect(() => {
        if (!jobId)
            return;
        stopped.current = false;
        let timer;
        const tick = async () => {
            if (stopped.current)
                return;
            try {
                const r = await getAnalysisStatus(jobId);
                setData(r);
                setStatus(r.status);
                if (r.status === "completed" || r.status === "failed")
                    return;
            }
            catch (e) {
                setError(e instanceof Error ? e : new ApiError(0, "unknown"));
            }
            timer = setTimeout(tick, intervalMs);
        };
        tick();
        return () => { stopped.current = true; clearTimeout(timer); };
    }, [jobId, intervalMs]);
    return { data, status, isLoading: status === "pending" || status === "processing", error };
}

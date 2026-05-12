const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";
export class ApiError extends Error {
    status;
    detail;
    constructor(status, message, detail) {
        super(message);
        this.status = status;
        this.detail = detail;
    }
}
async function _json(input, init) {
    const r = await fetch(input, init);
    if (!r.ok) {
        let detail = null;
        try {
            detail = await r.json();
        }
        catch { /* ignore */ }
        throw new ApiError(r.status, `HTTP ${r.status}`, detail);
    }
    return (await r.json());
}
export async function uploadInvoice(file) {
    const fd = new FormData();
    fd.append("file", file);
    return _json(`${BASE_URL}/upload`, { method: "POST", body: fd });
}
export async function startAnalysis(payload) {
    return _json(`${BASE_URL}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
}
export async function getAnalysisStatus(jobId) {
    return _json(`${BASE_URL}/analyze/${encodeURIComponent(jobId)}`);
}
export async function streamChat(message, jobId, history, onChunk) {
    const r = await fetch(`${BASE_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, job_id: jobId, history }),
    });
    if (!r.ok || !r.body)
        throw new ApiError(r.status, "chat stream failed");
    const reader = r.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    for (;;) {
        const { value, done } = await reader.read();
        if (done)
            break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
            if (line.startsWith("data: ")) {
                const chunk = line.slice(6);
                if (chunk === "[DONE]")
                    return;
                onChunk(chunk);
            }
        }
    }
}
export function reportUrl(jobId) {
    return `${BASE_URL}/report/${encodeURIComponent(jobId)}`;
}

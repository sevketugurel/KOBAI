import type {
  AnalysisResult, AnalyzeRequest, ChatMessage, InvoiceData,
} from "./types";

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  constructor(public status: number, message: string, public detail?: unknown) {
    super(message);
  }
}

async function _json<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const r = await fetch(input, init);
  if (!r.ok) {
    let detail: unknown = null;
    try { detail = await r.json(); } catch { /* ignore */ }
    throw new ApiError(r.status, `HTTP ${r.status}`, detail);
  }
  return (await r.json()) as T;
}

export async function uploadInvoice(file: File): Promise<{ invoice_id: string; data: InvoiceData }> {
  const fd = new FormData();
  fd.append("file", file);
  return _json(`${BASE_URL}/upload`, { method: "POST", body: fd });
}

export async function startAnalysis(payload: AnalyzeRequest): Promise<{ job_id: string; status: string }> {
  return _json(`${BASE_URL}/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function getAnalysisStatus(jobId: string): Promise<AnalysisResult> {
  return _json(`${BASE_URL}/analyze/${encodeURIComponent(jobId)}`);
}

export async function streamChat(
  message: string, jobId: string, history: ChatMessage[],
  onChunk: (text: string) => void,
): Promise<void> {
  const r = await fetch(`${BASE_URL}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, job_id: jobId, history }),
  });
  if (!r.ok || !r.body) throw new ApiError(r.status, "chat stream failed");
  const reader = r.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const chunk = line.slice(6);
        if (chunk === "[DONE]") return;
        onChunk(chunk);
      }
    }
  }
}

export function reportUrl(jobId: string): string {
  return `${BASE_URL}/report/${encodeURIComponent(jobId)}`;
}

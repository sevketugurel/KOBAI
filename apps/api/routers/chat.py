"""POST /chat — SSE stream Türkçe doğal dil yanıtları."""
import json
import logging
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from schemas.chat import ChatRequest
from services.job_queue import queue
from services.gemini import GeminiService

log = logging.getLogger(__name__)
router = APIRouter(tags=["chat"])
_gemini = GeminiService()

_SSE_HEADERS = {
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
}


def _sse_event(payload: str) -> str:
    """Tek satırlık data: alanı (içerideki satır sonları boşluğa indirgenir)."""
    safe = " ".join(payload.splitlines()) if payload else ""
    return f"data: {safe}\n\n"


async def _stream_answer(message: str, context: str):
    """Streaming yerine basit chunk-split — Gemini stream API ilerde swap edilir."""
    full = await _gemini.generate_text(prompt=message, context=context)
    for word in full.split():
        yield word + " "


@router.post("/chat")
async def chat(req: ChatRequest) -> StreamingResponse:
    try:
        job = await queue.get_job(req.job_id)
    except KeyError:
        raise HTTPException(status_code=404, detail="job yok")
    ctx = (
        f"Şirket nakit akışı (3 ay): {job.cash_flow_forecast}\n"
        f"Risk: {job.risk_label} — {job.risk_explanation}\n"
        f"Vergi önerileri sayısı: {len(job.tax_recommendations)}\n"
        f"Önceki sohbet: {json.dumps([m.model_dump() for m in req.history], ensure_ascii=False)}"
    )

    async def event_stream():
        # Hemen bir bayt gönder: uzun Gemini beklemesinde vekil/proxy zaman aşımı riskini azaltır.
        yield ": keepalive\n\n"
        try:
            async for chunk in _stream_answer(req.message, ctx):
                yield _sse_event(chunk)
            yield _sse_event("[DONE]")
        except Exception as e:  # noqa: BLE001 — SSE üzerinden hatayı iletip chunked kapanışını garanti ederiz
            log.exception("chat stream hatası job_id=%s", req.job_id)
            yield _sse_event(f"[HATA] {e!s}")
            yield _sse_event("[DONE]")

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers=_SSE_HEADERS,
    )

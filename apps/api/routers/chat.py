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
        async for chunk in _stream_answer(req.message, ctx):
            yield f"data: {chunk}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")

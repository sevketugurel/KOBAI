"""POST /v2/{slug}/chat — tenant + session-scoped SSE chat.

Akış:
1. `require_tenant` → JWT → slug eşle → TenantContext
2. Kullanıcı mesajını chat_messages'a yaz (tenant_id + session_id)
3. Son N mesajı + (opsiyonel) job analiz özeti = context
4. Gemini → SSE word-by-word stream
5. Tam yanıt biriktir → assistant mesajını chat_messages'a yaz
6. `[DONE]` sentinel'ı gönder
"""

from __future__ import annotations

import json
import logging
from typing import Annotated

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from middleware.tenant import require_tenant
from repositories.chat_repo import ChatRepo, get_chat_repo
from schemas.chat_v2 import ChatRequestV2
from schemas.tenant import TenantContext
from services.gemini import GeminiService
from services.job_queue import queue

log = logging.getLogger(__name__)
router = APIRouter(prefix="/v2/{slug}", tags=["v2-chat"])
_gemini = GeminiService()

_SSE_HEADERS = {
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
}


def _sse_event(payload: str) -> str:
    safe = " ".join(payload.splitlines()) if payload else ""
    return f"data: {safe}\n\n"


async def _build_context(
    *, tenant_id: str, session_id: str, job_id: str | None, repo: ChatRepo
) -> str:
    parts: list[str] = []
    if job_id:
        try:
            job = await queue.get_job(job_id)
            parts.append(
                f"Şirket nakit akışı (3 ay): {job.cash_flow_forecast}\n"
                f"Risk: {job.risk_label} — {job.risk_explanation}\n"
                f"Vergi önerileri sayısı: {len(job.tax_recommendations)}"
            )
        except KeyError:
            parts.append(f"(job {job_id} bulunamadı — yalnızca chat geçmişi kullanılıyor)")
    history = await repo.list_recent(tenant_id=tenant_id, session_id=session_id, limit=10)
    if history:
        parts.append(
            "Önceki sohbet:\n"
            + json.dumps(
                [{"role": m.role, "content": m.content} for m in history],
                ensure_ascii=False,
            )
        )
    return "\n\n".join(parts) if parts else "Bağlam yok."


@router.post("/chat")
async def chat_v2(
    req: ChatRequestV2,
    ctx: Annotated[TenantContext, Depends(require_tenant)],
    repo: Annotated[ChatRepo, Depends(get_chat_repo)],
) -> StreamingResponse:
    # Kullanıcı mesajını hemen persist et (sızıntı izolasyonu repo katmanında)
    await repo.save_message(
        tenant_id=ctx.tenant_id,
        session_id=req.session_id,
        role="user",
        content=req.message,
    )
    context = await _build_context(
        tenant_id=ctx.tenant_id, session_id=req.session_id, job_id=req.job_id, repo=repo
    )

    async def event_stream():
        yield ": keepalive\n\n"
        full_answer = ""
        try:
            answer = await _gemini.generate_text(prompt=req.message, context=context)
            full_answer = answer
            for word in answer.split():
                yield _sse_event(word + " ")
            yield _sse_event("[DONE]")
        except Exception as e:  # noqa: BLE001
            log.exception(
                "v2 chat hatası tenant=%s session=%s", ctx.tenant_id, req.session_id
            )
            yield _sse_event(f"[HATA] {e!s}")
            yield _sse_event("[DONE]")
        finally:
            # Tam yanıtı persist et (boş bile olsa kullanıcı mesajı saklı)
            if full_answer:
                try:
                    await repo.save_message(
                        tenant_id=ctx.tenant_id,
                        session_id=req.session_id,
                        role="assistant",
                        content=full_answer,
                    )
                except Exception:  # noqa: BLE001
                    log.exception("assistant mesajı persist edilemedi")

    return StreamingResponse(event_stream(), media_type="text/event-stream", headers=_SSE_HEADERS)


@router.get("/chat/{session_id}/history")
async def chat_history(
    session_id: str,
    ctx: Annotated[TenantContext, Depends(require_tenant)],
    repo: Annotated[ChatRepo, Depends(get_chat_repo)],
    limit: int = 50,
) -> list[dict]:
    msgs = await repo.list_recent(
        tenant_id=ctx.tenant_id, session_id=session_id, limit=limit
    )
    return [m.model_dump(mode="json") for m in msgs]

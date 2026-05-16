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
from repositories.job_repo import JobNotFound, JobRepo, get_job_repo
from rag.collections import tenant_docs_collection
from rag.retriever import RagRetriever
from schemas.chat_v2 import ChatRequestV2
from schemas.tenant import TenantContext
from services.gemini import GeminiService
from services.tenant_context import TenantDataService, get_tenant_data_service

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
    *,
    tenant_id: str,
    session_id: str,
    message: str,
    job_id: str | None,
    repo: ChatRepo,
    job_repo: JobRepo,
    tenant_data: TenantDataService,
) -> str:
    parts: list[str] = []
    try:
        if job_id:
            job = await job_repo.get_job(tenant_id=tenant_id, job_id=job_id)
            parts.append(
                f"Şirket nakit akışı (3 ay): {job.cash_flow_forecast}\n"
                f"Risk: {job.risk_label} — {job.risk_explanation}\n"
                f"Vergi önerileri sayısı: {len(job.tax_recommendations)}"
            )
        else:
            job = await job_repo.get_latest_completed(tenant_id=tenant_id)
            if job is not None:
                parts.append(
                    f"Son tamamlanan analiz: job={job.job_id}, risk={job.risk_label}, "
                    f"nakit akışı={job.cash_flow_forecast}, açıklama={job.risk_explanation}"
                )
    except JobNotFound:
        parts.append(f"(job {job_id} bulunamadı — güncel tenant bağlamı kullanılıyor)")
    except Exception as e:  # noqa: BLE001
        log.warning("analiz bağlamı okunamadı tenant=%s job=%s: %s", tenant_id, job_id, e)
    try:
        tenant_context = await tenant_data.build_context(tenant_id=tenant_id)
        parts.append("Güncel structured tenant bağlamı:\n" + tenant_context.summary_text())
    except Exception as e:  # noqa: BLE001
        log.warning("tenant structured context okunamadı tenant=%s: %s", tenant_id, e)
    try:
        hits = await RagRetriever(
            collection_name=tenant_docs_collection(tenant_id), scope="private"
        ).search(f"{message} tenant finans özeti vergi banka pos fatura gider gelir", n_results=5)
        if hits:
            parts.append(
                "Tenant private RAG kaynakları:\n"
                + json.dumps(
                    [
                        {
                            "text": h["text"],
                            "metadata": h["metadata"],
                            "confidence": h["confidence"],
                        }
                        for h in hits
                    ],
                    ensure_ascii=False,
                )
            )
    except Exception as e:  # noqa: BLE001
        log.warning("tenant RAG okunamadı tenant=%s: %s", tenant_id, e)
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
    job_repo: Annotated[JobRepo, Depends(get_job_repo)],
    tenant_data: Annotated[TenantDataService, Depends(get_tenant_data_service)],
) -> StreamingResponse:
    # Kullanıcı mesajını hemen persist et (sızıntı izolasyonu repo katmanında)
    await repo.save_message(
        tenant_id=ctx.tenant_id,
        session_id=req.session_id,
        role="user",
        content=req.message,
    )
    context = await _build_context(
        tenant_id=ctx.tenant_id,
        session_id=req.session_id,
        message=req.message,
        job_id=req.job_id,
        repo=repo,
        job_repo=job_repo,
        tenant_data=tenant_data,
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

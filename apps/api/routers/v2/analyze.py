"""POST /v2/{slug}/invoices       — fatura PDF yükle, parse et, persist et.
POST /v2/{slug}/analyze       — analiz başlat (LangGraph pipeline, tenant_id'li).
GET  /v2/{slug}/analyze/{id}  — job durumu + sonucu.

Persistence: `documents` (doc_type='invoice', parsed_data=InvoiceData) ve
`analyses` (job_id, status, result). v1'in in-memory `JobQueue`'sının yerine
tenant izole edilmiş Supabase tabloları kullanılır.

Storage NOT eklenmedi: PDF bytes Gemini Vision'a gider, kalıcı saklanmaz —
`file_url` `memory://...` placeholder'ı (Supabase Storage entegrasyonu sonraki branch).
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime
from typing import Annotated, Literal

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, Response, UploadFile, status
from google.api_core.exceptions import ResourceExhausted
from pydantic import BaseModel, ConfigDict, Field

from agents.orchestrator import run_pipeline
from config import settings
from middleware.tenant import require_tenant
from repositories.job_repo import JobNotFound, JobRepo, get_job_repo, make_initial_result
from repositories.tenant_repo import TenantRepo, get_tenant_repo
from schemas.invoice import InvoiceData
from schemas.analysis import AgentStep
from schemas.tenant import TenantContext
from services.gemini import GeminiParseError, GeminiService
from services.pdf_generator import build_analysis_pdf
from services.tenant_context import TenantAnalysisContext, get_tenant_data_service
from services.tenant_rag import get_tenant_rag_indexer, refresh_tenant_rag

log = logging.getLogger(__name__)
router = APIRouter(prefix="/v2/{slug}", tags=["v2-analyze"])

_gemini: GeminiService | None = None


def _get_gemini() -> GeminiService:
    global _gemini
    if _gemini is None:
        _gemini = GeminiService()
    return _gemini


def _reset_gemini_for_tests() -> None:
    global _gemini
    _gemini = None


class InvoiceUploadOut(BaseModel):
    model_config = ConfigDict(extra="forbid")
    document_id: str
    invoice: InvoiceData


class AnalyzeRequestV2(BaseModel):
    model_config = ConfigDict(extra="forbid")
    document_ids: list[str] = Field(min_length=1, max_length=100)
    period: str | None = None  # "2025-06" formatı, opsiyonel
    include_all_tenant_data: bool = True


class JobStartedOut(BaseModel):
    model_config = ConfigDict(extra="forbid")
    job_id: str
    status: Literal["pending"]


def _looks_like_pdf(file: UploadFile, data: bytes) -> bool:
    ct = (file.content_type or "").split(";")[0].strip().lower()
    if ct == "application/pdf":
        return True
    if ct in ("application/octet-stream", "binary/octet-stream", ""):
        if (file.filename or "").lower().endswith(".pdf"):
            return True
    return len(data) >= 4 and data[:4] == b"%PDF"


async def _refresh_tenant_rag(
    *,
    tenant_id: str,
    period: str | None = None,
    tenant_profile: dict[str, object] | None = None,
) -> None:
    try:
        await refresh_tenant_rag(
            tenant_id=tenant_id,
            period=period,
            tenant_profile=tenant_profile,
        )
    except Exception as e:  # noqa: BLE001
        log.warning("tenant RAG index güncellenemedi tenant=%s: %s", tenant_id, e)


@router.post("/invoices", status_code=status.HTTP_201_CREATED, response_model=InvoiceUploadOut)
async def upload_invoice(
    ctx: Annotated[TenantContext, Depends(require_tenant)],
    repo: Annotated[JobRepo, Depends(get_job_repo)],
    file: UploadFile = File(...),
) -> InvoiceUploadOut:
    data = await file.read()
    if not _looks_like_pdf(file, data):
        raise HTTPException(status_code=400, detail="yalnızca PDF kabul edilir")
    if len(data) > settings.max_pdf_size_mb * 1024 * 1024:
        raise HTTPException(
            status_code=413,
            detail=f"dosya {settings.max_pdf_size_mb}MB sınırını aşıyor",
        )
    try:
        invoice = await _get_gemini().parse_invoice_pdf(data)
    except GeminiParseError as e:
        raise HTTPException(status_code=422, detail=f"fatura ayrıştırılamadı: {e}") from e
    except ResourceExhausted as e:
        log.warning("Gemini ResourceExhausted (tenant=%s): %s", ctx.tenant_id, e)
        raise HTTPException(status_code=429, detail="Gemini API kotası aşıldı") from e
    except Exception as e:  # noqa: BLE001
        log.exception("Gemini Vision hatası tenant=%s", ctx.tenant_id)
        raise HTTPException(
            status_code=502,
            detail=f"fatura servisi hata verdi: {type(e).__name__}: {e}",
        ) from e
    invoice = invoice.model_copy(
        update={"invoice_id": invoice.invoice_id or str(uuid.uuid4())}
    )
    document_id = await repo.save_invoice(
        tenant_id=ctx.tenant_id,
        file_name=file.filename or "invoice.pdf",
        file_url=f"memory://{ctx.tenant_id}/invoice",
        invoice=invoice,
    )
    await _refresh_tenant_rag(tenant_id=ctx.tenant_id)
    return InvoiceUploadOut(document_id=document_id, invoice=invoice)


async def _run(*, repo: JobRepo, tenant_id: str, job_id: str, document_ids: list[str],
               company_type: str, sector: str, period: str,
               include_all_tenant_data: bool = True) -> None:
    try:
        await repo.update_job_status(tenant_id=tenant_id, job_id=job_id, status="processing")
        invoices = await repo.get_invoices(tenant_id=tenant_id, document_ids=document_ids)
        if not invoices:
            raise ValueError("hiç geçerli fatura bulunamadı (document_ids tenant'a ait olmayabilir)")
        tenant_context: TenantAnalysisContext | None = None
        try:
            tenant_context = await get_tenant_data_service().build_context(
                tenant_id=tenant_id,
                period=period,
                document_ids=document_ids,
                tenant_profile={"sector": sector, "company_type": company_type},
                include_all_tenant_data=include_all_tenant_data,
            )
            await get_tenant_rag_indexer().index_context(tenant_context)
        except Exception as e:  # noqa: BLE001
            log.warning("tenant context/RAG hazırlanamadı tenant=%s job=%s: %s", tenant_id, job_id, e)
        kwargs = {
            "invoices": invoices,
            "company_type": company_type,
            "sector": sector,
            "period": period,
            "job_id": job_id,
            "auto_approve": True,
            "tenant_id": tenant_id,
        }
        if tenant_context is not None:
            kwargs["tenant_context"] = tenant_context
        result = await run_pipeline(**kwargs)
        await repo.set_job_result(tenant_id=tenant_id, job_id=job_id, result=result)
    except Exception as e:  # noqa: BLE001
        log.exception("v2 pipeline hatası tenant=%s job=%s", tenant_id, job_id)
        try:
            current = await repo.get_job(tenant_id=tenant_id, job_id=job_id)
        except JobNotFound:
            return
        failed = current.model_copy(update={
            "status": "failed", "error": str(e), "completed_at": datetime.utcnow(),
            "agent_trace": [
                *current.agent_trace,
                AgentStep(
                    agent_name="orchestrator",
                    action="Analiz çalıştırılırken hata oluştu",
                    input={"tenant_id": tenant_id, "job_id": job_id},
                    output={"summary": str(e)},
                    duration_ms=0,
                    confidence=1.0,
                ),
            ],
        })
        await repo.set_job_result(tenant_id=tenant_id, job_id=job_id, result=failed)


@router.post("/analyze", status_code=status.HTTP_202_ACCEPTED, response_model=JobStartedOut)
async def start_analysis(
    req: AnalyzeRequestV2,
    bg: BackgroundTasks,
    ctx: Annotated[TenantContext, Depends(require_tenant)],
    repo: Annotated[JobRepo, Depends(get_job_repo)],
    tenant_repo: Annotated[TenantRepo, Depends(get_tenant_repo)],
) -> JobStartedOut:
    # Tenant'tan sector + company_type — orchestrator için.
    tenant = await tenant_repo.get_by_slug(ctx.tenant_slug)
    if tenant is None:
        # require_tenant zaten doğruladı; defensive.
        raise HTTPException(status_code=404, detail="tenant yok")

    initial = make_initial_result()
    job_id = await repo.create_job(
        tenant_id=ctx.tenant_id, period=req.period, initial=initial,
    )
    bg.add_task(
        _run,
        repo=repo,
        tenant_id=ctx.tenant_id,
        job_id=job_id,
        document_ids=req.document_ids,
        company_type=tenant.company_type,
        sector=tenant.sector,
        period=req.period or datetime.utcnow().strftime("%Y-%m"),
        include_all_tenant_data=req.include_all_tenant_data,
    )
    return JobStartedOut(job_id=job_id, status="pending")


@router.get("/analyze/{job_id}")
async def get_analysis(
    job_id: str,
    ctx: Annotated[TenantContext, Depends(require_tenant)],
    repo: Annotated[JobRepo, Depends(get_job_repo)],
) -> dict:
    try:
        result = await repo.get_job(tenant_id=ctx.tenant_id, job_id=job_id)
    except JobNotFound as e:
        raise HTTPException(status_code=404, detail="job bulunamadı") from e
    return result.model_dump(mode="json")


@router.get("/analyze/{job_id}/report")
async def get_analysis_report(
    job_id: str,
    ctx: Annotated[TenantContext, Depends(require_tenant)],
    repo: Annotated[JobRepo, Depends(get_job_repo)],
    tenant_repo: Annotated[TenantRepo, Depends(get_tenant_repo)],
) -> Response:
    try:
        result = await repo.get_job(tenant_id=ctx.tenant_id, job_id=job_id)
    except JobNotFound as e:
        raise HTTPException(status_code=404, detail="job bulunamadı") from e
    if result.status != "completed":
        raise HTTPException(status_code=409, detail="analiz tamamlanmadı")

    tenant = await tenant_repo.get_by_slug(ctx.tenant_slug)
    company_name = tenant.display_name if tenant else ctx.tenant_slug
    pdf = build_analysis_pdf(result, company_name=company_name)
    filename = f"{ctx.tenant_slug}-{job_id}.pdf"
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )

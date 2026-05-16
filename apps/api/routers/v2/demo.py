"""POST /v2/{slug}/demo/load — preseeded demo faturalarını tenant'a kopyalar ve analiz başlatır.

Demo verisi `data/demo/ahmet_usta_firini/invoices.json` içinde zaten yapılandırılmış
InvoiceData biçiminde duruyor. Gemini Vision'a fatura başına PDF göndermek yerine
JSON'u doğrudan persist edip pipeline'ı tetikliyoruz; demo akışı offline ve hızlı.

Güvenlik: yalnızca whitelisted slug'lara açık (kuzey-market). require_tenant'tan
geçen kullanıcı zaten bu tenant'ın üyesi olduğunu kanıtlamış olur.
"""

from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime
from pathlib import Path
from typing import Annotated, Literal

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict

from middleware.tenant import require_tenant
from repositories.job_repo import JobRepo, get_job_repo, make_initial_result
from repositories.tenant_repo import TenantRepo, get_tenant_repo
from routers.v2.analyze import _run
from schemas.invoice import InvoiceData
from schemas.tenant import TenantContext

log = logging.getLogger(__name__)
router = APIRouter(prefix="/v2/{slug}", tags=["v2-demo"])

_DEMO_ALLOWED_SLUGS = {"kuzey-market"}


def _demo_data_dir() -> Path:
    """Docker (/app/data) ve monorepo kökü (repo/data) için demo dizinini bul."""
    here = Path(__file__).resolve()
    rel = Path("data") / "demo" / "ahmet_usta_firini"
    candidates = [here.parents[2] / rel]
    if len(here.parents) > 4:
        candidates.append(here.parents[4] / rel)
    for path in candidates:
        if path.is_dir():
            return path
    return candidates[0]


_DEMO_DATA = _demo_data_dir()


class DemoLoadOut(BaseModel):
    model_config = ConfigDict(extra="forbid")
    job_id: str
    status: Literal["pending"]
    invoice_count: int
    document_ids: list[str]


def _load_demo_invoices() -> list[InvoiceData]:
    src = _DEMO_DATA / "invoices.json"
    if not src.exists():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"demo veri seti bulunamadı: {src}",
        )
    raw = json.loads(src.read_text(encoding="utf-8"))
    invoices: list[InvoiceData] = []
    for row in raw:
        # invoice_id'yi UUID'ye normalize et — Supabase'de uniqueness için.
        row = {**row, "invoice_id": row.get("invoice_id") or str(uuid.uuid4())}
        invoices.append(InvoiceData.model_validate(row))
    return invoices


@router.post("/demo/load", status_code=status.HTTP_202_ACCEPTED, response_model=DemoLoadOut)
async def load_demo(
    bg: BackgroundTasks,
    ctx: Annotated[TenantContext, Depends(require_tenant)],
    repo: Annotated[JobRepo, Depends(get_job_repo)],
    tenant_repo: Annotated[TenantRepo, Depends(get_tenant_repo)],
) -> DemoLoadOut:
    if ctx.tenant_slug not in _DEMO_ALLOWED_SLUGS:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="demo yalnızca demo tenant'ları için açıktır",
        )
    tenant = await tenant_repo.get_by_slug(ctx.tenant_slug)
    if tenant is None:
        raise HTTPException(status_code=404, detail="tenant yok")

    invoices = _load_demo_invoices()
    document_ids: list[str] = []
    for inv in invoices:
        doc_id = await repo.save_invoice(
            tenant_id=ctx.tenant_id,
            file_name=f"{inv.invoice_id}.pdf",
            file_url=f"local://demo/ahmet_usta_firini/{inv.invoice_id}.pdf",
            invoice=inv,
        )
        document_ids.append(doc_id)

    job_id = await repo.create_job(
        tenant_id=ctx.tenant_id, period="6m", initial=make_initial_result(),
    )
    bg.add_task(
        _run,
        repo=repo,
        tenant_id=ctx.tenant_id,
        job_id=job_id,
        document_ids=document_ids,
        company_type=tenant.company_type,
        sector=tenant.sector,
        period=datetime.utcnow().strftime("%Y-%m"),
        include_all_tenant_data=True,
    )
    log.info("demo yüklendi tenant=%s job=%s invoices=%d", ctx.tenant_id, job_id, len(invoices))
    return DemoLoadOut(
        job_id=job_id, status="pending",
        invoice_count=len(invoices), document_ids=document_ids,
    )

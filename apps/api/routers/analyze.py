"""POST /analyze — orchestrator'ı arka planda başlat."""
import logging
from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel

from services.job_queue import queue
from agents.orchestrator import run_pipeline
from schemas.invoice import InvoiceData

log = logging.getLogger(__name__)
router = APIRouter(tags=["analyze"])


class AnalyzeRequest(BaseModel):
    invoice_ids: list[str]
    company_type: str
    sector: str
    period: str


async def _load_invoices(invoice_ids: list[str]) -> list[InvoiceData]:
    from services.job_queue import invoices as _invoice_store
    return await _invoice_store.get_many(invoice_ids)


async def _run(job_id: str, payload: "AnalyzeRequest") -> None:
    await queue.update_status(job_id, "processing")
    try:
        invoices = await _load_invoices(payload.invoice_ids)
        result = await run_pipeline(
            invoices=invoices, company_type=payload.company_type,
            sector=payload.sector, period=payload.period, job_id=job_id, auto_approve=True,
        )
        await queue.set_result(job_id, result)
    except Exception as e:  # noqa: BLE001
        log.exception("Pipeline hatası job=%s", job_id)
        cur = await queue.get_job(job_id)
        await queue.set_result(job_id, cur.model_copy(update={"status":"failed","error":str(e)}))


@router.post("/analyze", status_code=202)
async def start_analysis(req: AnalyzeRequest, bg: BackgroundTasks) -> dict:
    job_id = await queue.create_job()
    bg.add_task(_run, job_id, req)
    return {"job_id": job_id, "status": "pending"}


@router.get("/analyze/{job_id}")
async def get_analysis(job_id: str) -> dict:
    try:
        job = await queue.get_job(job_id)
    except KeyError:
        raise HTTPException(status_code=404, detail="job bulunamadı")
    return job.model_dump(mode="json")

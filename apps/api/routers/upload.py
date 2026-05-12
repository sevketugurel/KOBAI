"""POST /upload — PDF al, Gemini Vision ile parse et."""
import uuid
from fastapi import APIRouter, UploadFile, File, HTTPException

from config import settings
from services.gemini import GeminiService, GeminiParseError
from schemas.invoice import InvoiceData

router = APIRouter(tags=["upload"])
_service = GeminiService()


@router.post("/upload")
async def upload_invoice(file: UploadFile = File(...)) -> dict:
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Yalnızca PDF kabul edilir.")
    data = await file.read()
    if len(data) > settings.max_pdf_size_mb * 1024 * 1024:
        raise HTTPException(status_code=413, detail=f"Dosya {settings.max_pdf_size_mb}MB sınırını aşıyor.")
    try:
        invoice: InvoiceData = await _service.parse_invoice_pdf(data)
    except GeminiParseError as e:
        raise HTTPException(status_code=422, detail=f"Fatura ayrıştırılamadı: {e}") from e
    invoice = invoice.model_copy(update={"invoice_id": invoice.invoice_id or str(uuid.uuid4())})
    from services.job_queue import invoices as _invoice_store
    await _invoice_store.put(invoice)
    return {"invoice_id": invoice.invoice_id, "data": invoice.model_dump(mode="json")}

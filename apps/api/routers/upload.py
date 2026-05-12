"""POST /upload — PDF al, Gemini Vision ile parse et."""
import logging
import uuid
from fastapi import APIRouter, UploadFile, File, HTTPException
from google.api_core.exceptions import ResourceExhausted

from config import settings
from services.gemini import GeminiService, GeminiParseError
from schemas.invoice import InvoiceData

log = logging.getLogger(__name__)
router = APIRouter(tags=["upload"])
_service = GeminiService()

_QUOTA_DETAIL = (
    "Gemini API kotası veya istek sınırına ulaşıldı (ücretsiz planda dakika/gün limiti). "
    "Google AI Studio (https://aistudio.google.com) üzerinden kotayı kontrol edin, "
    "birkaç dakika bekleyip tekrar deneyin veya faturalandırma ile limiti yükseltin."
)


def _looks_like_pdf(file: UploadFile, data: bytes) -> bool:
    """Tarayıcılar bazen application/octet-stream veya boş MIME gönderir; %PDF imzası yeterlidir."""
    ct = (file.content_type or "").split(";")[0].strip().lower()
    if ct == "application/pdf":
        return True
    if ct in ("application/octet-stream", "binary/octet-stream", ""):
        if (file.filename or "").lower().endswith(".pdf"):
            return True
    return len(data) >= 4 and data[:4] == b"%PDF"


@router.post("/upload")
async def upload_invoice(file: UploadFile = File(...)) -> dict:
    data = await file.read()
    if not _looks_like_pdf(file, data):
        raise HTTPException(status_code=400, detail="Yalnızca PDF kabul edilir.")
    if len(data) > settings.max_pdf_size_mb * 1024 * 1024:
        raise HTTPException(status_code=413, detail=f"Dosya {settings.max_pdf_size_mb}MB sınırını aşıyor.")
    try:
        invoice: InvoiceData = await _service.parse_invoice_pdf(data)
    except GeminiParseError as e:
        raise HTTPException(status_code=422, detail=f"Fatura ayrıştırılamadı: {e}") from e
    except ResourceExhausted as e:
        log.warning("Gemini ResourceExhausted: %s", e)
        raise HTTPException(status_code=429, detail=_QUOTA_DETAIL) from e
    except Exception as e:  # noqa: BLE001
        log.exception("Gemini Vision / ağ hatası")
        raise HTTPException(
            status_code=502,
            detail=f"Fatura servisi hata verdi: {type(e).__name__}: {e}",
        ) from e
    invoice = invoice.model_copy(update={"invoice_id": invoice.invoice_id or str(uuid.uuid4())})
    from services.job_queue import invoices as _invoice_store
    await _invoice_store.put(invoice)
    return {"invoice_id": invoice.invoice_id, "data": invoice.model_dump(mode="json")}

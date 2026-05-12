"""Gemini istemcisi — Vision/Text/Embedding tek wrapper."""
import json
import asyncio
import google.generativeai as genai
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception,
)
from pydantic import ValidationError
from google.api_core.exceptions import ResourceExhausted

from config import settings
from schemas.invoice import InvoiceData


class GeminiParseError(Exception):
    """Gemini Vision çıktısı InvoiceData'ya dönüşmedi."""


def _retry_gemini_transient(exc: BaseException) -> bool:
    """True = tekrar dene. Kota (ResourceExhausted) ve parse hatalarında anında çık."""
    if isinstance(exc, ResourceExhausted):
        return False
    if isinstance(exc, GeminiParseError):
        return False
    return True


_VISION_SYSTEM_TR = (
    "Sen bir Türkçe fatura okuma asistanısın. Verilen PDF'ten faturayı oku ve "
    "SADECE şu JSON şemasına uyan bir nesne döndür: invoice_id, vendor_name, "
    "vendor_tax_no (yoksa 'NOT_MENTIONED'), date (YYYY-MM-DD), due_date (yoksa null), "
    "items[], subtotal, kdv_amount, total_amount, currency, category, raw_text. "
    "Açıklama metni ekleme, sadece JSON."
)


class GeminiService:
    def __init__(self, api_key: str | None = None) -> None:
        key = api_key or settings.gemini_api_key
        genai.configure(api_key=key)
        self._vision_model = genai.GenerativeModel(
            settings.gemini_vision_model,
            generation_config={"temperature": 0, "response_mime_type": "application/json"},
            system_instruction=_VISION_SYSTEM_TR,
        )
        self._text_model = genai.GenerativeModel(
            settings.gemini_text_model,
            generation_config={"temperature": 0.3},
        )

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(min=1, max=8),
        retry=retry_if_exception(_retry_gemini_transient),
        reraise=True,
    )
    async def parse_invoice_pdf(self, pdf_bytes: bytes) -> InvoiceData:
        resp = await self._vision_model.generate_content_async(
            [
                {"mime_type": "application/pdf", "data": pdf_bytes},
                "Bu faturayı JSON olarak çıkar.",
            ]
        )
        raw = getattr(resp, "text", None)
        if not raw or not str(raw).strip():
            raise GeminiParseError("Gemini boş yanıt döndü; PDF okunamadı veya güvenlik engeli olabilir.")
        try:
            data = json.loads(raw)
            return InvoiceData(**data)
        except (json.JSONDecodeError, TypeError, ValidationError) as e:
            raise GeminiParseError(f"Fatura ayrıştırılamadı: {e}") from e

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(min=1, max=8),
        retry=retry_if_exception(_retry_gemini_transient),
        reraise=True,
    )
    async def generate_text(self, prompt: str, context: str = "") -> str:
        full = f"{context}\n\n{prompt}" if context else prompt
        resp = await self._text_model.generate_content_async(full)
        return resp.text

    async def _embed_call(
        self, *, model: str, content: str, task_type: str, dim: int
    ) -> dict:
        return await asyncio.to_thread(
            genai.embed_content,
            model=model,
            content=content,
            task_type=task_type,
            output_dimensionality=dim,
        )

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(min=1, max=8),
        retry=retry_if_exception(_retry_gemini_transient),
        reraise=True,
    )
    async def embed_text(
        self, text: str, *, task_type: str = "RETRIEVAL_DOCUMENT"
    ) -> list[float]:
        result = await self._embed_call(
            model=settings.gemini_embed_model,
            content=text,
            task_type=task_type,
            dim=settings.gemini_embed_dim,
        )
        return result["embedding"]

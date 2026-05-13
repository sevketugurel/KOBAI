"""Banka ekstresi PDF → BankTransactionParsed listesi.

Akış:
  PDF bytes ─▶ Gemini Vision ─▶ JSON satırlar ─▶ Pydantic ─▶ kural-bazlı kategori

Kategori atama Faz 3'te kural bazlı (description regex). Faz 4+'da
Gemini'nin kendisinin kategoriyi önermesi denenebilir.
"""

from __future__ import annotations

import json
import logging
import re
from datetime import datetime
from decimal import Decimal, InvalidOperation
from typing import Any

import google.generativeai as genai
from google.api_core.exceptions import ResourceExhausted
from pydantic import ValidationError
from tenacity import retry, retry_if_exception, stop_after_attempt, wait_exponential

from config import settings
from schemas.bank import BankTransactionParsed, Category

log = logging.getLogger(__name__)


class BankParseError(Exception):
    """Gemini Vision çıktısı BankTransactionParsed listesine dönüşmedi."""


_VISION_SYSTEM_TR = (
    "Sen Türkçe banka ekstresi okuyan bir asistansın. Verilen PDF ekstresini analiz et "
    "ve SADECE şu JSON formatında dön:\n"
    '{ "bank_name": "is_bankasi|garanti|akbank|yapi_kredi|ziraat|halkbank|vakifbank|qnb_finansbank|denizbank|diger",\n'
    '  "account_iban": "TR... (yoksa null)",\n'
    '  "transactions": [\n'
    '    { "amount": "1234.56" (her zaman pozitif string),\n'
    '      "direction": "credit" (gelen para) | "debit" (giden para),\n'
    '      "transacted_at": "YYYY-MM-DDTHH:MM:SS" (saat yoksa T00:00:00),\n'
    '      "description": "kısa açıklama",\n'
    '      "reference_no": "ref no (yoksa null)" } ] }\n'
    "Hareket yoksa transactions=[]. Açıklama metni ekleme, sadece JSON."
)


def _retry_transient(exc: BaseException) -> bool:
    if isinstance(exc, ResourceExhausted):
        return False
    if isinstance(exc, BankParseError):
        return False
    return True


# Kural-bazlı kategori için description anahtar kelimeleri (öncelik sırasıyla).
_CATEGORY_RULES: list[tuple[Category, re.Pattern[str]]] = [
    ("vergi",       re.compile(r"\b(vergi|kdv|gvk|muhtasar|gel[ıi]r vergisi)\b", re.I)),
    ("sgk",         re.compile(r"\b(sgk|sosyal g[üu]venlik|bağkur|bagkur)\b", re.I)),
    ("personel",    re.compile(r"\b(maa[şs]|personel|[üu]cret|bordro)\b", re.I)),
    ("kira",        re.compile(r"\bkira\b", re.I)),
    ("hammadde",    re.compile(r"\b(hammadde|tedarik|malzeme)\b", re.I)),
    ("mal_satis",   re.compile(r"\b(sat[ıi][şs]|fatura tahsilat|m[üu][şs]teri)\b", re.I)),
    ("hizmet_satis",re.compile(r"\b(hizmet|dan[ıi][şs]manl[ıi]k|servis)\b", re.I)),
]


def categorize(description: str | None, *, direction: str) -> Category | None:
    """Basit regex-based kategori. Eşleşme yoksa None döner; UI/kullanıcı atayabilir.

    `direction` bilgisi `mal_satis`/`hizmet_satis` gibi gelen para kategorilerini
    sadece credit hareketlere uygulamak için kullanılır.
    """
    if not description:
        return None
    for cat, pattern in _CATEGORY_RULES:
        if pattern.search(description):
            if cat in ("mal_satis", "hizmet_satis") and direction != "credit":
                continue
            return cat
    return None


def _coerce_decimal(value: Any) -> Decimal:
    """Gemini bazen 1,234.56 / 1.234,56 / "1234.56" gönderir — sağlamlaştır."""
    if isinstance(value, (int, float, Decimal)):
        return Decimal(str(value))
    s = str(value).strip()
    # "1.234,56" (TR format) → "1234.56"
    if re.match(r"^\d{1,3}(\.\d{3})+,\d{1,2}$", s):
        s = s.replace(".", "").replace(",", ".")
    # "1,234.56" (US format) → "1234.56"
    elif re.match(r"^\d{1,3}(,\d{3})+(\.\d{1,2})?$", s):
        s = s.replace(",", "")
    # "1234,56" → "1234.56"
    elif re.match(r"^\d+,\d{1,2}$", s):
        s = s.replace(",", ".")
    try:
        return Decimal(s).quantize(Decimal("0.01"))
    except (InvalidOperation, ValueError) as e:
        raise BankParseError(f"tutar çözümlenemedi: {value!r}") from e


def _normalize_row(row: dict) -> dict:
    out = dict(row)
    if "amount" in out:
        out["amount"] = _coerce_decimal(out["amount"])
    return out


class BankStatementParser:
    """Gemini Vision'a bağlı parser; testte mock'lanabilir."""

    def __init__(self, model: Any | None = None) -> None:
        if model is None:
            genai.configure(api_key=settings.gemini_api_key)
            model = genai.GenerativeModel(
                settings.gemini_vision_model,
                generation_config={"temperature": 0, "response_mime_type": "application/json"},
                system_instruction=_VISION_SYSTEM_TR,
            )
        self._model = model

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(min=1, max=8),
        retry=retry_if_exception(_retry_transient),
        reraise=True,
    )
    async def parse(self, pdf_bytes: bytes) -> "ParsedStatement":
        resp = await self._model.generate_content_async(
            [
                {"mime_type": "application/pdf", "data": pdf_bytes},
                "Bu banka ekstresini JSON olarak çıkar.",
            ]
        )
        raw = getattr(resp, "text", None)
        if not raw or not str(raw).strip():
            raise BankParseError("Gemini boş yanıt döndü; ekstre okunamadı.")
        try:
            data = json.loads(raw)
        except json.JSONDecodeError as e:
            raise BankParseError(f"JSON parse edilemedi: {e}") from e

        bank_name = (data.get("bank_name") or "diger").strip().lower()
        iban = data.get("account_iban") or None
        rows = data.get("transactions") or []
        if not isinstance(rows, list):
            raise BankParseError("transactions alanı liste değil")

        parsed: list[BankTransactionParsed] = []
        for raw_row in rows:
            if not isinstance(raw_row, dict):
                continue
            try:
                norm = _normalize_row(raw_row)
                tx = BankTransactionParsed.model_validate(norm)
            except (ValidationError, BankParseError) as e:
                log.warning("ekstre satırı atlandı: %s — %s", e, raw_row)
                continue
            if tx.category is None:
                tx = tx.model_copy(update={
                    "category": categorize(tx.description, direction=tx.direction),
                })
            parsed.append(tx)
        return ParsedStatement(
            bank_name=bank_name,
            account_iban=iban,
            transactions=parsed,
            raw=data,
        )


# Dataclass-light: parser çıktısının container'ı.
from dataclasses import dataclass


@dataclass(frozen=True)
class ParsedStatement:
    bank_name: str
    account_iban: str | None
    transactions: list[BankTransactionParsed]
    raw: dict  # debug için ham Gemini çıktısı

"""Banka hareketi & ekstre şemaları (Faz 3)."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

Direction = Literal["credit", "debit"]
Category = Literal[
    "personel", "kira", "hammadde", "vergi",
    "sgk", "mal_satis", "hizmet_satis", "diger",
]
BankName = Literal[
    "is_bankasi", "garanti", "akbank", "yapi_kredi",
    "ziraat", "halkbank", "vakifbank", "qnb_finansbank", "denizbank",
    "diger",
]


class BankTransactionParsed(BaseModel):
    """Gemini Vision'ın çıkardığı tek satır — DB'ye yazılmadan önce normalize."""

    model_config = ConfigDict(extra="ignore")

    amount: Decimal
    direction: Direction
    transacted_at: datetime
    description: str | None = None
    reference_no: str | None = Field(default=None, max_length=64)
    category: Category | None = None


class BankTransactionOut(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    tenant_id: str
    source_document_id: str | None = None
    bank_name: str
    account_iban: str | None = None
    amount: Decimal
    currency: str
    direction: Direction
    description: str | None = None
    reference_no: str | None = None
    category: Category | None = None
    transacted_at: datetime
    created_at: datetime


class BankStatementImportResult(BaseModel):
    """POST /integrations/bank-statement → istemciye dönen özet."""

    model_config = ConfigDict(extra="forbid")

    document_id: str
    transactions_imported: int
    transactions_skipped_duplicate: int
    bank_name: str
    period_start: datetime | None = None
    period_end: datetime | None = None

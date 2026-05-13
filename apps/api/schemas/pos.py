"""Sanal POS şemaları (Faz 6 — iyzico Checkout BYOI)."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

PosProvider = Literal["iyzico_checkout", "craftgate"]
TxnType = Literal["sale", "refund", "void", "preauth"]
TxnStatus = Literal["success", "failed", "pending", "cancelled"]
PaymentMethod = Literal["credit_card", "debit_card", "wallet", "contactless"]


class PosConfigIn(BaseModel):
    """PUT /integrations/pos — tenant kendi iyzico hesabını bağlar."""

    model_config = ConfigDict(extra="forbid")

    provider: PosProvider = "iyzico_checkout"
    credentials: dict[str, Any] = Field(default_factory=dict)
    webhook_secret: str = Field(min_length=8, max_length=128)


class PosConfigOut(BaseModel):
    model_config = ConfigDict(extra="ignore")

    provider: PosProvider | None = None
    is_active: bool = False
    has_credentials: bool = False
    has_webhook_secret: bool = False
    last_sync_at: datetime | None = None
    last_error: str | None = None
    webhook_url: str | None = None


class PosTransactionOut(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    tenant_id: str
    pos_provider: str
    external_id: str
    amount: Decimal
    currency: str
    txn_type: TxnType
    status: TxnStatus
    payment_method: PaymentMethod | None = None
    installments: int = 1
    card_last_four: str | None = None
    description: str | None = None
    transacted_at: datetime
    created_at: datetime


class PosWebhookEvent(BaseModel):
    """iyzico'nun bizim normalize ettiğimiz event modeli.

    Gerçek iyzico response'unu Faz 7'de tam mappinge dökeriz; MVP'de
    entegratörün/ön-yüzün bu şemaya uygun JSON göndermesi varsayılır.
    """

    model_config = ConfigDict(extra="allow")

    event_type: Literal["payment_completed", "payment_failed", "refund", "ping"]
    external_id: str = Field(min_length=1, max_length=128)
    amount: Decimal | None = None
    currency: str = "TRY"
    txn_type: TxnType = "sale"
    status: TxnStatus = "success"
    payment_method: PaymentMethod | None = None
    installments: int = Field(default=1, ge=1, le=36)
    card_last_four: str | None = Field(default=None, max_length=4)
    description: str | None = None
    transacted_at: datetime


class PosWebhookAck(BaseModel):
    model_config = ConfigDict(extra="forbid")
    accepted: bool
    transaction_id: str | None = None
    duplicate: bool = False
    message: str


class PosDailySummary(BaseModel):
    model_config = ConfigDict(extra="forbid")
    date: str                                 # "2026-05-13"
    total_sales: Decimal
    total_refunds: Decimal
    net_amount: Decimal
    sale_count: int
    refund_count: int
    avg_ticket: Decimal | None

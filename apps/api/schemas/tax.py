"""Vergi takvimi şemaları (Faz 4)."""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

TaxType = Literal[
    "kdv", "muhtasar", "gecici_vergi", "sgk",
    "gelir_vergisi", "kurumlar_vergisi",
]
TaxStatus = Literal["pending", "paid", "overdue"]


class TaxCalendarItemOut(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    tenant_id: str
    title: str
    description: str | None = None
    tax_type: TaxType
    due_date: date
    amount: Decimal | None = None
    currency: str = "TRY"
    status: TaxStatus
    period: str | None = None
    notes: str | None = None
    created_at: datetime
    updated_at: datetime


class TaxCalendarItemCreate(BaseModel):
    """Seed sırasında DB'ye yazılan kayıt."""

    model_config = ConfigDict(extra="forbid")

    title: str
    description: str | None = None
    tax_type: TaxType
    due_date: date
    period: str | None = None


class TaxCalendarItemPatch(BaseModel):
    """PUT — kullanıcı `paid` işaretler veya amount/notes günceller."""

    model_config = ConfigDict(extra="forbid")

    status: TaxStatus | None = None
    amount: Decimal | None = Field(default=None, ge=0)
    notes: str | None = None


class DailyReminderResult(BaseModel):
    model_config = ConfigDict(extra="forbid")
    overdue_marked: int
    upcoming_in_window: int
    window_days: int

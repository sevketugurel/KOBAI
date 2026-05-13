"""Tenant dashboard özet şemaları (Sprint B).

Bu modül `GET /v2/tenants/{slug}/dashboard/summary` için response modelini
tanımlar. Aggregation backend servisinde (services.dashboard_summary)
yapılır; burada sadece şekil sözleşmesi yer alır.
"""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from schemas.tax import TaxCalendarItemOut

ActivityType = Literal["bank", "pos", "tax"]


class DashboardActivity(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    type: ActivityType
    title: str
    amount: Decimal | None = None
    currency: str = "TRY"
    timestamp: datetime


class DashboardSummaryOut(BaseModel):
    """Tek atomik snapshot — UI tüm KPI'ları bu objeden okur."""

    model_config = ConfigDict(extra="forbid")

    period_start: date = Field(..., description="Hesaplama penceresinin başlangıcı (ay başı)")
    period_end: date = Field(..., description="Hesaplama penceresinin bitişi (gün)")

    net_flow_this_month: Decimal
    pos_sales_this_month: Decimal
    upcoming_tax_count: int = Field(..., ge=0)
    integration_count: int = Field(..., ge=0)

    upcoming_taxes: list[TaxCalendarItemOut]
    recent_activities: list[DashboardActivity]

    updated_at: datetime

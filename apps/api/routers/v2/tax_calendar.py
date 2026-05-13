"""v2 vergi takvimi endpoint'leri (Faz 4).

Tenant-bound:
  GET    /v2/{slug}/tax-calendar
  PATCH  /v2/{slug}/tax-calendar/{item_id}

Cron (X-Cron-Secret korumalı, slug-suz):
  POST   /v2/cron/daily-reminders
"""

from __future__ import annotations

import logging
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, status

from config import settings
from middleware.tenant import require_tenant
from repositories.tax_repo import TaxRepo, get_tax_repo
from schemas.tax import (
    DailyReminderResult,
    TaxCalendarItemOut,
    TaxCalendarItemPatch,
)
from schemas.tenant import TenantContext

log = logging.getLogger(__name__)
tenant_router = APIRouter(prefix="/v2/{slug}", tags=["v2-tax-calendar"])
cron_router = APIRouter(prefix="/v2/cron", tags=["v2-cron"])


@tenant_router.get("/tax-calendar", response_model=list[TaxCalendarItemOut])
async def list_tax_calendar(
    ctx: Annotated[TenantContext, Depends(require_tenant)],
    repo: Annotated[TaxRepo, Depends(get_tax_repo)],
    upcoming_days: int | None = None,
    status_filter: str | None = None,
) -> list[TaxCalendarItemOut]:
    if status_filter and status_filter not in ("pending", "paid", "overdue"):
        raise HTTPException(status_code=400, detail="geçersiz status")
    return await repo.list_items(
        tenant_id=ctx.tenant_id,
        status=status_filter,
        upcoming_within_days=upcoming_days,
    )


@tenant_router.patch("/tax-calendar/{item_id}", response_model=TaxCalendarItemOut)
async def patch_tax_calendar(
    item_id: str,
    patch: TaxCalendarItemPatch,
    ctx: Annotated[TenantContext, Depends(require_tenant)],
    repo: Annotated[TaxRepo, Depends(get_tax_repo)],
) -> TaxCalendarItemOut:
    try:
        return await repo.patch_item(tenant_id=ctx.tenant_id, item_id=item_id, patch=patch)
    except KeyError as e:
        raise HTTPException(status_code=404, detail="kalem yok") from e


def require_cron_secret(
    x_cron_secret: Annotated[str | None, Header()] = None,
) -> None:
    """Cron endpoint'i için paylaşılan sır kontrolü."""
    if not settings.cron_secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="cron yapılandırılmamış (CRON_SECRET eksik)",
        )
    if not x_cron_secret or x_cron_secret != settings.cron_secret:
        raise HTTPException(status_code=401, detail="X-Cron-Secret eksik veya hatalı")


@cron_router.post("/daily-reminders", response_model=DailyReminderResult)
async def daily_reminders(
    _: Annotated[None, Depends(require_cron_secret)],
    repo: Annotated[TaxRepo, Depends(get_tax_repo)],
) -> DailyReminderResult:
    """Cloud Scheduler günlük tetikler.

    1) Geçmiş vadeli pending → overdue
    2) `reminder_window_days` içindeki kalemleri logla (e-posta v3'e)
    """
    today = date.today()
    overdue = await repo.mark_overdue_for_all_tenants(today=today)
    window = settings.reminder_window_days
    upcoming = await repo.list_upcoming_across_tenants(today=today, window_days=window)
    log.info(
        "daily_reminders: overdue=%d, upcoming(%dgün)=%d",
        overdue, window, len(upcoming),
    )
    return DailyReminderResult(
        overdue_marked=overdue,
        upcoming_in_window=len(upcoming),
        window_days=window,
    )

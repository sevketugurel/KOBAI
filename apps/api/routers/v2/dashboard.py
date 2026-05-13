"""GET /v2/tenants/{slug}/dashboard/summary (Sprint B).

İnce router: tenant guard + repo factory'leri çek, aggregate service'i çağır.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends

from middleware.tenant import require_tenant
from schemas.tenant import TenantContext
from repositories.bank_repo import BankRepo, get_bank_repo
from repositories.pos_repo import PosRepo, get_pos_repo
from repositories.tax_repo import TaxRepo, get_tax_repo
from schemas.dashboard import DashboardSummaryOut
from services.dashboard_summary import build_dashboard_summary

router = APIRouter(prefix="/v2/tenants", tags=["v2-dashboard"])


@router.get("/{slug}/dashboard/summary", response_model=DashboardSummaryOut)
async def get_dashboard_summary(
    ctx: Annotated[TenantContext, Depends(require_tenant)],
    bank_repo: Annotated[BankRepo, Depends(get_bank_repo)],
    pos_repo: Annotated[PosRepo, Depends(get_pos_repo)],
    tax_repo: Annotated[TaxRepo, Depends(get_tax_repo)],
) -> DashboardSummaryOut:
    return await build_dashboard_summary(
        tenant_id=ctx.tenant_id,
        bank_repo=bank_repo,
        pos_repo=pos_repo,
        tax_repo=tax_repo,
    )

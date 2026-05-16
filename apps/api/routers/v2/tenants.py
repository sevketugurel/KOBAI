"""POST/GET/PUT /v2/tenants — tenant CRUD + üyelik listesi.

İzolasyon kuralı: `require_tenant` dependency'si URL slug'ı ile kullanıcının
üyeliğini eşlemek zorundadır. Public/slug-bağımsız endpoint'ler (kayıt,
"benim tenant'larım") yalnızca `require_auth` kullanır.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from postgrest.exceptions import APIError

from middleware.tenant import AuthPrincipal, require_auth, require_tenant
from repositories.tenant_repo import TenantRepo, get_tenant_repo
from schemas.tenant import (
    MembershipOut,
    TenantContext,
    TenantCreate,
    TenantOut,
    TenantUpdate,
)
from services.agent_events import AgentEvent, get_event_bus
from services.tax_calendar import build_initial_calendar

import logging

log = logging.getLogger(__name__)
router = APIRouter(prefix="/v2/tenants", tags=["v2-tenants"])


async def _seed_tax_calendar_best_effort(tenant_id: str, slug: str, company_type: str) -> None:
    """Tenant kayıt sonrası 12 aylık takvimi yaz. Hata olursa log düş, akışı bozma.

    Dependency-injection yerine doğrudan factory'yi çağırıyoruz; testte tax_repo
    Supabase'e gitmesin diye `get_tax_repo` monkeypatch'lenir veya factory
    `SupabaseNotConfigured` raise edip swallow edilir.
    """
    try:
        from repositories.tax_repo import get_tax_repo

        items = build_initial_calendar(company_type=company_type)
        seeded = await get_tax_repo().bulk_seed(tenant_id=tenant_id, items=items)
        log.info("tenant=%s için %d vergi takvimi kalemi seed edildi", slug, seeded)
    except Exception:  # noqa: BLE001
        log.exception("tax calendar seed başarısız (tenant=%s)", slug)


@router.post("", status_code=status.HTTP_201_CREATED, response_model=TenantOut)
async def register_tenant(
    payload: TenantCreate,
    principal: Annotated[AuthPrincipal, Depends(require_auth)],
    repo: Annotated[TenantRepo, Depends(get_tenant_repo)],
) -> TenantOut:
    """Yeni KOBİ kaydı. Caller otomatik 'owner' üye olur.

    Faz 4: tenant kaydından hemen sonra 12 aylık vergi takvimi seed edilir
    (best-effort, başarısız olursa tenant yine de oluşur).
    """
    try:
        tenant = await repo.create_tenant_with_owner(payload, owner_user_id=principal.user_id)
    except APIError as e:
        # 23505 unique_violation = slug çakışması
        if getattr(e, "code", None) == "23505" or "duplicate" in str(e).lower():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"slug zaten kullanımda: {payload.slug}",
            ) from e
        raise

    await _seed_tax_calendar_best_effort(
        tenant_id=tenant.id, slug=tenant.slug, company_type=payload.company_type,
    )
    return tenant


@router.get("/me", response_model=list[TenantOut])
async def list_my_tenants(
    principal: Annotated[AuthPrincipal, Depends(require_auth)],
    repo: Annotated[TenantRepo, Depends(get_tenant_repo)],
) -> list[TenantOut]:
    """JWT sahibinin üyesi olduğu tenant'lar."""
    return await repo.list_for_user(principal.user_id)


@router.get("/{slug}", response_model=TenantOut)
async def get_tenant(
    ctx: Annotated[TenantContext, Depends(require_tenant)],
    repo: Annotated[TenantRepo, Depends(get_tenant_repo)],
) -> TenantOut:
    tenant = await repo.get_by_slug(ctx.tenant_slug)
    if tenant is None:
        raise HTTPException(status_code=404, detail="tenant yok")
    return tenant


@router.put("/{slug}", response_model=TenantOut)
async def update_tenant(
    patch: TenantUpdate,
    ctx: Annotated[TenantContext, Depends(require_tenant)],
    repo: Annotated[TenantRepo, Depends(get_tenant_repo)],
) -> TenantOut:
    if ctx.role not in ("owner", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="yalnızca owner/admin tenant düzenleyebilir",
        )
    updated = await repo.update(ctx.tenant_slug, patch)
    changed = patch.model_dump(exclude_unset=True)
    if changed:
        await get_event_bus().emit(AgentEvent(
            tenant_id=ctx.tenant_id,
            event_type="tenant.profile.updated",
            payload={"changed": sorted(changed.keys())},
        ))
    return updated


@router.get("/{slug}/members", response_model=list[MembershipOut])
async def list_members(
    ctx: Annotated[TenantContext, Depends(require_tenant)],
    repo: Annotated[TenantRepo, Depends(get_tenant_repo)],
) -> list[MembershipOut]:
    return await repo.list_members(ctx.tenant_id)

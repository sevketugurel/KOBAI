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

router = APIRouter(prefix="/v2/tenants", tags=["v2-tenants"])


@router.post("", status_code=status.HTTP_201_CREATED, response_model=TenantOut)
async def register_tenant(
    payload: TenantCreate,
    principal: Annotated[AuthPrincipal, Depends(require_auth)],
    repo: Annotated[TenantRepo, Depends(get_tenant_repo)],
) -> TenantOut:
    """Yeni KOBİ kaydı. Caller otomatik 'owner' üye olur."""
    try:
        return await repo.create_tenant_with_owner(payload, owner_user_id=principal.user_id)
    except APIError as e:
        # 23505 unique_violation = slug çakışması
        if getattr(e, "code", None) == "23505" or "duplicate" in str(e).lower():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"slug zaten kullanımda: {payload.slug}",
            ) from e
        raise


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
    return await repo.update(ctx.tenant_slug, patch)


@router.get("/{slug}/members", response_model=list[MembershipOut])
async def list_members(
    ctx: Annotated[TenantContext, Depends(require_tenant)],
    repo: Annotated[TenantRepo, Depends(get_tenant_repo)],
) -> list[MembershipOut]:
    return await repo.list_members(ctx.tenant_id)

"""JWT doğrulama + slug→tenant çözümleme.

Akış::

    Frontend ──Authorization: Bearer <Supabase JWT>──▶ FastAPI
       └── require_auth   → AuthPrincipal(user_id, email)
       └── require_tenant → TenantContext(user_id, tenant_id, slug, role)
                            ⇣  (URL'deki {slug} ile memberships kontrolü)
                            └── uyuşmazlık = 403

Service-role client RLS'i bypass eder; tenant izolasyonu repository
katmanındaki explicit `tenant_id` filter ile sağlanır. RLS sadece
defense-in-depth (yanlış kod yazılırsa son savunma).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Annotated

import jwt
from fastapi import Depends, Header, HTTPException, Path, status

from config import settings
from repositories.tenant_repo import TenantRepo, get_tenant_repo
from schemas.tenant import TenantContext


# JWT içinde Supabase'in koyduğu sabit audience.
_SUPABASE_AUD = "authenticated"


@dataclass(frozen=True)
class AuthPrincipal:
    """Slug-bağımsız kimlik. `require_auth` döndürür."""

    user_id: str
    email: str | None


class _AuthError(HTTPException):
    def __init__(self, detail: str) -> None:
        super().__init__(status_code=status.HTTP_401_UNAUTHORIZED, detail=detail)


def _extract_bearer(authorization: str | None) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise _AuthError("Authorization Bearer token gerekli")
    return authorization.split(" ", 1)[1].strip()


def _decode_jwt(token: str) -> dict:
    if not settings.supabase_jwt_secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="v2 auth yapılandırılmamış (SUPABASE_JWT_SECRET eksik)",
        )
    try:
        return jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            audience=_SUPABASE_AUD,
        )
    except jwt.ExpiredSignatureError as e:
        raise _AuthError("token süresi dolmuş") from e
    except jwt.InvalidAudienceError as e:
        raise _AuthError("geçersiz token (audience)") from e
    except jwt.InvalidTokenError as e:
        raise _AuthError(f"geçersiz token: {e}") from e


def require_auth(
    authorization: Annotated[str | None, Header()] = None,
) -> AuthPrincipal:
    """Slug bağımsız: yalnızca JWT geçerli mi kontrol eder."""
    token = _extract_bearer(authorization)
    claims = _decode_jwt(token)
    user_id = claims.get("sub")
    if not user_id:
        raise _AuthError("token sub claim eksik")
    return AuthPrincipal(user_id=user_id, email=claims.get("email"))


async def require_tenant(
    slug: Annotated[str, Path(..., description="Tenant slug")],
    principal: Annotated[AuthPrincipal, Depends(require_auth)],
    repo: Annotated[TenantRepo, Depends(get_tenant_repo)],
) -> TenantContext:
    """URL'deki `{slug}` ile kullanıcının üyeliğini eşler. Yoksa 403.

    Repo `Depends(get_tenant_repo)` ile inject edilir; test'lerde
    `app.dependency_overrides[get_tenant_repo] = lambda: fake_repo`.
    """
    tenant = await repo.get_by_slug(slug)
    if tenant is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="tenant yok")
    membership = await repo.get_membership(tenant_id=tenant.id, user_id=principal.user_id)
    if membership is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="bu tenant'a erişim yetkin yok",
        )
    return TenantContext(
        user_id=principal.user_id,
        user_email=principal.email,
        tenant_id=tenant.id,
        tenant_slug=tenant.slug,
        role=membership.role,
    )

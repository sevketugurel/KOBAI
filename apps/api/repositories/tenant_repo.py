"""Tenant + Membership DAO."""

from __future__ import annotations

from typing import Protocol

from schemas.tenant import MembershipOut, TenantCreate, TenantOut, TenantUpdate


class TenantRepo(Protocol):
    """Test'lerde fake ile değiştirilebilir."""

    async def create_tenant_with_owner(
        self, payload: TenantCreate, *, owner_user_id: str
    ) -> TenantOut: ...

    async def get_by_slug(self, slug: str) -> TenantOut | None: ...

    async def update(self, slug: str, patch: TenantUpdate) -> TenantOut: ...

    async def list_for_user(self, user_id: str) -> list[TenantOut]: ...

    async def get_membership(self, *, tenant_id: str, user_id: str) -> MembershipOut | None: ...

    async def list_members(self, tenant_id: str) -> list[MembershipOut]: ...


class SupabaseTenantRepo:
    """Supabase Postgrest üzerinden gerçek DAO."""

    def __init__(self, client) -> None:  # supabase.Client — döngüsel import kaçınılır
        self._db = client

    async def create_tenant_with_owner(
        self, payload: TenantCreate, *, owner_user_id: str
    ) -> TenantOut:
        ins = (
            self._db.table("tenants")
            .insert(
                {
                    "slug": payload.slug,
                    "display_name": payload.display_name,
                    "sector": payload.sector,
                    "company_type": payload.company_type,
                    "tax_number": payload.tax_number,
                }
            )
            .execute()
        )
        if not ins.data:
            raise RuntimeError("tenant insert boş döndü")
        row = ins.data[0]
        # İlk üyelik owner rolüyle
        self._db.table("memberships").insert(
            {"tenant_id": row["id"], "user_id": owner_user_id, "role": "owner"}
        ).execute()
        return TenantOut.model_validate(row)

    async def get_by_slug(self, slug: str) -> TenantOut | None:
        res = (
            self._db.table("tenants")
            .select("*")
            .eq("slug", slug)
            .limit(1)
            .execute()
        )
        if not res.data:
            return None
        return TenantOut.model_validate(res.data[0])

    async def update(self, slug: str, patch: TenantUpdate) -> TenantOut:
        payload = patch.model_dump(exclude_none=True)
        res = (
            self._db.table("tenants")
            .update(payload)
            .eq("slug", slug)
            .execute()
        )
        if not res.data:
            raise KeyError(slug)
        return TenantOut.model_validate(res.data[0])

    async def list_for_user(self, user_id: str) -> list[TenantOut]:
        # memberships → tenants join
        res = (
            self._db.table("memberships")
            .select("tenants(*)")
            .eq("user_id", user_id)
            .execute()
        )
        return [TenantOut.model_validate(row["tenants"]) for row in (res.data or []) if row.get("tenants")]

    async def get_membership(self, *, tenant_id: str, user_id: str) -> MembershipOut | None:
        res = (
            self._db.table("memberships")
            .select("*")
            .eq("tenant_id", tenant_id)
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        if not res.data:
            return None
        return MembershipOut.model_validate(res.data[0])

    async def list_members(self, tenant_id: str) -> list[MembershipOut]:
        res = (
            self._db.table("memberships")
            .select("*")
            .eq("tenant_id", tenant_id)
            .execute()
        )
        return [MembershipOut.model_validate(r) for r in (res.data or [])]


_singleton: SupabaseTenantRepo | None = None


def get_tenant_repo() -> TenantRepo:
    """FastAPI Depends() ile inject edilebilir factory."""
    global _singleton
    if _singleton is None:
        from supabase_client import get_service_client

        _singleton = SupabaseTenantRepo(get_service_client())
    return _singleton


def _reset_for_tests() -> None:
    global _singleton
    _singleton = None

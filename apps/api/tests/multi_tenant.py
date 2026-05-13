"""Multi-tenant test fixture iskeleti (Faz 0).

Bu modül v2 fazlarında ortaya çıkacak Supabase-backed test'lerin
kullanacağı sözleşmeyi tanımlar. Faz 0'da Supabase wiring'i yok;
fixture saf in-memory veri üretir ve `TenantContext` tipini sağlar.

Faz 1'de TenantContext.client gerçek Supabase client'a bağlanır
ve `two_tenants_with_users` fixture'ı seed kayıtlarını DB'ye yazar.

Cross-tenant izolasyon test deseni::

    def test_documents_isolation(client, two_tenants_with_users):
        a, b = two_tenants_with_users
        # A'nın token'ıyla B'nin slug'una git → 403 beklenir
        r = client.get(f"/v2/{b.tenant.slug}/documents", headers=a.auth_header)
        assert r.status_code == 403
        assert_no_cross_tenant_leak(r.json(), foreign_tenant_id=b.tenant.id)
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any
from uuid import uuid4

import pytest


@dataclass(frozen=True)
class TenantStub:
    id: str
    slug: str
    display_name: str
    sector: str
    company_type: str


@dataclass(frozen=True)
class UserStub:
    id: str
    email: str
    jwt: str  # Faz 1'de gerçek Supabase JWT; Faz 0'da placeholder string

    @property
    def auth_header(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self.jwt}"}


@dataclass(frozen=True)
class TenantContext:
    """Bir tenant + owner kullanıcısı + auth bilgisi paketi."""

    tenant: TenantStub
    owner: UserStub
    extras: dict[str, Any] = field(default_factory=dict)

    @property
    def auth_header(self) -> dict[str, str]:
        return self.owner.auth_header


def _make_context(slug: str, display_name: str, sector: str) -> TenantContext:
    tenant_id = str(uuid4())
    user_id = str(uuid4())
    return TenantContext(
        tenant=TenantStub(
            id=tenant_id,
            slug=slug,
            display_name=display_name,
            sector=sector,
            company_type="sahis_sirketi",
        ),
        owner=UserStub(
            id=user_id,
            email=f"owner@{slug}.test",
            jwt=f"stub-jwt-{tenant_id}",
        ),
    )


@pytest.fixture
def two_tenants_with_users() -> tuple[TenantContext, TenantContext]:
    """İki bağımsız tenant + owner kullanıcı.

    Faz 0: yalnızca veri stub'ları. Faz 1'de bu fixture Supabase'e
    gerçek tenant + membership kayıtları yazacak ve test sonunda
    cleanup yapacak.
    """
    a = _make_context("acme-firini", "Acme Fırını", "gida_perakende")
    b = _make_context("zeta-tekstil", "Zeta Tekstil", "imalat")
    return a, b


def assert_no_cross_tenant_leak(payload: Any, *, foreign_tenant_id: str) -> None:
    """JSON response içinde `foreign_tenant_id` string'i geçmemeli.

    Defensive helper: bir cevap tenant A için döndüyse içinde tenant B'nin
    UUID'sinin görünmemesi gerekir. Recursive olarak dict/list içinde arar.
    """

    def _walk(node: Any) -> None:
        if isinstance(node, dict):
            for v in node.values():
                _walk(v)
        elif isinstance(node, list):
            for v in node:
                _walk(v)
        elif isinstance(node, str):
            assert foreign_tenant_id not in node, (
                f"Cross-tenant leak: foreign tenant id {foreign_tenant_id!r} "
                f"response içinde bulundu"
            )

    _walk(payload)

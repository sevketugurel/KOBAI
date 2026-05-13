"""Faz 0 smoke test: multi-tenant fixture sözleşmesi.

Faz 1'de gerçek izolasyon testleri buraya değil
`test_multi_tenant_isolation.py` adında ayrı dosyaya gidecek.
Burada sadece fixture'ın import ve davranışını doğruluyoruz.
"""

import pytest

from tests.multi_tenant import (
    TenantContext,
    assert_no_cross_tenant_leak,
    two_tenants_with_users,  # noqa: F401 — pytest fixture re-export
)


def test_two_tenants_have_distinct_ids(two_tenants_with_users) -> None:
    a, b = two_tenants_with_users
    assert isinstance(a, TenantContext)
    assert isinstance(b, TenantContext)
    assert a.tenant.id != b.tenant.id
    assert a.tenant.slug != b.tenant.slug
    assert a.owner.id != b.owner.id


def test_auth_header_format(two_tenants_with_users) -> None:
    a, _ = two_tenants_with_users
    assert a.auth_header["Authorization"].startswith("Bearer ")


def test_assert_no_leak_passes_on_clean_payload(two_tenants_with_users) -> None:
    a, b = two_tenants_with_users
    clean = {"items": [{"tenant_id": a.tenant.id, "name": "Acme"}]}
    assert_no_cross_tenant_leak(clean, foreign_tenant_id=b.tenant.id)


def test_assert_no_leak_detects_foreign_id(two_tenants_with_users) -> None:
    a, b = two_tenants_with_users
    leaky = {"items": [{"tenant_id": b.tenant.id}]}
    with pytest.raises(AssertionError, match="Cross-tenant leak"):
        assert_no_cross_tenant_leak(leaky, foreign_tenant_id=b.tenant.id)

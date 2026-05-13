"""schemas/tenant.py slug ve validasyon kuralları."""

import pytest
from pydantic import ValidationError

from schemas.tenant import TenantCreate


def _payload(slug: str) -> dict:
    return {
        "slug": slug,
        "display_name": "Test",
        "sector": "hizmet",
        "company_type": "sahis_sirketi",
    }


@pytest.mark.parametrize("slug", ["acme", "acme-firini", "abc123", "kobi-2026-test"])
def test_valid_slugs(slug: str) -> None:
    t = TenantCreate.model_validate(_payload(slug))
    assert t.slug == slug


@pytest.mark.parametrize(
    "slug",
    ["ab", "AcMe", "-leading", "trailing-", "with space", "punct!", "x" * 51],
)
def test_invalid_slug_format(slug: str) -> None:
    with pytest.raises(ValidationError):
        TenantCreate.model_validate(_payload(slug))


@pytest.mark.parametrize("slug", ["api", "admin", "app", "www", "static", "health", "demo", "v1", "v2"])
def test_reserved_slugs_rejected(slug: str) -> None:
    with pytest.raises(ValidationError, match="rezerve"):
        TenantCreate.model_validate(_payload(slug))


def test_unknown_sector_rejected() -> None:
    p = _payload("acme")
    p["sector"] = "uzay-madenciligi"
    with pytest.raises(ValidationError):
        TenantCreate.model_validate(p)


def test_unknown_company_type_rejected() -> None:
    p = _payload("acme")
    p["company_type"] = "kooperatif"
    with pytest.raises(ValidationError):
        TenantCreate.model_validate(p)

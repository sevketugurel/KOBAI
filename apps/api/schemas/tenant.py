"""v2 multi-tenant Pydantic modelleri."""

from __future__ import annotations

import re
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

Sector = Literal[
    "gida_perakende",
    "hizmet",
    "imalat",
    "perakende",
    "insaat",
    "tarim",
    "diger",
]
CompanyType = Literal["sahis_sirketi", "ltd_sti", "as"]
Role = Literal["owner", "admin", "member", "viewer"]

# Migration `tenants_slug_format` CHECK ile uyumlu olmalı.
_SLUG_RE = re.compile(r"^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$")
_RESERVED_SLUGS = frozenset({"api", "admin", "app", "www", "static", "health", "demo", "v1", "v2"})


def _validate_slug(v: str) -> str:
    v = v.strip()
    # Rezerve liste önce — kullanıcıya niye reddedildiğini netçe söyle.
    # (`v1`/`v2` regex'in min uzunluğunu geçmez; yine de rezerve mesajı dönsün.)
    if v.lower() in _RESERVED_SLUGS:
        raise ValueError(f"slug rezerve: {v}")
    if not _SLUG_RE.match(v):
        raise ValueError("slug: 3-50 karakter, küçük harf/rakam/tire, baş-son tire olmaz")
    return v


class TenantCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    # Uzunluk + format kontrolü _validate_slug içinde (rezerve mesajını
    # `min_length` kuralının önüne almak için).
    slug: str = Field(..., max_length=50)
    display_name: str = Field(..., min_length=1, max_length=200)
    sector: Sector
    company_type: CompanyType
    tax_number: str | None = Field(default=None, max_length=20)

    @field_validator("slug")
    @classmethod
    def _slug_ok(cls, v: str) -> str:
        return _validate_slug(v)


class TenantOut(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    slug: str
    display_name: str
    sector: str
    company_type: str
    tax_number: str | None = None
    is_active: bool = True
    created_at: datetime


class TenantUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    display_name: str | None = Field(default=None, min_length=1, max_length=200)
    sector: Sector | None = None
    tax_number: str | None = Field(default=None, max_length=20)


class MembershipOut(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    tenant_id: str
    user_id: str
    role: Role
    created_at: datetime


class TenantContext(BaseModel):
    """Middleware'in `request.state.tenant_ctx`'e yazdığı resolved context."""

    model_config = ConfigDict(extra="forbid")

    user_id: str
    user_email: str | None = None
    tenant_id: str
    tenant_slug: str
    role: Role

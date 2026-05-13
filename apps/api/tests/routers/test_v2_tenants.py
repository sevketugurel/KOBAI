"""POST/GET/PUT /v2/tenants — FakeRepo ile izolasyon + 403/404/409 senaryoları.

Supabase'e gerçek çağrı yok. Tüm DB davranışı `FakeTenantRepo` ile in-memory
simüle edilir. JWT doğrulaması da dependency override ile bypass'lanır.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

from main import app
from middleware.tenant import AuthPrincipal, require_auth
from repositories.tenant_repo import TenantRepo, get_tenant_repo
from schemas.tenant import MembershipOut, TenantCreate, TenantOut, TenantUpdate


# ────────────────────────────── Fake repo ──────────────────────────────


class FakeTenantRepo:
    def __init__(self) -> None:
        self.tenants: dict[str, TenantOut] = {}
        self.memberships: list[MembershipOut] = []

    async def create_tenant_with_owner(self, payload: TenantCreate, *, owner_user_id: str) -> TenantOut:
        if any(t.slug == payload.slug for t in self.tenants.values()):
            from postgrest.exceptions import APIError

            raise APIError({"message": "duplicate key", "code": "23505"})
        tid = str(uuid.uuid4())
        t = TenantOut(
            id=tid,
            slug=payload.slug,
            display_name=payload.display_name,
            sector=payload.sector,
            company_type=payload.company_type,
            tax_number=payload.tax_number,
            is_active=True,
            created_at=datetime.now(timezone.utc),
        )
        self.tenants[tid] = t
        self.memberships.append(
            MembershipOut(
                id=str(uuid.uuid4()),
                tenant_id=tid,
                user_id=owner_user_id,
                role="owner",
                created_at=datetime.now(timezone.utc),
            )
        )
        return t

    async def get_by_slug(self, slug: str) -> TenantOut | None:
        for t in self.tenants.values():
            if t.slug == slug:
                return t
        return None

    async def update(self, slug: str, patch: TenantUpdate) -> TenantOut:
        for tid, t in self.tenants.items():
            if t.slug == slug:
                data = t.model_dump()
                data.update(patch.model_dump(exclude_none=True))
                updated = TenantOut.model_validate(data)
                self.tenants[tid] = updated
                return updated
        raise KeyError(slug)

    async def list_for_user(self, user_id: str) -> list[TenantOut]:
        ids = {m.tenant_id for m in self.memberships if m.user_id == user_id}
        return [self.tenants[i] for i in ids if i in self.tenants]

    async def get_membership(self, *, tenant_id: str, user_id: str) -> MembershipOut | None:
        for m in self.memberships:
            if m.tenant_id == tenant_id and m.user_id == user_id:
                return m
        return None

    async def list_members(self, tenant_id: str) -> list[MembershipOut]:
        return [m for m in self.memberships if m.tenant_id == tenant_id]


# ────────────────────────────── Fixtures ──────────────────────────────


USER_A = str(uuid.uuid4())
USER_B = str(uuid.uuid4())


@pytest.fixture
def repo() -> FakeTenantRepo:
    return FakeTenantRepo()


@pytest.fixture
def client_for_user(repo: FakeTenantRepo):
    """Verilen user_id ile auth'lanmış TestClient döndürür."""

    def _make(user_id: str, email: str = "u@x.test") -> TestClient:
        app.dependency_overrides[require_auth] = lambda: AuthPrincipal(user_id=user_id, email=email)
        app.dependency_overrides[get_tenant_repo] = lambda: repo
        return TestClient(app)

    yield _make
    app.dependency_overrides.clear()


# ────────────────────────────── Testler ──────────────────────────────


def test_register_tenant_creates_owner_membership(client_for_user, repo: FakeTenantRepo) -> None:
    c = client_for_user(USER_A)
    r = c.post(
        "/v2/tenants",
        json={
            "slug": "acme-firini",
            "display_name": "Acme Fırını",
            "sector": "gida_perakende",
            "company_type": "sahis_sirketi",
        },
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["slug"] == "acme-firini"
    # Üyelik owner olarak yazılmış olmalı
    members = [m for m in repo.memberships if m.tenant_id == body["id"]]
    assert len(members) == 1
    assert members[0].user_id == USER_A
    assert members[0].role == "owner"


def test_register_invalid_slug_422(client_for_user) -> None:
    c = client_for_user(USER_A)
    r = c.post(
        "/v2/tenants",
        json={
            "slug": "InvalidUPPER",
            "display_name": "X",
            "sector": "hizmet",
            "company_type": "sahis_sirketi",
        },
    )
    assert r.status_code == 422


def test_register_reserved_slug_422(client_for_user) -> None:
    c = client_for_user(USER_A)
    r = c.post(
        "/v2/tenants",
        json={
            "slug": "admin",
            "display_name": "X",
            "sector": "hizmet",
            "company_type": "sahis_sirketi",
        },
    )
    assert r.status_code == 422


def test_register_duplicate_slug_409(client_for_user) -> None:
    c = client_for_user(USER_A)
    payload = {
        "slug": "acme-firini",
        "display_name": "Acme",
        "sector": "hizmet",
        "company_type": "sahis_sirketi",
    }
    c.post("/v2/tenants", json=payload)
    r = c.post("/v2/tenants", json=payload)
    assert r.status_code == 409


def test_list_my_tenants_returns_only_own(client_for_user, repo: FakeTenantRepo) -> None:
    # A iki tenant oluştur, B bir tenant
    ca = client_for_user(USER_A)
    for slug in ("a-co", "a-two"):
        r = ca.post("/v2/tenants", json={"slug": slug, "display_name": slug, "sector": "hizmet", "company_type": "sahis_sirketi"})
        assert r.status_code == 201, r.text
    cb = client_for_user(USER_B)
    r = cb.post("/v2/tenants", json={"slug": "b-co", "display_name": "B", "sector": "hizmet", "company_type": "sahis_sirketi"})
    assert r.status_code == 201, r.text

    ra = client_for_user(USER_A).get("/v2/tenants/me")
    rb = client_for_user(USER_B).get("/v2/tenants/me")
    assert {t["slug"] for t in ra.json()} == {"a-co", "a-two"}
    assert {t["slug"] for t in rb.json()} == {"b-co"}


def test_cross_tenant_get_returns_403(client_for_user) -> None:
    # A bir tenant kurar, B aynı slug'a GET denemesi → 403
    ca = client_for_user(USER_A)
    ca.post("/v2/tenants", json={"slug": "a-only", "display_name": "A", "sector": "hizmet", "company_type": "sahis_sirketi"})

    cb = client_for_user(USER_B)
    r = cb.get("/v2/tenants/a-only")
    assert r.status_code == 403


def test_get_nonexistent_tenant_404(client_for_user) -> None:
    c = client_for_user(USER_A)
    r = c.get("/v2/tenants/yok-boyle-tenant")
    assert r.status_code == 404


def test_update_requires_owner_or_admin(client_for_user, repo: FakeTenantRepo) -> None:
    # A owner olarak tenant açar, B "member" olarak elle eklenir → B update edemez
    ca = client_for_user(USER_A)
    r = ca.post("/v2/tenants", json={"slug": "shared", "display_name": "Shared", "sector": "hizmet", "company_type": "sahis_sirketi"})
    tid = r.json()["id"]
    repo.memberships.append(
        MembershipOut(
            id=str(uuid.uuid4()),
            tenant_id=tid,
            user_id=USER_B,
            role="member",
            created_at=datetime.now(timezone.utc),
        )
    )
    cb = client_for_user(USER_B)
    r = cb.put("/v2/tenants/shared", json={"display_name": "Hijacked"})
    assert r.status_code == 403


def test_owner_can_update(client_for_user) -> None:
    ca = client_for_user(USER_A)
    ca.post("/v2/tenants", json={"slug": "editme", "display_name": "Old", "sector": "hizmet", "company_type": "sahis_sirketi"})
    r = ca.put("/v2/tenants/editme", json={"display_name": "New"})
    assert r.status_code == 200
    assert r.json()["display_name"] == "New"


def test_unauthenticated_request_401(client_for_user) -> None:
    # dependency override yapmadan TestClient kur
    app.dependency_overrides.clear()
    c = TestClient(app)
    r = c.get("/v2/tenants/me")
    # JWT secret ayarsız → 503; secret varsa header eksik → 401. İki durumu da kabul et.
    assert r.status_code in (401, 503)

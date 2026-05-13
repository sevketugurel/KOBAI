"""v2 tax-calendar router + cron endpoint."""

from __future__ import annotations

import uuid
from datetime import date, datetime, timezone

import pytest
from fastapi.testclient import TestClient

from config import settings
from main import app
from middleware.tenant import AuthPrincipal, require_auth
from repositories.tax_repo import get_tax_repo
from repositories.tenant_repo import MembershipOut, TenantOut, get_tenant_repo
from schemas.tax import TaxCalendarItemCreate, TaxCalendarItemOut, TaxCalendarItemPatch


# ── Fake repos ────────────────────────────────────────────────────────


class FakeTaxRepo:
    def __init__(self) -> None:
        self.rows: list[dict] = []

    async def bulk_seed(self, *, tenant_id, items):
        seeded = 0
        for it in items:
            key = (tenant_id, it.tax_type, it.period or it.due_date.isoformat())
            if any(
                (r["tenant_id"], r["tax_type"], r["period"] or r["due_date"]) == key
                for r in self.rows
            ):
                continue
            self.rows.append({
                "id": str(uuid.uuid4()),
                "tenant_id": tenant_id,
                "title": it.title,
                "description": it.description,
                "tax_type": it.tax_type,
                "due_date": it.due_date.isoformat(),
                "amount": None,
                "currency": "TRY",
                "status": "pending",
                "period": it.period,
                "notes": None,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            })
            seeded += 1
        return seeded

    async def list_items(self, *, tenant_id, status=None, upcoming_within_days=None):
        rows = [r for r in self.rows if r["tenant_id"] == tenant_id]
        if status:
            rows = [r for r in rows if r["status"] == status]
        rows.sort(key=lambda r: r["due_date"])
        return [TaxCalendarItemOut.model_validate(r) for r in rows]

    async def patch_item(self, *, tenant_id, item_id, patch: TaxCalendarItemPatch):
        for r in self.rows:
            if r["id"] == item_id and r["tenant_id"] == tenant_id:
                for k, v in patch.model_dump(exclude_none=True).items():
                    r[k] = float(v) if k == "amount" else v
                r["updated_at"] = datetime.now(timezone.utc).isoformat()
                return TaxCalendarItemOut.model_validate(r)
        raise KeyError(item_id)

    async def mark_overdue_for_all_tenants(self, *, today):
        count = 0
        for r in self.rows:
            if r["status"] == "pending" and r["due_date"] < today.isoformat():
                r["status"] = "overdue"
                count += 1
        return count

    async def list_upcoming_across_tenants(self, *, today, window_days):
        from datetime import timedelta
        upper = (today + timedelta(days=window_days)).isoformat()
        rows = [
            r for r in self.rows
            if r["status"] == "pending"
            and today.isoformat() <= r["due_date"] <= upper
        ]
        return [TaxCalendarItemOut.model_validate(r) for r in rows]


class FakeTenantRepoMin:
    def __init__(self, tenants, members):
        self._tenants = tenants
        self._members = members

    async def get_by_slug(self, slug):
        for t in self._tenants.values():
            if t.slug == slug:
                return t
        return None

    async def get_membership(self, *, tenant_id, user_id):
        for m in self._members:
            if m.tenant_id == tenant_id and m.user_id == user_id:
                return m
        return None

    async def create_tenant_with_owner(self, *a, **k): ...
    async def update(self, *a, **k): ...
    async def list_for_user(self, *a, **k): return []
    async def list_members(self, *a, **k): return []


# ── Fixtures ──────────────────────────────────────────────────────────


USER_A = str(uuid.uuid4())
USER_B = str(uuid.uuid4())
TENANT_A = str(uuid.uuid4())
TENANT_B = str(uuid.uuid4())


def _t(tid, slug):
    return TenantOut(
        id=tid, slug=slug, display_name=slug, sector="hizmet",
        company_type="sahis_sirketi", tax_number=None, is_active=True,
        created_at=datetime.now(timezone.utc),
    )


def _m(tid, uid):
    return MembershipOut(
        id=str(uuid.uuid4()), tenant_id=tid, user_id=uid, role="owner",
        created_at=datetime.now(timezone.utc),
    )


@pytest.fixture
def tax_repo() -> FakeTaxRepo:
    return FakeTaxRepo()


@pytest.fixture
def tenant_repo() -> FakeTenantRepoMin:
    return FakeTenantRepoMin(
        tenants={TENANT_A: _t(TENANT_A, "acme-co"), TENANT_B: _t(TENANT_B, "zeta-co")},
        members=[_m(TENANT_A, USER_A), _m(TENANT_B, USER_B)],
    )


@pytest.fixture
def client_for(tax_repo, tenant_repo):
    def _make(user_id: str) -> TestClient:
        app.dependency_overrides[require_auth] = lambda: AuthPrincipal(user_id=user_id, email="x@y")
        app.dependency_overrides[get_tax_repo] = lambda: tax_repo
        app.dependency_overrides[get_tenant_repo] = lambda: tenant_repo
        return TestClient(app)
    yield _make
    app.dependency_overrides.clear()


def _seed_some(tax_repo: FakeTaxRepo, tenant_id: str) -> str:
    """Bir kalem seed eder, id'sini döner."""
    import asyncio
    items = [
        TaxCalendarItemCreate(
            title="Test KDV", tax_type="kdv",
            due_date=date(2099, 1, 28), period="2098-12",
        ),
    ]
    asyncio.get_event_loop().run_until_complete(tax_repo.bulk_seed(tenant_id=tenant_id, items=items))
    return next(r["id"] for r in tax_repo.rows if r["tenant_id"] == tenant_id)


# ── Listing & PATCH ───────────────────────────────────────────────────


def test_list_isolated_per_tenant(client_for, tax_repo: FakeTaxRepo) -> None:
    _seed_some(tax_repo, TENANT_A)
    ra = client_for(USER_A).get("/v2/acme-co/tax-calendar")
    rb = client_for(USER_B).get("/v2/zeta-co/tax-calendar")
    assert ra.status_code == 200 and len(ra.json()) == 1
    assert rb.status_code == 200 and rb.json() == []


def test_cross_tenant_list_forbidden(client_for, tax_repo: FakeTaxRepo) -> None:
    _seed_some(tax_repo, TENANT_A)
    r = client_for(USER_B).get("/v2/acme-co/tax-calendar")
    assert r.status_code == 403


def test_patch_mark_paid(client_for, tax_repo: FakeTaxRepo) -> None:
    item_id = _seed_some(tax_repo, TENANT_A)
    r = client_for(USER_A).patch(
        f"/v2/acme-co/tax-calendar/{item_id}",
        json={"status": "paid", "amount": "1234.56"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "paid"
    assert float(body["amount"]) == 1234.56


def test_patch_cross_tenant_404(client_for, tax_repo: FakeTaxRepo) -> None:
    item_id = _seed_some(tax_repo, TENANT_A)
    # B kendi tenant'ında bu item id'sini güncellemeye çalışsın → 404
    r = client_for(USER_B).patch(
        f"/v2/zeta-co/tax-calendar/{item_id}",
        json={"status": "paid"},
    )
    assert r.status_code == 404


def test_invalid_status_filter_400(client_for) -> None:
    r = client_for(USER_A).get("/v2/acme-co/tax-calendar?status_filter=invalid")
    assert r.status_code == 400


# ── Cron ──────────────────────────────────────────────────────────────


@pytest.fixture
def cron_enabled(monkeypatch):
    monkeypatch.setattr(settings, "cron_secret", "test-secret")
    yield "test-secret"


def test_cron_without_secret_401(client_for) -> None:
    c = client_for(USER_A)  # auth override sadece JWT için; cron auth ayrı
    r = c.post("/v2/cron/daily-reminders")
    # cron_secret None → 503
    assert r.status_code in (401, 503)


def test_cron_wrong_secret_401(client_for, cron_enabled) -> None:
    c = client_for(USER_A)
    r = c.post("/v2/cron/daily-reminders", headers={"X-Cron-Secret": "wrong"})
    assert r.status_code == 401


def test_cron_marks_overdue_and_lists_upcoming(client_for, cron_enabled, tax_repo: FakeTaxRepo) -> None:
    # Bir geçmiş vadeli + bir yaklaşan kalem seed et
    today = date.today()
    from datetime import timedelta
    import asyncio
    past = TaxCalendarItemCreate(
        title="geçmiş", tax_type="kdv",
        due_date=today - timedelta(days=2), period="past-x",
    )
    soon = TaxCalendarItemCreate(
        title="yakın", tax_type="sgk",
        due_date=today + timedelta(days=3), period="soon-x",
    )
    asyncio.get_event_loop().run_until_complete(
        tax_repo.bulk_seed(tenant_id=TENANT_A, items=[past, soon])
    )
    c = client_for(USER_A)
    r = c.post("/v2/cron/daily-reminders", headers={"X-Cron-Secret": "test-secret"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["overdue_marked"] == 1
    assert body["upcoming_in_window"] == 1
    # past kalemi overdue olmalı
    past_row = next(r for r in tax_repo.rows if r["period"] == "past-x")
    assert past_row["status"] == "overdue"

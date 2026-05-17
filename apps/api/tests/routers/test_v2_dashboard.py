"""GET /v2/tenants/{slug}/dashboard/summary (Sprint B)."""

from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient

from main import app
from middleware.tenant import AuthPrincipal, require_auth
from repositories.bank_repo import get_bank_repo
from repositories.agent_snapshot_repo import AgentSnapshot, InMemoryAgentSnapshotRepo, get_agent_snapshot_repo
from repositories.pos_repo import get_pos_repo
from repositories.tax_repo import get_tax_repo
from repositories.tenant_repo import MembershipOut, TenantOut, get_tenant_repo
from schemas.bank import BankTransactionOut
from schemas.pos import PosTransactionOut
from schemas.tax import TaxCalendarItemOut
from services.dashboard_summary import build_dashboard_summary


USER_A = str(uuid.uuid4())
USER_OUTSIDER = str(uuid.uuid4())
TENANT_A = str(uuid.uuid4())
TENANT_B = str(uuid.uuid4())


def _t(tid, slug):
    return TenantOut(
        id=tid, slug=slug, display_name=slug, sector="hizmet",
        company_type="sahis_sirketi", tax_number=None, is_active=True,
        created_at=datetime.now(timezone.utc),
    )


def _m(tid, uid, role="owner"):
    return MembershipOut(
        id=str(uuid.uuid4()), tenant_id=tid, user_id=uid, role=role,
        created_at=datetime.now(timezone.utc),
    )


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


class FakeBankRepo:
    def __init__(self, txns_by_tenant=None, integrations_by_tenant=None):
        self.txns_by_tenant = txns_by_tenant or {}
        self.integrations_by_tenant = integrations_by_tenant or {}

    async def list_transactions(self, *, tenant_id, limit=100):
        return list(self.txns_by_tenant.get(tenant_id, []))[:limit]

    async def list_integrations(self, *, tenant_id):
        return list(self.integrations_by_tenant.get(tenant_id, []))

    # protocol filler
    async def create_document(self, *a, **k): ...
    async def bulk_insert_transactions(self, *a, **k): ...
    async def upsert_integration(self, *a, **k): ...


class FakePosRepo:
    def __init__(self, txns_by_tenant=None):
        self.txns_by_tenant = txns_by_tenant or {}

    async def list_transactions(self, *, tenant_id, limit=100):
        return list(self.txns_by_tenant.get(tenant_id, []))[:limit]

    # protocol filler
    async def upsert_provider(self, *a, **k): ...
    async def get_provider(self, *a, **k): ...
    async def mark_webhook_received(self, *a, **k): ...
    async def insert_transaction(self, *a, **k): ...
    async def daily_summary(self, *a, **k): ...


class FakeTaxRepo:
    def __init__(self, items_by_tenant=None):
        self.items_by_tenant = items_by_tenant or {}

    async def list_items(self, *, tenant_id, status=None, upcoming_within_days=None):
        return list(self.items_by_tenant.get(tenant_id, []))

    # protocol filler
    async def bulk_seed(self, *a, **k): return 0
    async def patch_item(self, *a, **k): ...
    async def mark_overdue_for_all_tenants(self, *a, **k): return 0
    async def list_upcoming_across_tenants(self, *a, **k): return []


def _bank(tenant_id, *, amount, direction, when):
    return BankTransactionOut(
        id=str(uuid.uuid4()),
        tenant_id=tenant_id,
        source_document_id=None,
        bank_name="akbank",
        account_iban=None,
        amount=Decimal(str(amount)),
        currency="TRY",
        direction=direction,
        description="test",
        reference_no=None,
        category=None,
        transacted_at=when,
        created_at=datetime.now(timezone.utc),
    )


def _pos(tenant_id, *, amount, status, txn_type, when):
    return PosTransactionOut(
        id=str(uuid.uuid4()),
        tenant_id=tenant_id,
        pos_provider="iyzico_checkout",
        external_id=str(uuid.uuid4()),
        amount=Decimal(str(amount)),
        currency="TRY",
        txn_type=txn_type,
        status=status,
        payment_method="credit_card",
        installments=1,
        card_last_four=None,
        description=None,
        transacted_at=when,
        created_at=datetime.now(timezone.utc),
    )


def _tax(tenant_id, *, title, due_date, status="pending"):
    now = datetime.now(timezone.utc)
    return TaxCalendarItemOut(
        id=str(uuid.uuid4()),
        tenant_id=tenant_id,
        title=title,
        description=None,
        tax_type="kdv",
        due_date=due_date,
        amount=None,
        currency="TRY",
        status=status,
        period=None,
        notes=None,
        created_at=now,
        updated_at=now,
    )


@pytest.fixture
def tenant_repo():
    return FakeTenantRepoMin(
        tenants={TENANT_A: _t(TENANT_A, "acme-co"), TENANT_B: _t(TENANT_B, "zeta-co")},
        members=[_m(TENANT_A, USER_A)],
    )


@pytest.fixture
def client_for(tenant_repo):
    state = {
        "bank": FakeBankRepo(),
        "pos": FakePosRepo(),
        "tax": FakeTaxRepo(),
        "snapshots": InMemoryAgentSnapshotRepo(),
    }

    def _make(*, user_id, bank=None, pos=None, tax=None, snapshots=None):
        if bank is not None:
            state["bank"] = bank
        if pos is not None:
            state["pos"] = pos
        if tax is not None:
            state["tax"] = tax
        if snapshots is not None:
            state["snapshots"] = snapshots
        app.dependency_overrides[require_auth] = lambda: AuthPrincipal(user_id=user_id, email="x@y")
        app.dependency_overrides[get_tenant_repo] = lambda: tenant_repo
        app.dependency_overrides[get_bank_repo] = lambda: state["bank"]
        app.dependency_overrides[get_pos_repo] = lambda: state["pos"]
        app.dependency_overrides[get_tax_repo] = lambda: state["tax"]
        app.dependency_overrides[get_agent_snapshot_repo] = lambda: state["snapshots"]
        return TestClient(app)

    yield _make
    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_dashboard_summary_aggregates_current_month():
    today = date.today()
    first_of_month = today.replace(day=1)
    last_month = (first_of_month).replace(day=1)
    # construct a "last month" datetime via subtracting one day from first_of_month
    from datetime import timedelta
    last_month_dt = datetime.combine(first_of_month - timedelta(days=1), datetime.min.time(), tzinfo=timezone.utc)
    this_month_dt = datetime.combine(today, datetime.min.time(), tzinfo=timezone.utc)

    bank = FakeBankRepo(
        txns_by_tenant={
            TENANT_A: [
                _bank(TENANT_A, amount=1000, direction="credit", when=this_month_dt),
                _bank(TENANT_A, amount=300, direction="debit", when=this_month_dt),
                # geçen ay — sayılmamalı
                _bank(TENANT_A, amount=999, direction="credit", when=last_month_dt),
            ]
        },
        integrations_by_tenant={
            TENANT_A: [
                {"id": "i1", "provider": "akbank", "is_active": True},
                {"id": "i2", "provider": "garanti", "is_active": False},  # pasif
            ]
        },
    )
    pos = FakePosRepo(
        txns_by_tenant={
            TENANT_A: [
                _pos(TENANT_A, amount=500, status="success", txn_type="sale", when=this_month_dt),
                _pos(TENANT_A, amount=50, status="success", txn_type="refund", when=this_month_dt),  # sayılmamalı
                _pos(TENANT_A, amount=200, status="failed", txn_type="sale", when=this_month_dt),  # sayılmamalı
            ]
        }
    )
    tax = FakeTaxRepo(
        items_by_tenant={
            TENANT_A: [
                _tax(TENANT_A, title="KDV", due_date=today + timedelta(days=5)),
                _tax(TENANT_A, title="Muhtasar", due_date=today + timedelta(days=15)),
                _tax(TENANT_A, title="SGK", due_date=today + timedelta(days=25)),
                _tax(TENANT_A, title="GV", due_date=today + timedelta(days=60)),  # pencere dışı
                _tax(TENANT_A, title="Paid", due_date=today + timedelta(days=2), status="paid"),
            ]
        }
    )
    summary = await build_dashboard_summary(
        tenant_id=TENANT_A,
        bank_repo=bank,
        pos_repo=pos,
        tax_repo=tax,
        snapshot_repo=InMemoryAgentSnapshotRepo(),
        today=today,
    )
    body = summary.model_dump(mode="json")
    assert Decimal(body["net_flow_this_month"]) == Decimal("700")
    assert Decimal(body["pos_sales_this_month"]) == Decimal("500")
    assert body["upcoming_tax_count"] == 3
    assert body["integration_count"] == 1
    assert len(body["upcoming_taxes"]) == 3
    assert body["recommended_actions"]
    titles = [t["title"] for t in body["upcoming_taxes"]]
    assert titles == ["KDV", "Muhtasar", "SGK"]
    assert len(body["recent_activities"]) <= 10


@pytest.mark.asyncio
async def test_dashboard_summary_prefers_risk_snapshot_actions(client_for):
    snapshots = InMemoryAgentSnapshotRepo()
    await snapshots.upsert(AgentSnapshot(
        tenant_id=TENANT_A,
        agent_name="risk",
        status="completed",
        input_version_hash="hash-1",
        output={
            "risk_recommended_actions": [
                {
                    "title": "Risk aksiyonu",
                    "detail": "Öncelikli risk snapshot aksiyonu.",
                    "priority": "high",
                    "due_hint": "Bugün",
                    "source_agent": "risk",
                }
            ]
        },
    ))
    client = client_for(user_id=USER_A, snapshots=snapshots)
    res = client.get("/v2/tenants/acme-co/dashboard/summary")
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["recommended_actions"][0]["title"] == "Risk aksiyonu"


def test_dashboard_summary_returns_403_for_non_member(client_for):
    client = client_for(user_id=USER_OUTSIDER)
    res = client.get("/v2/tenants/acme-co/dashboard/summary")
    assert res.status_code == 403


def test_dashboard_summary_404_for_unknown_slug(client_for):
    client = client_for(user_id=USER_A)
    res = client.get("/v2/tenants/yok-bu/dashboard/summary")
    assert res.status_code == 404


def test_dashboard_summary_empty_state(client_for):
    client = client_for(user_id=USER_A)
    res = client.get("/v2/tenants/acme-co/dashboard/summary")
    assert res.status_code == 200, res.text
    body = res.json()
    assert Decimal(body["net_flow_this_month"]) == Decimal("0")
    assert Decimal(body["pos_sales_this_month"]) == Decimal("0")
    assert body["upcoming_tax_count"] == 0
    assert body["integration_count"] == 0
    assert body["upcoming_taxes"] == []
    assert body["recent_activities"] == []
    assert body["recommended_actions"] == []

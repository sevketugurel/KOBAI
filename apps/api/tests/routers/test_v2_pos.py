"""v2 sanal POS router — config + webhook + idempotency + summary."""

from __future__ import annotations

import hashlib
import hmac
import json
import uuid
from datetime import date, datetime, timezone
from decimal import Decimal

import pytest
from cryptography.fernet import Fernet
from fastapi.testclient import TestClient

from config import settings
from main import app
from middleware.tenant import AuthPrincipal, require_auth
from repositories.pos_repo import get_pos_repo
from repositories.tenant_repo import MembershipOut, TenantOut, get_tenant_repo
from schemas.pos import PosTransactionOut
from services import encryption


# ── Fakes ─────────────────────────────────────────────────────────────


class FakePosRepo:
    def __init__(self) -> None:
        self.rows: dict[str, dict] = {}                     # tenant_id → integration
        self.txns: list[dict] = []
        self.unique_index: dict[tuple[str, str], str] = {}  # (provider, external_id) → txn_id

    async def upsert_provider(self, *, tenant_id, provider, encrypted_credentials, encrypted_webhook_secret):
        self.rows[tenant_id] = {
            "id": str(uuid.uuid4()),
            "tenant_id": tenant_id,
            "provider": provider,
            "is_active": True,
            "credentials": {
                "cipher": encrypted_credentials,
                "webhook_secret_cipher": encrypted_webhook_secret,
            },
            "last_sync_at": None,
            "last_error": None,
        }
        return self.rows[tenant_id]

    async def get_provider(self, *, tenant_id):
        return self.rows.get(tenant_id)

    async def mark_webhook_received(self, *, tenant_id, last_error=None):
        if tenant_id in self.rows:
            self.rows[tenant_id]["last_sync_at"] = datetime.now(timezone.utc).isoformat()
            self.rows[tenant_id]["last_error"] = last_error

    async def insert_transaction(self, *, tenant_id, event):
        provider = (self.rows.get(tenant_id) or {}).get("provider") or "iyzico_checkout"
        key = (provider, event.external_id)
        if key in self.unique_index:
            return self.unique_index[key], True
        txn_id = str(uuid.uuid4())
        self.unique_index[key] = txn_id
        self.txns.append({
            "id": txn_id, "tenant_id": tenant_id, "pos_provider": provider,
            "external_id": event.external_id,
            "amount": str(event.amount or Decimal("0")),
            "currency": event.currency,
            "txn_type": event.txn_type, "status": event.status,
            "payment_method": event.payment_method,
            "installments": event.installments,
            "card_last_four": event.card_last_four,
            "description": event.description,
            "transacted_at": event.transacted_at.isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        return txn_id, False

    async def list_transactions(self, *, tenant_id, limit=100):
        rows = [r for r in self.txns if r["tenant_id"] == tenant_id]
        rows.sort(key=lambda r: r["transacted_at"], reverse=True)
        return [PosTransactionOut.model_validate(r) for r in rows[:limit]]

    async def daily_summary(self, *, tenant_id, target):
        target_iso = target.isoformat()
        same_day = [
            r for r in self.txns
            if r["tenant_id"] == tenant_id and r["transacted_at"].startswith(target_iso)
        ]
        sales = [r for r in same_day if r["txn_type"] == "sale" and r["status"] == "success"]
        refunds = [r for r in same_day if r["txn_type"] == "refund" and r["status"] == "success"]
        total_sales = sum(Decimal(r["amount"]) for r in sales)
        total_refunds = sum(Decimal(r["amount"]) for r in refunds)
        return {
            "date": target_iso,
            "total_sales": total_sales,
            "total_refunds": total_refunds,
            "net_amount": total_sales - total_refunds,
            "sale_count": len(sales),
            "refund_count": len(refunds),
            "avg_ticket": (total_sales / len(sales)) if sales else None,
        }


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


def _m(tid, uid, role="owner"):
    return MembershipOut(
        id=str(uuid.uuid4()), tenant_id=tid, user_id=uid, role=role,
        created_at=datetime.now(timezone.utc),
    )


@pytest.fixture(autouse=True)
def _enc_key(monkeypatch):
    monkeypatch.setattr(settings, "encryption_key", Fernet.generate_key().decode())
    encryption._reset_for_tests()
    yield
    encryption._reset_for_tests()


@pytest.fixture
def pos_repo() -> FakePosRepo:
    return FakePosRepo()


@pytest.fixture
def tenant_repo() -> FakeTenantRepoMin:
    return FakeTenantRepoMin(
        tenants={TENANT_A: _t(TENANT_A, "acme-co"), TENANT_B: _t(TENANT_B, "zeta-co")},
        members=[_m(TENANT_A, USER_A), _m(TENANT_B, USER_B)],
    )


@pytest.fixture
def client_for(pos_repo, tenant_repo):
    def _make(user_id):
        if user_id is not None:
            app.dependency_overrides[require_auth] = lambda: AuthPrincipal(user_id=user_id, email="x@y")
        app.dependency_overrides[get_pos_repo] = lambda: pos_repo
        app.dependency_overrides[get_tenant_repo] = lambda: tenant_repo
        return TestClient(app)
    yield _make
    app.dependency_overrides.clear()


def _sign(body: bytes, secret: str) -> str:
    return hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()


def _config(secret="webhook-secret-1"):
    return {
        "provider": "iyzico_checkout",
        "credentials": {"api_key": "demo", "secret_key": "demo2"},
        "webhook_secret": secret,
    }


def _payment_event(external_id="P-001", amount=150.0, txn_type="sale"):
    return {
        "event_type": "payment_completed",
        "external_id": external_id,
        "amount": amount,
        "currency": "TRY",
        "txn_type": txn_type,
        "status": "success",
        "payment_method": "credit_card",
        "installments": 1,
        "card_last_four": "4242",
        "transacted_at": datetime.now(timezone.utc).isoformat(),
    }


# ── PUT/GET config ────────────────────────────────────────────────────


def test_put_config_encrypts(client_for, pos_repo: FakePosRepo) -> None:
    c = client_for(USER_A)
    r = c.put("/v2/acme-co/integrations/pos", json=_config())
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["has_credentials"] is True
    assert body["webhook_url"].endswith(f"/v2/pos/webhook/{TENANT_A}")
    creds = pos_repo.rows[TENANT_A]["credentials"]
    # Plain creds cipher içinde olmamalı
    assert "demo" not in creds["cipher"]


def test_get_config_hides_credentials(client_for) -> None:
    client_for(USER_A).put("/v2/acme-co/integrations/pos", json=_config())
    r = client_for(USER_A).get("/v2/acme-co/integrations/pos")
    body = r.json()
    payload = json.dumps(body)
    assert "demo" not in payload
    assert "cipher" not in payload


def test_put_config_member_403(client_for, tenant_repo) -> None:
    tenant_repo._members.append(_m(TENANT_A, USER_B, role="member"))
    r = client_for(USER_B).put("/v2/acme-co/integrations/pos", json=_config())
    assert r.status_code == 403


# ── Webhook ───────────────────────────────────────────────────────────


def test_webhook_sale_persists(client_for, pos_repo: FakePosRepo) -> None:
    client_for(USER_A).put("/v2/acme-co/integrations/pos", json=_config(secret="s-okok-1"))
    body = json.dumps(_payment_event()).encode("utf-8")
    sig = _sign(body, "s-okok-1")
    r = client_for(None).post(
        f"/v2/pos/webhook/{TENANT_A}",
        content=body,
        headers={"X-Pos-Signature": sig, "Content-Type": "application/json"},
    )
    assert r.status_code == 200, r.text
    body_out = r.json()
    assert body_out["accepted"] is True
    assert body_out["duplicate"] is False
    assert body_out["transaction_id"]
    assert len(pos_repo.txns) == 1


def test_webhook_duplicate_is_idempotent(client_for, pos_repo: FakePosRepo) -> None:
    client_for(USER_A).put("/v2/acme-co/integrations/pos", json=_config(secret="dup-secret"))
    body = json.dumps(_payment_event(external_id="DUP-1")).encode("utf-8")
    sig = _sign(body, "dup-secret")
    headers = {"X-Pos-Signature": sig, "Content-Type": "application/json"}
    r1 = client_for(None).post(f"/v2/pos/webhook/{TENANT_A}", content=body, headers=headers)
    r2 = client_for(None).post(f"/v2/pos/webhook/{TENANT_A}", content=body, headers=headers)
    assert r1.status_code == 200 and r2.status_code == 200
    assert r1.json()["duplicate"] is False
    assert r2.json()["duplicate"] is True
    assert r1.json()["transaction_id"] == r2.json()["transaction_id"]
    assert len(pos_repo.txns) == 1


def test_webhook_wrong_signature_401(client_for) -> None:
    client_for(USER_A).put("/v2/acme-co/integrations/pos", json=_config(secret="real-one"))
    body = json.dumps(_payment_event()).encode("utf-8")
    r = client_for(None).post(
        f"/v2/pos/webhook/{TENANT_A}",
        content=body,
        headers={"X-Pos-Signature": "deadbeef", "Content-Type": "application/json"},
    )
    assert r.status_code == 401


def test_webhook_unknown_tenant_401(client_for) -> None:
    body = json.dumps(_payment_event()).encode("utf-8")
    sig = _sign(body, "anything")
    r = client_for(None).post(
        f"/v2/pos/webhook/{str(uuid.uuid4())}",
        content=body,
        headers={"X-Pos-Signature": sig, "Content-Type": "application/json"},
    )
    assert r.status_code == 401


def test_webhook_ping(client_for, pos_repo: FakePosRepo) -> None:
    client_for(USER_A).put("/v2/acme-co/integrations/pos", json=_config(secret="ping-sec1"))
    body = json.dumps({"event_type": "ping",
                       "external_id": "PING",
                       "transacted_at": datetime.now(timezone.utc).isoformat()}).encode("utf-8")
    sig = _sign(body, "ping-sec1")
    r = client_for(None).post(
        f"/v2/pos/webhook/{TENANT_A}",
        content=body,
        headers={"X-Pos-Signature": sig, "Content-Type": "application/json"},
    )
    assert r.status_code == 200
    assert pos_repo.txns == []
    assert pos_repo.rows[TENANT_A]["last_sync_at"] is not None


def test_webhook_bad_body_422(client_for) -> None:
    client_for(USER_A).put("/v2/acme-co/integrations/pos", json=_config(secret="bad-body1"))
    body = b'{"event_type": "alien", "external_id": "x", "transacted_at": "2026-05-13T00:00:00Z"}'
    sig = _sign(body, "bad-body1")
    r = client_for(None).post(
        f"/v2/pos/webhook/{TENANT_A}",
        content=body,
        headers={"X-Pos-Signature": sig, "Content-Type": "application/json"},
    )
    assert r.status_code == 422


# ── Listing + summary ─────────────────────────────────────────────────


def test_list_transactions_isolated(client_for, pos_repo: FakePosRepo) -> None:
    # A tenant'ına bir webhook gönder
    client_for(USER_A).put("/v2/acme-co/integrations/pos", json=_config(secret="iso-sec-1"))
    body = json.dumps(_payment_event(external_id="A-1")).encode("utf-8")
    sig = _sign(body, "iso-sec-1")
    client_for(None).post(
        f"/v2/pos/webhook/{TENANT_A}",
        content=body,
        headers={"X-Pos-Signature": sig, "Content-Type": "application/json"},
    )
    ra = client_for(USER_A).get("/v2/acme-co/pos/transactions")
    rb = client_for(USER_B).get("/v2/zeta-co/pos/transactions")
    assert ra.status_code == 200 and len(ra.json()) == 1
    assert rb.status_code == 200 and rb.json() == []


def test_summary_sales_minus_refunds(client_for) -> None:
    client_for(USER_A).put("/v2/acme-co/integrations/pos", json=_config(secret="sum-secret"))
    headers_factory = lambda body: {  # noqa: E731
        "X-Pos-Signature": _sign(body, "sum-secret"),
        "Content-Type": "application/json",
    }
    today = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    sale = json.dumps({**_payment_event(external_id="S1", amount=200), "transacted_at": today}).encode("utf-8")
    refund = json.dumps({**_payment_event(external_id="R1", amount=50, txn_type="refund"),
                         "transacted_at": today}).encode("utf-8")
    client_for(None).post(f"/v2/pos/webhook/{TENANT_A}", content=sale, headers=headers_factory(sale))
    client_for(None).post(f"/v2/pos/webhook/{TENANT_A}", content=refund, headers=headers_factory(refund))

    r = client_for(USER_A).get("/v2/acme-co/pos/summary")
    assert r.status_code == 200, r.text
    body = r.json()
    assert float(body["total_sales"]) == 200.0
    assert float(body["total_refunds"]) == 50.0
    assert float(body["net_amount"]) == 150.0
    assert body["sale_count"] == 1
    assert body["refund_count"] == 1


def test_summary_invalid_date_400(client_for) -> None:
    r = client_for(USER_A).get("/v2/acme-co/pos/summary?target_date=not-a-date")
    assert r.status_code == 400

"""Ajan readiness matrisi: hangi ajan hangi minimum veriyle hazır olur."""

from __future__ import annotations

from datetime import date, datetime, timezone
from decimal import Decimal

import pytest

from agents.readiness import (
    AGENT_NAMES,
    check_readiness,
    compute_version_hash,
)
from schemas.bank import BankTransactionOut
from schemas.invoice import InvoiceData, InvoiceItem
from schemas.pos import PosTransactionOut
from services.tenant_context import TenantAnalysisContext


def _ctx(**overrides) -> TenantAnalysisContext:
    base = dict(
        tenant_id="tenant-1",
        tenant_profile={},
        invoices=[],
        bank_transactions=[],
        pos_transactions=[],
        tax_calendar_items=[],
        past_analyses=[],
    )
    base.update(overrides)
    return TenantAnalysisContext(**base)


def _invoice(month: int, *, total: float = 1000, category: str = "gelir") -> InvoiceData:
    item = InvoiceItem(
        description="x", quantity=1, unit_price=total / 1.2,
        total=total / 1.2, kdv_rate=20,
    )
    return InvoiceData(
        invoice_id=f"inv-{month}",
        vendor_name="V",
        vendor_tax_no="NOT_MENTIONED",
        date=date(2026, month, 1),
        due_date=None,
        items=[item],
        subtotal=total / 1.2,
        kdv_amount=total - total / 1.2,
        total_amount=total,
        currency="TRY",
        category=category,
        raw_text=None,
    )


def _bank(amount: float = 1000, direction: str = "credit") -> BankTransactionOut:
    return BankTransactionOut(
        id="b1", tenant_id="tenant-1", bank_name="is_bankasi",
        amount=Decimal(str(amount)), currency="TRY", direction=direction,
        transacted_at=datetime(2026, 1, 15, tzinfo=timezone.utc),
        created_at=datetime(2026, 1, 15, tzinfo=timezone.utc),
    )


def _pos(status: str = "success", txn_type: str = "sale") -> PosTransactionOut:
    return PosTransactionOut(
        id="p1", tenant_id="tenant-1", pos_provider="iyzico_checkout",
        external_id="ext-1", amount=Decimal("500"), currency="TRY",
        txn_type=txn_type, status=status,
        transacted_at=datetime(2026, 1, 15, tzinfo=timezone.utc),
        created_at=datetime(2026, 1, 15, tzinfo=timezone.utc),
    )


# --- nakit_akisi ---

def test_nakit_akisi_not_ready_empty():
    r = check_readiness("nakit_akisi", _ctx())
    assert not r.ready
    assert r.missing


def test_nakit_akisi_ready_with_invoice():
    r = check_readiness("nakit_akisi", _ctx(invoices=[_invoice(1)]))
    assert r.ready and r.missing == []


def test_nakit_akisi_ready_with_bank():
    r = check_readiness("nakit_akisi", _ctx(bank_transactions=[_bank()]))
    assert r.ready


def test_nakit_akisi_ready_with_successful_pos():
    r = check_readiness("nakit_akisi", _ctx(pos_transactions=[_pos()]))
    assert r.ready


def test_nakit_akisi_not_ready_only_failed_pos():
    r = check_readiness("nakit_akisi", _ctx(pos_transactions=[_pos(status="failed")]))
    assert not r.ready


# --- risk ---

def test_risk_ready_via_nakit():
    r = check_readiness("risk", _ctx(invoices=[_invoice(1)]))
    assert r.ready


def test_risk_ready_via_trend_two_months():
    r = check_readiness("risk", _ctx(invoices=[_invoice(1), _invoice(2)]))
    assert r.ready


def test_risk_not_ready_empty():
    r = check_readiness("risk", _ctx())
    assert not r.ready


# --- mevzuat_rag ---

def test_mevzuat_ready_with_invoice():
    r = check_readiness("mevzuat_rag", _ctx(invoices=[_invoice(1)]))
    assert r.ready


def test_mevzuat_ready_with_bank_credit():
    r = check_readiness("mevzuat_rag", _ctx(bank_transactions=[_bank(direction="credit")]))
    assert r.ready


def test_mevzuat_not_ready_only_bank_debit():
    r = check_readiness("mevzuat_rag", _ctx(bank_transactions=[_bank(direction="debit")]))
    assert not r.ready


# --- kosgeb ---

def test_kosgeb_ready_with_profile():
    ctx = _ctx(tenant_profile={"sector": "imalat", "company_type": "ltd"})
    r = check_readiness("kosgeb", ctx)
    assert r.ready


def test_kosgeb_not_ready_missing_company_type():
    ctx = _ctx(tenant_profile={"sector": "imalat"})
    r = check_readiness("kosgeb", ctx)
    assert not r.ready and any("şirket tipi" in m for m in r.missing)


# --- version hash ---

def test_version_hash_stable_for_same_input():
    ctx = _ctx(invoices=[_invoice(1)])
    h1 = compute_version_hash("nakit_akisi", ctx)
    h2 = compute_version_hash("nakit_akisi", ctx)
    assert h1 == h2


def test_version_hash_changes_with_new_invoice():
    ctx_a = _ctx(invoices=[_invoice(1)])
    ctx_b = _ctx(invoices=[_invoice(1), _invoice(2)])
    assert compute_version_hash("nakit_akisi", ctx_a) != compute_version_hash("nakit_akisi", ctx_b)


def test_version_hash_kosgeb_sector_dependent():
    ctx_a = _ctx(tenant_profile={"sector": "imalat", "company_type": "ltd"})
    ctx_b = _ctx(tenant_profile={"sector": "hizmet", "company_type": "ltd"})
    assert compute_version_hash("kosgeb", ctx_a) != compute_version_hash("kosgeb", ctx_b)


def test_unknown_agent_raises():
    with pytest.raises(ValueError):
        check_readiness("foobar", _ctx())


def test_all_agents_covered():
    # Defensive: ensure module exposes every agent we expect downstream.
    assert set(AGENT_NAMES) == {
        "nakit_akisi",
        "risk",
        "mevzuat_rag",
        "kosgeb",
        "collections_agent",
        "supplier_dependency_agent",
        "margin_agent",
    }

from __future__ import annotations

from datetime import date, datetime, timezone
from decimal import Decimal

import pytest

from schemas.bank import BankTransactionOut
from schemas.invoice import InvoiceData, InvoiceItem
from schemas.pos import PosTransactionOut
from schemas.tax import TaxCalendarItemOut
from services.tenant_context import TenantAnalysisContext
from services.tenant_rag import TenantRagIndexer


def _invoice(*, invoice_id: str, vendor: str, month: int, total: float, category: str) -> InvoiceData:
    item = InvoiceItem(description="kalem", quantity=1, unit_price=total, total=total, kdv_rate=20)
    return InvoiceData(
        invoice_id=invoice_id,
        vendor_name=vendor,
        vendor_tax_no="1234567890",
        date=date(2026, month, 10),
        due_date=None,
        items=[item],
        subtotal=total,
        kdv_amount=total * 0.2,
        total_amount=total * 1.2,
        currency="TRY",
        category=category,
        raw_text=None,
    )


def test_tenant_context_summarizes_structured_sources_and_redacts_sensitive_fields() -> None:
    ctx = TenantAnalysisContext(
        tenant_id="tenant-1",
        tenant_profile={
            "sector": "hizmet",
            "company_type": "sahis_sirketi",
            "tax_number": "9999999999",
            "credentials": {"api_key": "secret"},
        },
        invoices=[
            _invoice(invoice_id="a", vendor="Müşteri", month=4, total=1000, category="gelir"),
            _invoice(invoice_id="b", vendor="Tedarikçi", month=4, total=600, category="gider"),
        ],
        bank_transactions=[
            BankTransactionOut(
                id="bt-1",
                tenant_id="tenant-1",
                bank_name="diger",
                account_iban="TR000000000000000000000001",
                amount=Decimal("500"),
                currency="TRY",
                direction="debit",
                transacted_at=datetime(2026, 4, 11, tzinfo=timezone.utc),
                created_at=datetime(2026, 4, 11, tzinfo=timezone.utc),
            )
        ],
        pos_transactions=[
            PosTransactionOut(
                id="pos-1",
                tenant_id="tenant-1",
                pos_provider="iyzico_checkout",
                external_id="ext-1",
                amount=Decimal("250"),
                currency="TRY",
                txn_type="sale",
                status="failed",
                installments=1,
                card_last_four="4242",
                transacted_at=datetime(2026, 4, 12, tzinfo=timezone.utc),
                created_at=datetime(2026, 4, 12, tzinfo=timezone.utc),
            )
        ],
        tax_calendar_items=[
            TaxCalendarItemOut(
                id="tax-1",
                tenant_id="tenant-1",
                title="Nisan KDV",
                tax_type="kdv",
                due_date=date(2026, 5, 28),
                amount=Decimal("300"),
                status="pending",
                period="2026-04",
                created_at=datetime(2026, 4, 1, tzinfo=timezone.utc),
                updated_at=datetime(2026, 4, 1, tzinfo=timezone.utc),
            )
        ],
    )

    summary = ctx.summary_dict()
    text = "\n".join(chunk["text"] for chunk in ctx.rag_chunks())

    assert summary["invoice_income_total"] == 1200
    assert summary["invoice_expense_total"] == 720
    assert summary["bank_debit_total"] == 500
    assert summary["pos_failed_count"] == 1
    assert summary["tenant_profile"] == {"sector": "hizmet", "company_type": "sahis_sirketi"}
    assert "TR000000000000000000000001" not in text
    assert "4242" not in text
    assert "9999999999" not in text
    assert "secret" not in text


@pytest.mark.asyncio
async def test_tenant_rag_indexer_uses_private_metadata_and_deterministic_ids() -> None:
    calls: list[tuple[str, dict, str]] = []

    class FakeIndexer:
        async def upsert_document(self, text: str, metadata: dict, *, document_id: str) -> int:
            calls.append((text, metadata, document_id))
            return 1

    ctx = TenantAnalysisContext(
        tenant_id="tenant-1",
        tenant_profile={"sector": "hizmet", "company_type": "ltd_sti"},
        invoices=[_invoice(invoice_id="a", vendor="Müşteri", month=4, total=1000, category="gelir")],
    )

    count = await TenantRagIndexer(indexer_factory=lambda _: FakeIndexer()).index_context(ctx)

    assert count == len(calls)
    assert calls
    assert all(meta["tenant_id"] == "tenant-1" for _, meta, _ in calls)
    assert all(meta["scope"] == "private" for _, meta, _ in calls)
    assert any(doc_id == "tenant-1:profile:summary" for _, _, doc_id in calls)

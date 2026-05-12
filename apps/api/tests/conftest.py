"""Test-wide setup + paylaşılan fixtures."""
import os
os.environ.setdefault("GEMINI_API_KEY", "test-key")

from datetime import date
import pytest
from schemas.invoice import InvoiceData, InvoiceItem


def _inv(idx: int, vendor: str, m: int, total: float, cat: str) -> InvoiceData:
    item = InvoiceItem(
        description=f"{vendor} kalem",
        quantity=1,
        unit_price=total / 1.2,
        total=total / 1.2,
        kdv_rate=20,
    )
    return InvoiceData(
        invoice_id=f"inv-{idx}",
        vendor_name=vendor,
        vendor_tax_no="NOT_MENTIONED",
        date=date(2026, m, 15),
        due_date=None,
        items=[item],
        subtotal=total / 1.2,
        kdv_amount=total - total / 1.2,
        total_amount=total,
        currency="TRY",
        category=cat,
        raw_text=None,
    )


@pytest.fixture
def six_month_invoices() -> list[InvoiceData]:
    return [
        _inv(1, "Müşteri A", 1, 50000, "gelir"),
        _inv(2, "Müşteri B", 2, 60000, "gelir"),
        _inv(3, "Müşteri C", 3, 45000, "gelir"),
        _inv(4, "Tedarikçi X", 1, 20000, "gider"),
        _inv(5, "Tedarikçi Y", 2, 22000, "gider"),
        _inv(6, "Tedarikçi Z", 3, 28000, "gider"),
    ]

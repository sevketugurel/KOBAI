"""Test-wide setup + paylaşılan fixtures."""
import os
os.environ.setdefault("GEMINI_API_KEY", "test-key")

from datetime import date
import pytest
from schemas.invoice import InvoiceData, InvoiceItem


def _inv_ym(idx: int, vendor: str, year: int, month: int, total: float, cat: str) -> InvoiceData:
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
        date=date(year, month, 15),
        due_date=None,
        items=[item],
        subtotal=total / 1.2,
        kdv_amount=total - total / 1.2,
        total_amount=total,
        currency="TRY",
        category=cat,
        raw_text=None,
    )


def _inv(idx: int, vendor: str, m: int, total: float, cat: str) -> InvoiceData:
    return _inv_ym(idx, vendor, 2026, m, total, cat)


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


@pytest.fixture
def seasonal_pattern_invoices() -> list[InvoiceData]:
    return [
        _inv_ym(10, "Müşteri Haz", 2025, 6, 52000, "gelir"),
        _inv_ym(11, "Tedarikçi Haz", 2025, 6, 25000, "gider"),
        _inv_ym(12, "Müşteri Tem", 2025, 7, 62000, "gelir"),
        _inv_ym(13, "Tedarikçi Tem", 2025, 7, 26000, "gider"),
        _inv_ym(14, "Müşteri Ağu", 2025, 8, 68000, "gelir"),
        _inv_ym(15, "Tedarikçi Ağu", 2025, 8, 27000, "gider"),
        _inv_ym(16, "Müşteri Eyl", 2025, 9, 50000, "gelir"),
        _inv_ym(17, "Tedarikçi Eyl", 2025, 9, 28000, "gider"),
        _inv_ym(18, "Müşteri Eki", 2025, 10, 43000, "gelir"),
        _inv_ym(19, "Tedarikçi Eki", 2025, 10, 32000, "gider"),
        _inv_ym(20, "Müşteri Kas", 2025, 11, 38000, "gelir"),
        _inv_ym(21, "Tedarikçi Kas", 2025, 11, 36000, "gider"),
    ]


@pytest.fixture
def sparse_cashflow_invoices() -> list[InvoiceData]:
    return [
        _inv_ym(30, "Müşteri Tek", 2026, 2, 42000, "gelir"),
        _inv_ym(31, "Tedarikçi Tek", 2026, 2, 18000, "gider"),
    ]

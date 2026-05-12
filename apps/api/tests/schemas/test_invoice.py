"""InvoiceItem / InvoiceData şema doğrulamaları."""
from datetime import date
import pytest
from pydantic import ValidationError
from schemas.invoice import InvoiceItem, InvoiceData


def test_invoice_item_valid():
    item = InvoiceItem(description="Un 50kg", quantity=2, unit_price=500, total=1000, kdv_rate=10)
    assert item.total == 1000


def test_invoice_data_defaults_currency_try():
    inv = InvoiceData(
        invoice_id="abc-1", vendor_name="Tedarikçi A", vendor_tax_no="NOT_MENTIONED",
        date=date(2026, 1, 15), due_date=None,
        items=[InvoiceItem(description="x", quantity=1, unit_price=10, total=10, kdv_rate=20)],
        subtotal=10, kdv_amount=2, total_amount=12, category="malzeme", raw_text=None,
    )
    assert inv.currency == "TRY"


def test_invoice_data_rejects_negative_total():
    with pytest.raises(ValidationError):
        InvoiceData(
            invoice_id="x", vendor_name="V", vendor_tax_no=None, date=date(2026,1,1),
            due_date=None, items=[], subtotal=0, kdv_amount=0, total_amount=-1,
            category="diğer", raw_text=None,
        )

"""Risk eşikleri."""
from datetime import date

import pytest

from agents.risk import RiskAgent
from schemas.invoice import InvoiceData, InvoiceItem


def _inv(idx: int, year: int, month: int, total: float, cat: str) -> InvoiceData:
    item = InvoiceItem(
        description="kalem", quantity=1, unit_price=total / 1.2,
        total=total / 1.2, kdv_rate=20,
    )
    return InvoiceData(
        invoice_id=f"zero-{idx}", vendor_name="V", vendor_tax_no="NOT_MENTIONED",
        date=date(year, month, 15), due_date=None, items=[item],
        subtotal=total / 1.2, kdv_amount=total - total / 1.2,
        total_amount=total, currency="TRY", category=cat, raw_text=None,
    )


@pytest.mark.asyncio
async def test_not_red_when_stable(six_month_invoices):
    agent = RiskAgent()
    forecast = [{"month": f"2026-0{i}", "income": 50000, "expense": 30000, "net": 20000,
                 "kdv_payment": 0, "sgk_payment": 1000, "cumulative": 20000 * i} for i in (4, 5, 6)]
    out = await agent.assess(six_month_invoices, forecast)
    assert out["risk_label"] != "red"
    assert 1 <= out["risk_score"] <= 5


@pytest.mark.asyncio
async def test_red_when_two_negative_months(six_month_invoices):
    agent = RiskAgent()
    forecast = [
        {"month": "2026-04", "income": 1000, "expense": 5000, "net": -4000, "kdv_payment": 0, "sgk_payment": 0, "cumulative": -4000},
        {"month": "2026-05", "income": 1000, "expense": 5000, "net": -4000, "kdv_payment": 0, "sgk_payment": 0, "cumulative": -8000},
        {"month": "2026-06", "income": 1000, "expense": 5000, "net": -4000, "kdv_payment": 0, "sgk_payment": 0, "cumulative": -12000},
    ]
    out = await agent.assess(six_month_invoices, forecast)
    assert out["risk_label"] == "red"
    assert "negatif" in out["explanation"].lower()


@pytest.mark.asyncio
async def test_zero_prior_income_does_not_raise() -> None:
    """A1: Önceki aylar tamamen sıfır gelirken `0 / len(prev)` precedence yüzünden
    ZeroDivisionError fırlamamalı. `or 1` korumayı `len > 0` üstüne kuruyor,
    ortalamanın kendisi 0 olduğunda yine sıfıra bölme oluşuyor.
    """
    # İki ay sadece gider, son ay normal gelir
    invoices = [
        _inv(1, 2026, 1, 10000, "gider"),
        _inv(2, 2026, 2, 12000, "gider"),
        _inv(3, 2026, 3, 50000, "gelir"),
        _inv(4, 2026, 3, 15000, "gider"),
    ]
    out = await RiskAgent().assess(invoices, forecast=[])
    assert out["risk_label"] in {"green", "yellow", "red"}
    assert 1 <= out["risk_score"] <= 5


@pytest.mark.asyncio
async def test_zero_prior_expense_does_not_raise() -> None:
    """A1 (simetrik): Önceki aylar tamamen gelir, son ay gider."""
    invoices = [
        _inv(10, 2026, 1, 10000, "gelir"),
        _inv(11, 2026, 2, 12000, "gelir"),
        _inv(12, 2026, 3, 11000, "gelir"),
        _inv(13, 2026, 3, 8000, "gider"),
    ]
    out = await RiskAgent().assess(invoices, forecast=[])
    assert out["risk_label"] in {"green", "yellow", "red"}

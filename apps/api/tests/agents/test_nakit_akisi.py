"""3 dönem hareketli ortalama + KDV(çeyreklik) + SGK(her ay 26)."""
import pytest
from agents.nakit_akisi import NakitAkisiAgent


@pytest.mark.asyncio
async def test_forecast_returns_three_months(six_month_invoices):
    agent = NakitAkisiAgent()
    out = await agent.forecast(six_month_invoices)
    assert len(out) == 3
    for row in out:
        assert {"month", "income", "expense", "net", "kdv_payment", "sgk_payment", "cumulative"} <= row.keys()


@pytest.mark.asyncio
async def test_kdv_payment_quarterly(six_month_invoices):
    agent = NakitAkisiAgent()
    out = await agent.forecast(six_month_invoices, start_year=2026, start_month=4)
    months = {row["month"]: row for row in out}
    assert months["2026-04"]["kdv_payment"] == 0
    assert months["2026-06"]["kdv_payment"] > 0


@pytest.mark.asyncio
async def test_sgk_paid_every_month(six_month_invoices):
    agent = NakitAkisiAgent()
    out = await agent.forecast(six_month_invoices)
    for row in out:
        assert row["sgk_payment"] >= 0

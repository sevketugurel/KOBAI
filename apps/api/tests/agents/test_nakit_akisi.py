"""3 dönem hareketli ortalama + KDV(çeyreklik) + SGK(her ay 26)."""
import pytest
from agents.nakit_akisi import NakitAkisiAgent, SGK_RATE


@pytest.mark.asyncio
async def test_forecast_returns_three_months(six_month_invoices):
    agent = NakitAkisiAgent()
    out = await agent.forecast(six_month_invoices)
    assert len(out) == 3
    assert [row["month"] for row in out] == ["2026-04", "2026-05", "2026-06"]
    for row in out:
        assert {"month", "income", "expense", "net", "kdv_payment", "sgk_payment", "cumulative"} <= row.keys()


@pytest.mark.asyncio
async def test_kdv_payment_quarterly(six_month_invoices):
    agent = NakitAkisiAgent()
    out = await agent.forecast(six_month_invoices, start_year=2026, start_month=4)
    months = {row["month"]: row for row in out}
    assert months["2026-04"]["kdv_payment"] == 0
    assert months["2026-06"]["kdv_payment"] == 14166.67


@pytest.mark.asyncio
async def test_sgk_paid_every_month_matches_adjusted_expense(six_month_invoices):
    agent = NakitAkisiAgent()
    out = await agent.forecast(six_month_invoices)
    for row in out:
        assert row["sgk_payment"] == round(row["expense"] * SGK_RATE * 0.1, 2)


@pytest.mark.asyncio
async def test_forecast_applies_non_flat_seasonality(seasonal_pattern_invoices):
    agent = NakitAkisiAgent()
    out = await agent.forecast(seasonal_pattern_invoices)

    incomes = [row["income"] for row in out]
    expenses = [row["expense"] for row in out]

    assert len(set(incomes)) > 1
    assert len(set(expenses)) > 1


@pytest.mark.asyncio
async def test_forecast_handles_empty_input():
    agent = NakitAkisiAgent()

    out = await agent.forecast([])

    assert out == []


@pytest.mark.asyncio
async def test_forecast_uses_neutral_factors_for_sparse_history(sparse_cashflow_invoices):
    agent = NakitAkisiAgent()

    out = await agent.forecast(sparse_cashflow_invoices)

    assert len(out) == 3
    incomes = [row["income"] for row in out]
    expenses = [row["expense"] for row in out]
    assert len(set(incomes)) == 1
    assert len(set(expenses)) == 1


@pytest.mark.asyncio
async def test_kdv_payment_uses_historical_kdv_series_not_flat_20pct_formula(mixed_kdv_invoices):
    agent = NakitAkisiAgent()

    out = await agent.forecast(mixed_kdv_invoices, start_year=2026, start_month=4)
    months = {row["month"]: row for row in out}

    assert months["2026-04"]["kdv_payment"] == 0
    assert months["2026-05"]["kdv_payment"] == 0
    assert months["2026-06"]["kdv_payment"] == 50.0


@pytest.mark.asyncio
async def test_kdv_payment_clamps_to_zero_when_historical_paid_exceeds_collected(kdv_credit_invoices):
    agent = NakitAkisiAgent()

    out = await agent.forecast(kdv_credit_invoices, start_year=2026, start_month=4)

    assert out[-1]["month"] == "2026-06"
    assert out[-1]["kdv_payment"] == 0.0

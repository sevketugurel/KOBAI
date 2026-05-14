"""3 dönem hareketli ortalama + KDV(çeyreklik) + SGK(her ay 26)."""
from collections import defaultdict
from statistics import mean

import pytest
from agents.nakit_akisi import NakitAkisiAgent, SGK_RATE


def _group_monthly_totals(invoices):
    monthly = defaultdict(lambda: {
        "income": 0.0,
        "expense": 0.0,
        "kdv_collected": 0.0,
        "kdv_paid": 0.0,
    })
    for invoice in invoices:
        bucket = monthly[invoice.date.strftime("%Y-%m")]
        if invoice.category == "gelir":
            bucket["income"] += invoice.total_amount
            bucket["kdv_collected"] += invoice.kdv_amount
        else:
            bucket["expense"] += invoice.total_amount
            bucket["kdv_paid"] += invoice.kdv_amount
    return monthly


def _recent_monthly_average(invoices, field: str) -> float:
    monthly = _group_monthly_totals(invoices)
    recent_values = [monthly[key][field] for key in sorted(monthly)[-3:]]
    return mean(recent_values) if recent_values else 0.0


def _expected_quarterly_kdv_payment(invoices) -> float:
    avg_kdv_collected = _recent_monthly_average(invoices, "kdv_collected")
    avg_kdv_paid = _recent_monthly_average(invoices, "kdv_paid")
    return round(max((avg_kdv_collected - avg_kdv_paid) * 3, 0.0), 2)


def _legacy_flat_kdv_payment(invoices) -> float:
    avg_income = _recent_monthly_average(invoices, "income")
    avg_expense = _recent_monthly_average(invoices, "expense")
    return round(max((((avg_income / 1.2) * 0.2) - ((avg_expense / 1.2) * 0.2)) * 3, 0.0), 2)


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
    expected_payment = _expected_quarterly_kdv_payment(six_month_invoices)
    assert months["2026-04"]["kdv_payment"] == 0
    assert months["2026-06"]["kdv_payment"] == expected_payment


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
    recent_income_average = _recent_monthly_average(seasonal_pattern_invoices, "income")
    recent_expense_average = _recent_monthly_average(seasonal_pattern_invoices, "expense")

    assert len(set(incomes)) > 1
    assert len(set(expenses)) > 1
    assert all(recent_income_average * 0.8 <= value <= recent_income_average * 1.2 for value in incomes)
    assert all(recent_expense_average * 0.8 <= value <= recent_expense_average * 1.2 for value in expenses)


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
async def test_forecast_keeps_net_and_cumulative_consistent(six_month_invoices):
    agent = NakitAkisiAgent()

    out = await agent.forecast(six_month_invoices, start_year=2026, start_month=4)

    running_cumulative = 0.0
    for row in out:
        expected_net = round(row["income"] - row["expense"] - row["kdv_payment"] - row["sgk_payment"], 2)
        assert row["net"] == expected_net

        running_cumulative = round(running_cumulative + row["net"], 2)
        assert row["cumulative"] == running_cumulative


@pytest.mark.asyncio
async def test_kdv_payment_uses_historical_kdv_series_not_flat_20pct_formula(mixed_kdv_invoices):
    agent = NakitAkisiAgent()

    out = await agent.forecast(mixed_kdv_invoices, start_year=2026, start_month=4)
    months = {row["month"]: row for row in out}
    expected_payment = _expected_quarterly_kdv_payment(mixed_kdv_invoices)
    legacy_payment = _legacy_flat_kdv_payment(mixed_kdv_invoices)

    assert months["2026-04"]["kdv_payment"] == 0
    assert months["2026-05"]["kdv_payment"] == 0
    assert months["2026-06"]["kdv_payment"] == expected_payment
    assert expected_payment != legacy_payment


@pytest.mark.asyncio
async def test_kdv_payment_clamps_to_zero_when_historical_paid_exceeds_collected(kdv_credit_invoices):
    agent = NakitAkisiAgent()

    out = await agent.forecast(kdv_credit_invoices, start_year=2026, start_month=4)

    assert out[-1]["month"] == "2026-06"
    assert out[-1]["kdv_payment"] == 0.0

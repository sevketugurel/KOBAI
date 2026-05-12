"""Risk eşikleri."""
import pytest
from agents.risk import RiskAgent


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

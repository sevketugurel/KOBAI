"""Orchestrator end-to-end — tüm ajanlar mock'lanır."""
import pytest
from unittest.mock import AsyncMock, MagicMock
from agents.orchestrator import run_pipeline


@pytest.mark.asyncio
async def test_pipeline_completes(six_month_invoices, monkeypatch):
    from agents import orchestrator

    fake_cash = MagicMock()
    fake_cash.forecast = AsyncMock(return_value=[
        {"month": "2026-04", "income": 50000, "expense": 30000, "net": 20000, "kdv_payment": 0, "sgk_payment": 1000, "cumulative": 20000},
        {"month": "2026-05", "income": 50000, "expense": 30000, "net": 20000, "kdv_payment": 0, "sgk_payment": 1000, "cumulative": 40000},
        {"month": "2026-06", "income": 50000, "expense": 30000, "net": 20000, "kdv_payment": 4000, "sgk_payment": 1000, "cumulative": 56000},
    ])
    fake_risk = MagicMock()
    fake_risk.assess = AsyncMock(return_value={
        "risk_score": 5, "risk_label": "green", "explanation": "İyi", "anomalies": []
    })
    fake_mevzuat = MagicMock()
    fake_mevzuat.analyze = AsyncMock(return_value=[
        {"recommendation": "KDV beyan et.", "source": "KDV", "article": "Md 28", "confidence": 4.0, "action": "review"}
    ])
    monkeypatch.setattr(orchestrator, "NakitAkisiAgent", lambda: fake_cash)
    monkeypatch.setattr(orchestrator, "RiskAgent", lambda: fake_risk)
    # v2: orchestrator artık MevzuatRagAgent(tenant_id=…) çağırıyor.
    monkeypatch.setattr(orchestrator, "MevzuatRagAgent", lambda **_kw: fake_mevzuat)

    result = await run_pipeline(
        invoices=six_month_invoices, company_type="Şahıs Şirketi", sector="Gıda & İçecek",
        period="6m", job_id="j1", auto_approve=True,
    )
    assert result.status == "completed"
    assert result.risk_label == "green"
    assert len(result.cash_flow_forecast) == 3
    assert len(result.tax_recommendations) == 1
    assert len(result.agent_trace) >= 3

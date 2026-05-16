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


@pytest.mark.asyncio
async def test_pipeline_emits_incremental_trace(six_month_invoices, monkeypatch):
    from agents import orchestrator

    fake_cash = MagicMock()
    fake_cash.forecast = AsyncMock(return_value=[])
    fake_risk = MagicMock()
    fake_risk.assess = AsyncMock(return_value={
        "risk_score": 5, "risk_label": "green", "explanation": "İyi", "anomalies": []
    })
    fake_mevzuat = MagicMock()
    fake_mevzuat.analyze = AsyncMock(return_value=[])
    monkeypatch.setattr(orchestrator, "NakitAkisiAgent", lambda: fake_cash)
    monkeypatch.setattr(orchestrator, "RiskAgent", lambda: fake_risk)
    monkeypatch.setattr(orchestrator, "MevzuatRagAgent", lambda **_kw: fake_mevzuat)

    emitted = []

    async def sink(step):
        emitted.append(step)

    result = await run_pipeline(
        invoices=six_month_invoices,
        company_type="Şahıs Şirketi",
        sector="Gıda & İçecek",
        period="6m",
        job_id="j1",
        auto_approve=True,
        trace_sink=sink,
    )

    assert emitted
    assert emitted[0].agent_name == "nakit_akisi"
    assert emitted[0].status == "running"
    assert any(step.status == "completed" for step in emitted)
    assert result.agent_trace == emitted


@pytest.mark.asyncio
async def test_partial_failure_completes(six_month_invoices, monkeypatch):
    """A3: bir ajan exception atsa bile pipeline status=completed dönmeli,
    diğer ajan çıktıları korunmalı, ilgili trace adımı status=failed olmalı.
    Demo dayanıklılığı için kritik (örn. Chroma down → mevzuat_rag fail).
    """
    from agents import orchestrator

    fake_cash = MagicMock()
    fake_cash.forecast = AsyncMock(return_value=[
        {"month": "2026-04", "income": 50000, "expense": 30000, "net": 20000,
         "kdv_payment": 0, "sgk_payment": 1000, "cumulative": 20000},
    ])
    fake_risk = MagicMock()
    fake_risk.assess = AsyncMock(return_value={
        "risk_score": 3, "risk_label": "yellow", "explanation": "stub", "anomalies": [],
    })
    fake_mevzuat = MagicMock()
    fake_mevzuat.analyze = AsyncMock(side_effect=RuntimeError("rag down"))
    monkeypatch.setattr(orchestrator, "NakitAkisiAgent", lambda: fake_cash)
    monkeypatch.setattr(orchestrator, "RiskAgent", lambda: fake_risk)
    monkeypatch.setattr(orchestrator, "MevzuatRagAgent", lambda **_kw: fake_mevzuat)

    result = await run_pipeline(
        invoices=six_month_invoices, company_type="Şahıs Şirketi",
        sector="gida_perakende", period="6m", job_id="j-partial", auto_approve=True,
    )

    assert result.status == "completed"
    assert len(result.cash_flow_forecast) == 1
    assert result.risk_score == 3
    assert result.tax_recommendations == []
    # KOSGEB kuralları sektör eşleşmesiyle yine en az 1 öneri vermeli
    assert len(result.kosgeb_suggestions) >= 1
    failed_steps = [s for s in result.agent_trace if s.status == "failed"]
    assert any(s.agent_name == "mevzuat_rag" for s in failed_steps)

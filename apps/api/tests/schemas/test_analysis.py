"""AgentStep ve AnalysisResult şemaları."""
from datetime import datetime
from schemas.analysis import AgentStep, AnalysisResult


def test_agent_step_confidence_in_range():
    s = AgentStep(agent_name="risk", action="assess", input={}, output={"x": 1},
                  duration_ms=42, confidence=4.2)
    assert 1.0 <= s.confidence <= 5.0


def test_analysis_result_minimal():
    r = AnalysisResult(
        job_id="job-1", status="pending", invoices=[], cash_flow_forecast=[],
        risk_score=1, risk_label="green", risk_explanation="Risk yok.",
        risk_key_drivers=[], risk_recommended_actions=[], risk_priority="low",
        risk_time_horizon="this_month",
        tax_recommendations=[], kosgeb_suggestions=[], agent_trace=[],
        created_at=datetime.now(), completed_at=None,
    )
    assert r.status == "pending"

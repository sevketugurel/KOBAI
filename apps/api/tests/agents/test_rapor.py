import pytest
from datetime import datetime
from agents.rapor import RaporAgent
from schemas.analysis import AnalysisResult


@pytest.mark.asyncio
async def test_generate_pdf_bytes():
    r = AnalysisResult(job_id="j", status="completed", invoices=[], cash_flow_forecast=[],
                       risk_score=3, risk_label="yellow", risk_explanation="orta",
                       tax_recommendations=[], kosgeb_suggestions=[], agent_trace=[],
                       created_at=datetime.utcnow(), completed_at=datetime.utcnow())
    agent = RaporAgent()
    pdf = await agent.generate_pdf(r, company_name="Test")
    assert pdf.startswith(b"%PDF")

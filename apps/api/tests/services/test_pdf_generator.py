"""ReportLab PDF üretici — bytes döndürmeli."""
from datetime import datetime
from services.pdf_generator import build_analysis_pdf
from schemas.analysis import AnalysisResult


def test_build_pdf_returns_bytes():
    r = AnalysisResult(
        job_id="j1", status="completed", invoices=[], cash_flow_forecast=[],
        risk_score=5, risk_label="green", risk_explanation="İyi.",
        tax_recommendations=[], kosgeb_suggestions=[], agent_trace=[],
        created_at=datetime.utcnow(), completed_at=datetime.utcnow(),
    )
    pdf = build_analysis_pdf(r, company_name="Test Ltd")
    assert isinstance(pdf, bytes) and pdf.startswith(b"%PDF")

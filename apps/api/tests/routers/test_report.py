"""GET /report/{job_id} — PDF bytes döner."""
import pytest
from datetime import datetime
from httpx import AsyncClient, ASGITransport


@pytest.mark.asyncio
async def test_report_returns_pdf(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY","k")
    from services.job_queue import queue
    from schemas.analysis import AnalysisResult
    job_id = await queue.create_job()
    await queue.set_result(job_id, AnalysisResult(
        job_id=job_id, status="completed", invoices=[], cash_flow_forecast=[],
        risk_score=5, risk_label="green", risk_explanation="ok",
        tax_recommendations=[], kosgeb_suggestions=[], agent_trace=[],
        created_at=datetime.utcnow(), completed_at=datetime.utcnow(),
    ))
    from main import app
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://t") as c:
        r = await c.get(f"/report/{job_id}")
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("application/pdf")
    assert r.content.startswith(b"%PDF")

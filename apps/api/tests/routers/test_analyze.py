"""POST /analyze 202 + job_id; GET /analyze/{id} status."""
import pytest, asyncio
from httpx import AsyncClient, ASGITransport
from unittest.mock import AsyncMock


@pytest.mark.asyncio
async def test_analyze_returns_202(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY","k")
    from routers import analyze as ar
    async def fake_runner(*a, **k):
        from datetime import datetime
        from schemas.analysis import AnalysisResult
        return AnalysisResult(
            job_id=k["job_id"], status="completed", invoices=[], cash_flow_forecast=[],
            risk_score=5, risk_label="green", risk_explanation="ok",
            tax_recommendations=[], kosgeb_suggestions=[], agent_trace=[],
            created_at=datetime.utcnow(), completed_at=datetime.utcnow(),
        )
    monkeypatch.setattr(ar, "run_pipeline", fake_runner)
    monkeypatch.setattr(ar, "_load_invoices", AsyncMock(return_value=[]))
    from main import app
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://t") as c:
        r = await c.post("/analyze", json={
            "invoice_ids": [], "company_type": "Şahıs Şirketi",
            "sector": "Gıda & İçecek", "period": "6m",
        })
        assert r.status_code == 202
        job_id = r.json()["job_id"]
        for _ in range(50):
            s = await c.get(f"/analyze/{job_id}")
            if s.json()["status"] == "completed": break
            await asyncio.sleep(0.05)
        assert s.json()["status"] == "completed"

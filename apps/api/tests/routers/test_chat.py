"""POST /chat — SSE stream döndürür."""
import pytest
from httpx import AsyncClient, ASGITransport
from datetime import datetime


@pytest.mark.asyncio
async def test_chat_streams_chunks(monkeypatch):
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

    from routers import chat as cr
    async def fake_gen(*a, **k):
        for chunk in ["Merhaba ", "dünya"]:
            yield chunk
    monkeypatch.setattr(cr, "_stream_answer", fake_gen)
    from main import app
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://t") as c:
        r = await c.post("/chat", json={"message":"selam","job_id": job_id,"history":[]})
        assert r.status_code == 200
        body = r.text
        assert "data: Merhaba" in body and "data: dünya" in body

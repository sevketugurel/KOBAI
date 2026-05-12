"""GET /health endpoint testi."""
import pytest
from httpx import AsyncClient, ASGITransport


@pytest.mark.asyncio
async def test_health_ok(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "k")
    from main import app
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert body["version"] == "0.1.0"

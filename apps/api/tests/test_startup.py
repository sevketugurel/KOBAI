"""Startup ChromaDB heartbeat — bağlantı yoksa uyarı log'la, app yine ayağa kalksın."""
import pytest
from httpx import AsyncClient, ASGITransport


@pytest.mark.asyncio
async def test_app_starts_when_chroma_down(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "k")
    monkeypatch.setenv("CHROMA_HOST", "definitely-not-resolvable.invalid")
    import importlib, main
    importlib.reload(main)
    async with AsyncClient(transport=ASGITransport(app=main.app), base_url="http://test") as c:
        r = await c.get("/health")
    assert r.status_code == 200

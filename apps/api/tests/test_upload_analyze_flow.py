"""Upload → analyze entegrasyonu (Gemini stub'lı)."""
import pytest, asyncio
from datetime import date
from httpx import AsyncClient, ASGITransport
from unittest.mock import AsyncMock
from schemas.invoice import InvoiceData, InvoiceItem


@pytest.mark.asyncio
async def test_upload_then_analyze_uses_invoice(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY","k")
    inv = InvoiceData(
        invoice_id="i1", vendor_name="V", vendor_tax_no="NOT_MENTIONED",
        date=date(2026,1,1), due_date=None,
        items=[InvoiceItem(description="x",quantity=1,unit_price=10,total=10,kdv_rate=20)],
        subtotal=10, kdv_amount=2, total_amount=12, currency="TRY", category="gelir", raw_text=None,
    )
    from routers import upload as ur
    fake_svc = AsyncMock()
    fake_svc.parse_invoice_pdf = AsyncMock(return_value=inv)
    monkeypatch.setattr(ur, "_service", fake_svc)

    # Mock orchestrator agents to avoid ChromaDB / Gemini calls
    from unittest.mock import MagicMock
    from agents import orchestrator
    fake_cash = MagicMock()
    fake_cash.forecast = AsyncMock(return_value=[])
    fake_risk = MagicMock()
    fake_risk.assess = AsyncMock(return_value={"risk_score": 5, "risk_label": "green", "explanation": "ok", "anomalies": []})
    fake_mevzuat = MagicMock()
    fake_mevzuat.analyze = AsyncMock(return_value=[])
    monkeypatch.setattr(orchestrator, "NakitAkisiAgent", lambda: fake_cash)
    monkeypatch.setattr(orchestrator, "RiskAgent", lambda: fake_risk)
    monkeypatch.setattr(orchestrator, "MevzuatRagAgent", lambda: fake_mevzuat)
    from main import app
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://t") as c:
        u = await c.post("/upload", files={"file":("a.pdf", b"%PDF-1.4", "application/pdf")})
        invoice_id = u.json()["invoice_id"]
        a = await c.post("/analyze", json={"invoice_ids":[invoice_id],"company_type":"Şahıs Şirketi","sector":"Gıda & İçecek","period":"6m"})
        job_id = a.json()["job_id"]
        for _ in range(100):
            s = await c.get(f"/analyze/{job_id}")
            if s.json()["status"] in ("completed","failed"): break
            await asyncio.sleep(0.05)
        assert s.json()["status"] == "completed"
        assert len(s.json()["invoices"]) == 1

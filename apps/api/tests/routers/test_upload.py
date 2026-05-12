"""POST /upload — geçerli/geçersiz PDF, parse hatası."""
import pytest
from unittest.mock import AsyncMock
from httpx import AsyncClient, ASGITransport
from datetime import date
from schemas.invoice import InvoiceData, InvoiceItem


@pytest.fixture
def fake_inv():
    return InvoiceData(
        invoice_id="i", vendor_name="V", vendor_tax_no="NOT_MENTIONED",
        date=date(2026,1,1), due_date=None,
        items=[InvoiceItem(description="x",quantity=1,unit_price=10,total=10,kdv_rate=20)],
        subtotal=10, kdv_amount=2, total_amount=12, currency="TRY", category="diğer", raw_text=None,
    )


@pytest.mark.asyncio
async def test_upload_success(monkeypatch, fake_inv):
    monkeypatch.setenv("GEMINI_API_KEY","k")
    from routers import upload as ur
    fake_svc = AsyncMock()
    fake_svc.parse_invoice_pdf = AsyncMock(return_value=fake_inv)
    monkeypatch.setattr(ur, "_service", fake_svc)
    from main import app
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://t") as c:
        r = await c.post("/upload", files={"file": ("a.pdf", b"%PDF-1.4 fake", "application/pdf")})
    assert r.status_code == 200
    assert r.json()["data"]["vendor_name"] == "V"


@pytest.mark.asyncio
async def test_upload_rejects_non_pdf(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY","k")
    from main import app
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://t") as c:
        r = await c.post("/upload", files={"file": ("a.txt", b"hello", "text/plain")})
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_upload_accepts_octet_stream_with_pdf_magic(monkeypatch, fake_inv):
    """Safari / bazı ortamlar PDF için application/octet-stream gönderir."""
    monkeypatch.setenv("GEMINI_API_KEY", "k")
    from routers import upload as ur
    fake_svc = AsyncMock()
    fake_svc.parse_invoice_pdf = AsyncMock(return_value=fake_inv)
    monkeypatch.setattr(ur, "_service", fake_svc)
    from main import app
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://t") as c:
        r = await c.post(
            "/upload",
            files={"file": ("a.pdf", b"%PDF-1.4 minimal", "application/octet-stream")},
        )
    assert r.status_code == 200

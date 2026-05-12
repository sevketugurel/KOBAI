"""GeminiService — google-generativeai stub'lanır."""
import pytest
from unittest.mock import AsyncMock, MagicMock
from services.gemini import GeminiService, GeminiParseError


@pytest.mark.asyncio
async def test_parse_invoice_pdf_success(monkeypatch):
    fake_resp = MagicMock()
    fake_resp.text = '{"invoice_id":"i1","vendor_name":"V","vendor_tax_no":"NOT_MENTIONED","date":"2026-01-15","due_date":null,"items":[{"description":"x","quantity":1,"unit_price":10,"total":10,"kdv_rate":20}],"subtotal":10,"kdv_amount":2,"total_amount":12,"currency":"TRY","category":"diğer","raw_text":null}'
    fake_model = MagicMock()
    fake_model.generate_content_async = AsyncMock(return_value=fake_resp)
    svc = GeminiService(api_key="k")
    monkeypatch.setattr(svc, "_vision_model", fake_model)
    inv = await svc.parse_invoice_pdf(b"%PDF-fake")
    assert inv.vendor_name == "V"
    assert inv.total_amount == 12


@pytest.mark.asyncio
async def test_parse_invoice_pdf_bad_json_raises(monkeypatch):
    fake_resp = MagicMock(); fake_resp.text = "not json"
    fake_model = MagicMock()
    fake_model.generate_content_async = AsyncMock(return_value=fake_resp)
    svc = GeminiService(api_key="k")
    monkeypatch.setattr(svc, "_vision_model", fake_model)
    with pytest.raises(GeminiParseError):
        await svc.parse_invoice_pdf(b"%PDF-fake")


@pytest.mark.asyncio
async def test_embed_text_returns_1536(monkeypatch):
    fake_emb = {"embedding": [0.0] * 1536}
    svc = GeminiService(api_key="k")
    async def _fake_embed(*a, **k): return fake_emb
    monkeypatch.setattr(svc, "_embed_call", _fake_embed)
    vec = await svc.embed_text("merhaba", task_type="RETRIEVAL_DOCUMENT")
    assert len(vec) == 1536

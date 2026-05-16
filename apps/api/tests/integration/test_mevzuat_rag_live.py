"""Live RAG entegrasyon — gerçek Chroma + Gemini ile mevzuat ajanı doğrulama.

Önkoşullar (manuel):
- Chroma çalışıyor (docker compose up -d chromadb)
- `scripts/seed_rag.py` koşulmuş → global "kobi_mevzuat" koleksiyonu doludur
- `GEMINI_API_KEY` env var set

Koşum:
    pytest -m integration tests/integration/test_mevzuat_rag_live.py
"""

from __future__ import annotations

import os
from datetime import date

import pytest

from agents.mevzuat_rag import MevzuatRagAgent
from schemas.invoice import InvoiceData, InvoiceItem


pytestmark = pytest.mark.integration


def _kdv_invoice(idx: int, year: int, month: int, total: float, cat: str) -> InvoiceData:
    item = InvoiceItem(
        description="kalem", quantity=1, unit_price=total / 1.2,
        total=total / 1.2, kdv_rate=20,
    )
    return InvoiceData(
        invoice_id=f"live-{idx}", vendor_name="Tedarikçi", vendor_tax_no="NOT_MENTIONED",
        date=date(year, month, 15), due_date=None, items=[item],
        subtotal=total / 1.2, kdv_amount=total - total / 1.2,
        total_amount=total, currency="TRY", category=cat, raw_text=None,
    )


@pytest.mark.asyncio
async def test_mevzuat_rag_returns_recommendations_from_global_collection() -> None:
    if os.environ.get("GEMINI_API_KEY", "test-key") == "test-key":
        pytest.skip("GEMINI_API_KEY gerçek anahtar değil — live test atlanıyor")

    invoices = [
        _kdv_invoice(1, 2026, 1, 50000, "gelir"),
        _kdv_invoice(2, 2026, 2, 60000, "gelir"),
        _kdv_invoice(3, 2026, 1, 20000, "gider"),
    ]

    # tenant_id=None → yalnız global "kobi_mevzuat" koleksiyonu sorgulanır.
    agent = MevzuatRagAgent(tenant_id=None)
    recs = await agent.analyze(invoices)

    assert len(recs) >= 1, "global RAG hiç öneri vermedi — koleksiyon boş veya Chroma erişilemez"
    first = recs[0]
    assert first["recommendation"].strip(), "öneri metni boş"
    assert first["source"], "kaynak alanı boş"
    assert first["scope"] in {"global", "private"}, f"beklenmeyen scope: {first['scope']}"
    assert 1.0 <= first["confidence"] <= 5.0

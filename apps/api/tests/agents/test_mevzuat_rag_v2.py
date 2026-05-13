"""MevzuatRagAgent: private + global birleşik sorgu davranışı."""

from __future__ import annotations

from unittest.mock import AsyncMock

import pytest

from agents.mevzuat_rag import MevzuatRagAgent


class _FakeRetriever:
    def __init__(self, results: list[dict]) -> None:
        self._results = results

    async def search(self, query: str, n_results: int = 5) -> list[dict]:
        return self._results


def _hit(text: str, *, scope: str, conf: float, law: str = "KDV") -> dict:
    return {
        "text": text,
        "metadata": {"law_name": law},
        "distance": 5 - conf,
        "source_citation": f"{law} Md. 1",
        "confidence": conf,
        "scope": scope,
    }


@pytest.mark.asyncio
async def test_results_merged_and_sorted_by_confidence() -> None:
    glob = _FakeRetriever([_hit("global", scope="global", conf=2.0)])
    priv = _FakeRetriever([_hit("private", scope="private", conf=4.5)])
    gemini = AsyncMock()
    gemini.generate_text = AsyncMock(return_value="öneri")

    agent = MevzuatRagAgent(retrievers=[glob, priv], gemini=gemini)
    hits = await agent._query("test")
    assert hits[0]["scope"] == "private"  # daha yüksek skor önce
    assert hits[1]["scope"] == "global"


@pytest.mark.asyncio
async def test_no_tenant_means_only_global_retriever() -> None:
    """tenant_id=None → tek retriever, global scope etiketi."""
    from rag.retriever import RagRetriever

    agent = MevzuatRagAgent(gemini=AsyncMock(), tenant_id=None)
    assert len(agent._retrievers) == 1
    assert isinstance(agent._retrievers[0], RagRetriever)
    assert agent._retrievers[0]._scope == "global"


@pytest.mark.asyncio
async def test_tenant_id_adds_private_retriever() -> None:
    from rag.retriever import RagRetriever

    agent = MevzuatRagAgent(gemini=AsyncMock(), tenant_id="aaaa-bbbb")
    scopes = [r._scope for r in agent._retrievers]
    assert scopes == ["global", "private"]
    assert all(isinstance(r, RagRetriever) for r in agent._retrievers)


@pytest.mark.asyncio
async def test_analyze_passes_scope_to_recommendations() -> None:
    """Top hit hangi koleksiyondan geldiyse `scope` o şekilde dönmeli."""
    from schemas.invoice import InvoiceData, InvoiceItem
    from datetime import date

    glob = _FakeRetriever([_hit("global hit", scope="global", conf=3.0)])
    priv = _FakeRetriever([_hit("private hit", scope="private", conf=4.8)])
    gemini = AsyncMock()
    gemini.generate_text = AsyncMock(return_value="somut öneri")
    agent = MevzuatRagAgent(retrievers=[glob, priv], gemini=gemini)

    inv = InvoiceData(
        invoice_id="1", vendor_name="X", vendor_tax_no="NOT_MENTIONED",
        date=date(2026, 1, 15), due_date=None,
        items=[InvoiceItem(description="x", quantity=1, unit_price=100, total=100, kdv_rate=20)],
        subtotal=100, kdv_amount=20, total_amount=120, currency="TRY",
        category="gelir", raw_text=None,
    )
    recs = await agent.analyze([inv])
    assert recs, "öneri üretilmedi"
    assert all(r["scope"] == "private" for r in recs)

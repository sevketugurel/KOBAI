"""MevzuatRagAgent — RAG sonuçlarını öneri formatına dönüştürür."""
import pytest
from unittest.mock import AsyncMock, MagicMock
from agents.mevzuat_rag import MevzuatRagAgent


@pytest.mark.asyncio
async def test_analyze_returns_recommendations_with_source(six_month_invoices):
    fake_retriever = MagicMock()
    fake_retriever.search = AsyncMock(return_value=[
        {"text": "KDV %20 oranındadır.", "metadata": {"law_name": "KDV"},
         "distance": 0.3, "source_citation": "KDV Md. 28", "confidence": 4.2}
    ])
    fake_gemini = MagicMock()
    fake_gemini.generate_text = AsyncMock(return_value="KDV beyannamesini düzenli verin.")
    agent = MevzuatRagAgent(retriever=fake_retriever, gemini=fake_gemini)
    recs = await agent.analyze(six_month_invoices)
    assert len(recs) >= 1
    r = recs[0]
    assert set(r.keys()) >= {"recommendation", "source", "article", "confidence", "action"}

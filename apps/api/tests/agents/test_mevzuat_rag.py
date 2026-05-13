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
    agent = MevzuatRagAgent(retrievers=[fake_retriever], gemini=fake_gemini)
    recs = await agent.analyze(six_month_invoices)
    assert len(recs) >= 1
    r = recs[0]
    assert set(r.keys()) >= {"recommendation", "source", "article", "confidence", "action"}


@pytest.mark.asyncio
async def test_analyze_preserves_scope_and_returns_three_recommendations(six_month_invoices):
    fake_retriever = MagicMock()
    fake_retriever.search = AsyncMock(side_effect=[
        [{"text": "KDV Kanunu Md. 41", "metadata": {"law_name": "KDV"},
          "source_citation": "KDV Md. 41", "confidence": 4.6, "scope": "global"}],
        [{"text": "GVK Md. 103", "metadata": {"law_name": "GVK"},
          "source_citation": "GVK Md. 103", "confidence": 4.4, "scope": "private"}],
        [{"text": "SGK ödeme dönemi", "metadata": {"law_name": "SGK"},
          "source_citation": "SGK", "confidence": 4.1, "scope": "global"}],
    ])
    fake_gemini = MagicMock()
    fake_gemini.generate_text = AsyncMock(side_effect=[
        "KDV beyanınızı ayın 26'sından önce hazırlayın.",
        "Gelir vergisi diliminizi yıl içi kümülatif kazançla takip edin.",
        "SGK ödemelerini aylık planınıza sabit gider olarak ekleyin.",
    ])
    agent = MevzuatRagAgent(retrievers=[fake_retriever], gemini=fake_gemini)

    recs = await agent.analyze(six_month_invoices)

    assert len(recs) == 3
    assert [rec["scope"] for rec in recs] == ["global", "private", "global"]
    assert all(1.0 <= rec["confidence"] <= 5.0 for rec in recs)


@pytest.mark.asyncio
async def test_analyze_keeps_law_name_as_article_fallback(six_month_invoices):
    fake_retriever = MagicMock()
    fake_retriever.search = AsyncMock(side_effect=[
        [{"text": "SGK işveren primi aylık takip edilmelidir.", "metadata": {"law_name": "SGK"},
          "source_citation": "SGK", "confidence": 4.0, "scope": "global"}],
        [],
        [],
    ])
    fake_gemini = MagicMock()
    fake_gemini.generate_text = AsyncMock(return_value="SGK ödemelerini aylık takvime ekleyin.")
    agent = MevzuatRagAgent(retrievers=[fake_retriever], gemini=fake_gemini)

    recs = await agent.analyze(six_month_invoices)

    assert len(recs) == 1
    assert recs[0]["source"] == "SGK"
    assert recs[0]["article"] == "SGK"
    assert recs[0]["recommendation"] == "SGK ödemelerini aylık takvime ekleyin."

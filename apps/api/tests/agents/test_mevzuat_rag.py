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
    fake_gemini.generate_text = AsyncMock(return_value="  KDV beyannamesini düzenli verin.  ")
    agent = MevzuatRagAgent(retrievers=[fake_retriever], gemini=fake_gemini)
    recs = await agent.analyze(six_month_invoices)
    assert len(recs) >= 1
    r = recs[0]
    assert set(r.keys()) >= {"recommendation", "source", "article", "confidence", "action"}
    assert r["recommendation"] == "KDV beyannamesini düzenli verin."
    assert r["source"]
    assert r["article"]
    assert r["action"] == "review"
    assert 1.0 <= r["confidence"] <= 5.0


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
    assert fake_retriever.search.await_count == 3
    assert fake_gemini.generate_text.await_count == 3


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


@pytest.mark.asyncio
async def test_analyze_uses_income_and_expense_context_in_kdv_query(six_month_invoices):
    fake_retriever = MagicMock()
    fake_retriever.search = AsyncMock(side_effect=[
        [{"text": "KDV Kanunu Md. 41", "metadata": {"law_name": "KDV"},
          "source_citation": "KDV Md. 41", "confidence": 4.6, "scope": "global"}],
        [],
        [],
    ])
    fake_gemini = MagicMock()
    fake_gemini.generate_text = AsyncMock(return_value="KDV beyanınızı zamanında verin.")
    agent = MevzuatRagAgent(retrievers=[fake_retriever], gemini=fake_gemini)

    await agent.analyze(six_month_invoices)

    first_query = fake_retriever.search.await_args_list[0].args[0]
    first_query_lower = first_query.lower()
    assert "gelir kdv'si" in first_query_lower
    assert "gider kdv'si" in first_query_lower
    assert "net kdv" in first_query_lower
    assert "2026-01 - 2026-03" in first_query


@pytest.mark.asyncio
async def test_analyze_injects_invoice_context_into_generation_call(six_month_invoices):
    fake_retriever = MagicMock()
    fake_retriever.search = AsyncMock(side_effect=[
        [{"text": "KDV Kanunu Md. 41", "metadata": {"law_name": "KDV"},
          "source_citation": "KDV Md. 41", "confidence": 4.6, "scope": "global"}],
        [],
        [],
    ])
    fake_gemini = MagicMock()
    fake_gemini.generate_text = AsyncMock(return_value="KDV planlamasını ay sonundan önce tamamlayın.")
    agent = MevzuatRagAgent(retrievers=[fake_retriever], gemini=fake_gemini)

    await agent.analyze(six_month_invoices)

    kwargs = fake_gemini.generate_text.await_args.kwargs
    assert "KDV alanında" in kwargs["prompt"]
    assert "İşletme bağlamı" in kwargs["context"]
    assert "6 fatura" in kwargs["context"]
    assert "toplam gelir" in kwargs["context"]
    assert "toplam gider" in kwargs["context"]
    assert "gelir KDV'si" in kwargs["context"]
    assert "gider KDV'si" in kwargs["context"]


@pytest.mark.asyncio
async def test_analyze_adds_cautious_gvk_generation_guidance(six_month_invoices):
    fake_retriever = MagicMock()
    fake_retriever.search = AsyncMock(side_effect=[
        [],
        [{"text": "GVK Md. 103 gelir vergisi tarifesini düzenler.", "metadata": {"law_name": "GVK"},
          "source_citation": "GVK Md. 103", "confidence": 4.6, "scope": "global"}],
        [],
    ])
    fake_gemini = MagicMock()
    fake_gemini.generate_text = AsyncMock(return_value="Gelir vergisi diliminizi yıl sonunda gözden geçirin.")
    agent = MevzuatRagAgent(retrievers=[fake_retriever], gemini=fake_gemini)

    await agent.analyze(six_month_invoices)

    kwargs = fake_gemini.generate_text.await_args.kwargs
    assert "GVK alanında" in kwargs["prompt"]
    assert "Kesin vergi tasarrufu hesabı verme" in kwargs["context"]
    assert "mali müşavirle teyit edilmesini öner" in kwargs["context"]


@pytest.mark.asyncio
async def test_analyze_returns_empty_for_empty_invoice_list():
    fake_retriever = MagicMock()
    fake_retriever.search = AsyncMock()
    fake_gemini = MagicMock()
    fake_gemini.generate_text = AsyncMock()
    agent = MevzuatRagAgent(retrievers=[fake_retriever], gemini=fake_gemini)

    recs = await agent.analyze([])

    assert recs == []
    fake_retriever.search.assert_not_awaited()
    fake_gemini.generate_text.assert_not_awaited()


@pytest.mark.asyncio
async def test_analyze_returns_empty_when_all_retrieval_hits_are_empty(six_month_invoices):
    fake_retriever = MagicMock()
    fake_retriever.search = AsyncMock(side_effect=[[], [], []])
    fake_gemini = MagicMock()
    fake_gemini.generate_text = AsyncMock()
    agent = MevzuatRagAgent(retrievers=[fake_retriever], gemini=fake_gemini)

    recs = await agent.analyze(six_month_invoices)

    assert recs == []
    assert fake_retriever.search.await_count == 3
    fake_gemini.generate_text.assert_not_awaited()

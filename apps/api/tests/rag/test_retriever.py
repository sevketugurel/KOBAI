"""Retriever — distance → 1-5 güven dönüşümü ve kaynak atfı."""
import pytest
from unittest.mock import MagicMock, AsyncMock
from rag.retriever import RagRetriever, distance_to_confidence


def test_distance_to_confidence_inverse():
    assert distance_to_confidence(0.0) == 5.0
    assert distance_to_confidence(1.0) <= 3.5
    assert 1.0 <= distance_to_confidence(2.0) <= 5.0


@pytest.mark.asyncio
async def test_search_formats_citation():
    fake_collection = MagicMock()
    fake_collection.query.return_value = {
        "documents": [["GVK Madde 103'e göre..."]],
        "metadatas": [[{"law_name": "GVK", "article_no": "103", "source": "gvk.pdf"}]],
        "distances": [[0.2]],
    }
    fake_embedder = MagicMock()
    fake_embedder.embed_for_query = AsyncMock(return_value=[0.0] * 1536)
    r = RagRetriever(collection=fake_collection, embedder=fake_embedder)
    results = await r.search("Gelir vergisi dilimi?")
    assert results[0]["source_citation"] == "GVK Md. 103"
    assert results[0]["confidence"] >= 4.0

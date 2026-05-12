"""Embedding wrapper testi."""
import pytest
from rag.embeddings import GeminiEmbedder


@pytest.mark.asyncio
async def test_embedder_uses_document_task_for_index():
    captured = {}
    async def fake_embed(text, *, task_type):
        captured["task"] = task_type
        return [0.1] * 1536
    embedder = GeminiEmbedder(embed_fn=fake_embed)
    vec = await embedder.embed_for_index("KDV oranı %20'dir.")
    assert captured["task"] == "RETRIEVAL_DOCUMENT"
    assert len(vec) == 1536


@pytest.mark.asyncio
async def test_embedder_uses_query_task_for_search():
    captured = {}
    async def fake_embed(text, *, task_type):
        captured["task"] = task_type
        return [0.1] * 1536
    embedder = GeminiEmbedder(embed_fn=fake_embed)
    await embedder.embed_for_query("KDV ne zaman ödenir?")
    assert captured["task"] == "RETRIEVAL_QUERY"

"""Similarity search + kaynak atıfı + 1-5 güven skoru."""
import chromadb

from config import settings
from rag.embeddings import GeminiEmbedder


def distance_to_confidence(distance: float) -> float:
    """0=mükemmel match → 5.0; ≥2.0 → 1.0."""
    if distance <= 0:
        return 5.0
    if distance >= 2.0:
        return 1.0
    return round(5.0 - (distance / 2.0) * 4.0, 2)


class RagRetriever:
    def __init__(self, collection=None, embedder: GeminiEmbedder | None = None) -> None:
        if collection is None:
            client = chromadb.HttpClient(
                host=settings.chroma_host, port=settings.chroma_port
            )
            collection = client.get_or_create_collection(name=settings.chroma_collection)
        self._collection = collection
        self._embedder = embedder or GeminiEmbedder()

    async def search(self, query: str, n_results: int = 5) -> list[dict]:
        vec = await self._embedder.embed_for_query(query)
        raw = self._collection.query(query_embeddings=[vec], n_results=n_results)
        out: list[dict] = []
        for doc, meta, dist in zip(
            raw["documents"][0], raw["metadatas"][0], raw["distances"][0]
        ):
            law = meta.get("law_name", "?")
            art = meta.get("article_no")
            citation = f"{law} Md. {art}" if art else law
            out.append(
                {
                    "text": doc,
                    "metadata": meta,
                    "distance": dist,
                    "source_citation": citation,
                    "confidence": distance_to_confidence(dist),
                }
            )
        return out

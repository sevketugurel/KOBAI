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
    def __init__(
        self,
        collection=None,
        embedder: GeminiEmbedder | None = None,
        *,
        collection_name: str | None = None,
        scope: str = "global",
    ) -> None:
        """v2: `collection_name` veya `scope` ile farklı koleksiyondan oku.

        `scope` salt etiket; sonuçlara `scope="global"|"private"` olarak
        eklenir, MevzuatRagAgent skor-birleştirme yaparken kullanır.
        """
        if collection is None:
            client = chromadb.HttpClient(
                host=settings.chroma_host, port=settings.chroma_port
            )
            collection = client.get_or_create_collection(
                name=collection_name or settings.chroma_collection
            )
        self._collection = collection
        self._embedder = embedder or GeminiEmbedder()
        self._scope = scope

    async def search(self, query: str, n_results: int = 5) -> list[dict]:
        vec = await self._embedder.embed_for_query(query)
        raw = self._collection.query(query_embeddings=[vec], n_results=n_results)
        # Boş koleksiyon → documents=[[]]
        documents = raw.get("documents") or [[]]
        metadatas = raw.get("metadatas") or [[]]
        distances = raw.get("distances") or [[]]
        if not documents or not documents[0]:
            return []
        out: list[dict] = []
        for doc, meta, dist in zip(documents[0], metadatas[0], distances[0]):
            law = (meta or {}).get("law_name", "?")
            art = (meta or {}).get("article_no")
            citation = f"{law} Md. {art}" if art else law
            out.append(
                {
                    "text": doc,
                    "metadata": meta or {},
                    "distance": dist,
                    "source_citation": citation,
                    "confidence": distance_to_confidence(dist),
                    "scope": self._scope,
                }
            )
        return out

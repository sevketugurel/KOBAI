"""ChromaDB belge indexleyici — kobi_mevzuat koleksiyonuna chunk yazar."""
import uuid
import logging
import chromadb

from config import settings
from rag.embeddings import GeminiEmbedder

log = logging.getLogger(__name__)


def chunk_text(text: str, *, chunk_size: int = 500, overlap: int = 50) -> list[str]:
    """Whitespace-bazlı token chunking; deterministik."""
    words = text.split()
    if not words:
        return []
    if len(words) <= chunk_size:
        return [text] if text.strip() else []
    chunks: list[str] = []
    step = chunk_size - overlap
    for i in range(0, len(words), step):
        piece = " ".join(words[i : i + chunk_size])
        chunks.append(piece)
        if i + chunk_size >= len(words):
            break
    return chunks


class RagIndexer:
    def __init__(self, client=None, embedder: GeminiEmbedder | None = None) -> None:
        self._client = client or chromadb.HttpClient(
            host=settings.chroma_host, port=settings.chroma_port,
        )
        self._embedder = embedder or GeminiEmbedder()
        self._collection = self._client.get_or_create_collection(
            name=settings.chroma_collection
        )

    async def index_document(self, text: str, metadata: dict) -> int:
        chunks = chunk_text(text)
        ids, embeds, metas, docs = [], [], [], []
        for chunk in chunks:
            cid = str(uuid.uuid4())
            vec = await self._embedder.embed_for_index(chunk)
            ids.append(cid)
            embeds.append(vec)
            docs.append(chunk)
            metas.append({**metadata, "chunk_id": cid})
        if ids:
            self._collection.add(
                ids=ids, embeddings=embeds, documents=docs, metadatas=metas
            )
            log.info("Yüklendi: %s — %d chunk", metadata.get("source", "?"), len(ids))
        return len(ids)

    def list_documents(self) -> list[dict]:
        result = self._collection.get(include=["metadatas"])
        return [
            {"id": i, "metadata": m}
            for i, m in zip(result["ids"], result["metadatas"])
        ]

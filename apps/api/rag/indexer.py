"""ChromaDB belge indexleyici — kobi_mevzuat koleksiyonuna chunk yazar."""
import uuid
import logging
import hashlib
import chromadb

from config import settings
from rag.embeddings import GeminiEmbedder

log = logging.getLogger(__name__)


def _chroma_metadata(meta: dict) -> dict:
    """ChromaDB metadata yalnızca str/int/float/bool kabul eder."""
    return {k: v for k, v in meta.items() if v is not None}


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
    def __init__(
        self,
        client=None,
        embedder: GeminiEmbedder | None = None,
        *,
        collection_name: str | None = None,
    ) -> None:
        """v2: `collection_name` ile farklı koleksiyona yazılabilir.

        Geriye uyumluluk: parametre verilmezse `settings.chroma_collection`
        (genel mevzuat) kullanılır. Tenant'a özel index için
        `rag.collections.tenant_docs_collection(tenant_id)` ver.
        """
        self._client = client or chromadb.HttpClient(
            host=settings.chroma_host, port=settings.chroma_port,
        )
        self._embedder = embedder or GeminiEmbedder()
        self._collection = self._client.get_or_create_collection(
            name=collection_name or settings.chroma_collection
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
            metas.append(_chroma_metadata({**metadata, "chunk_id": cid}))
        if ids:
            self._collection.add(
                ids=ids, embeddings=embeds, documents=docs, metadatas=metas
            )
            log.info("Yüklendi: %s — %d chunk", metadata.get("source", "?"), len(ids))
        return len(ids)

    async def upsert_document(self, text: str, metadata: dict, *, document_id: str) -> int:
        """Deterministik ID ile yaz; aynı kayıt tekrar indexlenirse duplicate üretmez."""
        chunks = chunk_text(text)
        ids, embeds, metas, docs = [], [], [], []
        for idx, chunk in enumerate(chunks):
            digest = hashlib.sha1(f"{document_id}:{idx}:{chunk}".encode("utf-8")).hexdigest()[:16]
            cid = f"{document_id}:chunk:{idx}:{digest}"
            vec = await self._embedder.embed_for_index(chunk)
            ids.append(cid)
            embeds.append(vec)
            docs.append(chunk)
            metas.append(_chroma_metadata({**metadata, "chunk_id": cid}))
        if ids:
            self._collection.upsert(
                ids=ids, embeddings=embeds, documents=docs, metadatas=metas
            )
            log.info("Upsert: %s — %d chunk", document_id, len(ids))
        return len(ids)

    def list_documents(self) -> list[dict]:
        result = self._collection.get(include=["metadatas"])
        return [
            {"id": i, "metadata": m}
            for i, m in zip(result["ids"], result["metadatas"])
        ]

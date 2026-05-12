"""Gemini embedding sarmalayıcısı — task_type ayrımı zorunludur."""
from typing import Awaitable, Callable

EmbedFn = Callable[..., Awaitable[list[float]]]


class GeminiEmbedder:
    def __init__(self, embed_fn: EmbedFn | None = None) -> None:
        if embed_fn is None:
            # Lazy import — testlerde stub edildiğinde GeminiService'i hiç kurma
            from services.gemini import GeminiService

            svc = GeminiService()
            embed_fn = svc.embed_text
        self._embed_fn = embed_fn

    async def embed_for_index(self, text: str) -> list[float]:
        return await self._embed_fn(text, task_type="RETRIEVAL_DOCUMENT")

    async def embed_for_query(self, text: str) -> list[float]:
        return await self._embed_fn(text, task_type="RETRIEVAL_QUERY")

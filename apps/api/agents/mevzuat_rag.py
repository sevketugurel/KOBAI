"""Türk vergi mevzuatı RAG ajanı — tenant-aware (Faz 2).

`tenant_id` verilirse hem global mevzuat hem tenant-private belgeler
paralel sorgulanır; sonuçlar skor (confidence) bazında birleştirilir,
en iyi N kaynak döner. Sonuç metadata'sında `scope: "global"|"private"`
işareti vardır — UI istisnasız kaynağı net göstermeli.
"""

from __future__ import annotations

import asyncio

from rag.collections import global_mevzuat_collection, tenant_docs_collection
from rag.retriever import RagRetriever
from schemas.invoice import InvoiceData
from services.gemini import GeminiService


def _build_retrievers(tenant_id: str | None) -> list[RagRetriever]:
    """Global her zaman vardır; tenant verildiyse private koleksiyon da eklenir.

    Tenant koleksiyonu henüz yoksa Chroma `get_or_create_collection` boş bir
    koleksiyon döner; sorgu boş liste döner (zarar yok).
    """
    retrievers: list[RagRetriever] = [
        RagRetriever(collection_name=global_mevzuat_collection(), scope="global")
    ]
    if tenant_id:
        retrievers.append(
            RagRetriever(collection_name=tenant_docs_collection(tenant_id), scope="private")
        )
    return retrievers


def _merge_by_confidence(results: list[list[dict]], *, top_n: int) -> list[dict]:
    """Tüm koleksiyon sonuçlarını confidence'a göre sırala, top N döndür."""
    merged: list[dict] = [r for batch in results for r in batch]
    merged.sort(key=lambda r: r.get("confidence", 0.0), reverse=True)
    return merged[:top_n]


class MevzuatRagAgent:
    def __init__(
        self,
        retrievers: list[RagRetriever] | None = None,
        gemini: GeminiService | None = None,
        *,
        tenant_id: str | None = None,
    ) -> None:
        self._retrievers = retrievers or _build_retrievers(tenant_id)
        self._gemini = gemini or GeminiService()

    async def _query(self, query: str, *, n_results: int = 3) -> list[dict]:
        # Paralel sorgu — global ve private aynı anda çalışır
        batches = await asyncio.gather(
            *[r.search(query, n_results=n_results) for r in self._retrievers]
        )
        return _merge_by_confidence(list(batches), top_n=n_results)

    async def search_tax_law(self, query: str) -> list[dict]:
        return await self._query(f"Gelir vergisi: {query}")

    async def search_kdv(self, query: str) -> list[dict]:
        return await self._query(f"KDV mevzuatı: {query}")

    async def search_sgk(self, query: str) -> list[dict]:
        return await self._query(f"SGK mevzuatı: {query}")

    async def analyze(self, invoices: list[InvoiceData]) -> list[dict]:
        total_kdv = sum(inv.kdv_amount for inv in invoices if inv.category == "gelir")
        queries = [
            ("KDV", f"Aylık {total_kdv:,.0f} TL KDV beyanı için yükümlülükler"),
            ("GVK", "Şahıs şirketinin gelir vergisi dilimleri ve indirimleri"),
            ("SGK", "İşveren SGK primi hesaplaması ve ödeme dönemi"),
        ]
        recommendations: list[dict] = []
        for law, q in queries:
            hits = await self._query(f"{law}: {q}")
            if not hits:
                continue
            top = hits[0]
            advice = await self._gemini.generate_text(
                prompt=f"Aşağıdaki mevzuat parçasına göre KOBİ'ye somut bir öneri ver:\n{top['text']}",
                context="Cevabın Türkçe ve 1-2 cümle olsun.",
            )
            recommendations.append({
                "recommendation": advice.strip(),
                "source": top["metadata"].get("law_name", law),
                "article": top.get("source_citation", ""),
                "confidence": top["confidence"],
                "scope": top.get("scope", "global"),
                "action": "review",
            })
        return recommendations

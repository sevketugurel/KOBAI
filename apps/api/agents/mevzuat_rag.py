"""Türk vergi mevzuatı RAG ajanı."""
from schemas.invoice import InvoiceData
from rag.retriever import RagRetriever
from services.gemini import GeminiService


class MevzuatRagAgent:
    def __init__(self, retriever: RagRetriever | None = None,
                 gemini: GeminiService | None = None) -> None:
        self._retriever = retriever or RagRetriever()
        self._gemini = gemini or GeminiService()

    async def _query(self, query: str) -> list[dict]:
        return await self._retriever.search(query, n_results=3)

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
                "action": "review",
            })
        return recommendations

"""Türk vergi mevzuatı RAG ajanı — tenant-aware (Faz 2).

`tenant_id` verilirse hem global mevzuat hem tenant-private belgeler
paralel sorgulanır; sonuçlar skor (confidence) bazında birleştirilir,
en iyi N kaynak döner. Sonuç metadata'sında `scope: "global"|"private"`
işareti vardır — UI istisnasız kaynağı net göstermeli.
"""

from __future__ import annotations

import asyncio
from datetime import date

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


def _format_try(amount: float) -> str:
    return f"{amount:,.0f} TL"


def _format_date_range(start_date: date | None, end_date: date | None) -> str:
    if start_date is None or end_date is None:
        return "belirsiz dönem"
    return f"{start_date:%Y-%m} - {end_date:%Y-%m}"


def _summarize_invoice_context(invoices: list[InvoiceData]) -> dict[str, float | int | str]:
    if not invoices:
        return {
            "income_total": 0.0,
            "expense_total": 0.0,
            "income_kdv_total": 0.0,
            "expense_kdv_total": 0.0,
            "net_kdv_estimate": 0.0,
            "invoice_count": 0,
            "date_range": "belirsiz dönem",
        }

    income_total = sum(inv.total_amount for inv in invoices if inv.category == "gelir")
    expense_total = sum(inv.total_amount for inv in invoices if inv.category != "gelir")
    income_kdv_total = sum(inv.kdv_amount for inv in invoices if inv.category == "gelir")
    expense_kdv_total = sum(inv.kdv_amount for inv in invoices if inv.category != "gelir")
    dates = sorted(inv.date for inv in invoices)

    return {
        "income_total": income_total,
        "expense_total": expense_total,
        "income_kdv_total": income_kdv_total,
        "expense_kdv_total": expense_kdv_total,
        "net_kdv_estimate": income_kdv_total - expense_kdv_total,
        "invoice_count": len(invoices),
        "date_range": _format_date_range(dates[0], dates[-1]),
    }


def _build_tax_queries(context: dict[str, float | int | str]) -> list[tuple[str, str]]:
    income_kdv_total = float(context["income_kdv_total"])
    expense_kdv_total = float(context["expense_kdv_total"])
    net_kdv_estimate = float(context["net_kdv_estimate"])
    income_total = float(context["income_total"])
    expense_total = float(context["expense_total"])
    invoice_count = int(context["invoice_count"])
    date_range = str(context["date_range"])

    net_kdv_label = "ödenecek yaklaşık net KDV" if net_kdv_estimate >= 0 else "devreden KDV farkı"

    return [
        (
            "KDV",
            (
                f"{date_range} döneminde {invoice_count} faturalı küçük işletmede "
                f"Gelir KDV'si {_format_try(income_kdv_total)}, "
                f"Gider KDV'si {_format_try(expense_kdv_total)}, "
                f"{net_kdv_label} {_format_try(abs(net_kdv_estimate))}. "
                "KDV beyan ve ödeme yükümlülükleri için dikkat edilmesi gereken kritik tarihler ve aksiyonlar"
            ),
        ),
        (
            "GVK",
            (
                f"{date_range} döneminde toplam gelir {_format_try(income_total)} ve "
                f"toplam gider {_format_try(expense_total)} olan küçük işletme için "
                "gelir vergisi dilimleri, yıllık beyan zamanı ve pratik planlama noktaları"
            ),
        ),
        (
            "SGK",
            (
                f"{date_range} döneminde {invoice_count} faturalı küçük işletmede "
                f"toplam gider {_format_try(expense_total)} seviyesinde seyrederken "
                "işveren SGK primi bildirim ve ödeme dönemlerinde dikkat edilmesi gereken tarihler"
            ),
        ),
    ]


def _build_generation_context(context: dict[str, float | int | str]) -> str:
    return (
        "Türkçe yaz. 1-2 cümle ile uygulanabilir tek öneri ver. "
        "Mümkünse tarih veya tutar belirt. "
        f"İşletme bağlamı: {context['date_range']} döneminde {context['invoice_count']} fatura, "
        f"toplam gelir {_format_try(float(context['income_total']))}, "
        f"toplam gider {_format_try(float(context['expense_total']))}, "
        f"gelir KDV'si {_format_try(float(context['income_kdv_total']))}, "
        f"gider KDV'si {_format_try(float(context['expense_kdv_total']))}, "
        f"net KDV tahmini {_format_try(abs(float(context['net_kdv_estimate'])))}."
    )


def _build_generation_prompt(law: str, hit_text: str) -> str:
    return (
        f"{law} alanında aşağıdaki mevzuat parçasına dayanarak işletme sahibine somut bir öneri ver:\n"
        f"{hit_text}"
    )


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
        if not invoices:
            return []

        context = _summarize_invoice_context(invoices)
        queries = _build_tax_queries(context)
        recommendations: list[dict] = []
        for law, q in queries:
            hits = await self._query(f"{law}: {q}")
            if not hits:
                continue
            top = hits[0]
            advice = await self._gemini.generate_text(
                prompt=_build_generation_prompt(law, top["text"]),
                context=_build_generation_context(context),
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

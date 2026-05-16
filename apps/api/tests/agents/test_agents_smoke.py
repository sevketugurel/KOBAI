"""Smoke testleri — her ajan gerçek (mocksız) input'la non-empty çıktı üretmeli.

Mevcut unit testler ya ajan içini izole olarak doğruluyor ya da orchestrator'da
ajanları tamamen mock'luyor. Bu dosya her ajanı tek bir basit input ile çağırıp
"çıkıyor mu, structurel olarak doğru mu" sorusunu yanıtlar — runtime regresyon
güvencesi.
"""

from __future__ import annotations

from unittest.mock import AsyncMock

import pytest

from agents.kosgeb import suggest_kosgeb
from agents.mevzuat_rag import MevzuatRagAgent
from agents.nakit_akisi import NakitAkisiAgent
from agents.risk import RiskAgent


_FORECAST_KEYS = {"month", "income", "expense", "net", "kdv_payment", "sgk_payment", "cumulative"}


@pytest.mark.asyncio
async def test_nakit_akisi_emits_three_month_forecast(six_month_invoices) -> None:
    out = await NakitAkisiAgent().forecast(six_month_invoices)
    assert len(out) == 3, f"3 ay beklenirdi, gelen: {len(out)}"
    for row in out:
        assert set(row.keys()) >= _FORECAST_KEYS, f"eksik anahtar: {row.keys()}"
        assert isinstance(row["income"], (int, float))
        assert isinstance(row["expense"], (int, float))
        assert isinstance(row["net"], (int, float))


@pytest.mark.asyncio
async def test_risk_returns_label_for_two_month_history(six_month_invoices) -> None:
    forecast = await NakitAkisiAgent().forecast(six_month_invoices)
    out = await RiskAgent().assess(six_month_invoices, forecast)
    assert out["risk_label"] in {"green", "yellow", "red"}
    assert out["risk_score"] in {1, 3, 5}
    assert isinstance(out["explanation"], str) and out["explanation"].strip()


def test_kosgeb_returns_match_for_gida_perakende() -> None:
    out = suggest_kosgeb(sector="gida_perakende", company_type="Şahıs Şirketi")
    assert len(out) >= 1
    assert any("Gıda" in s["title"] or "KOBİGEL" in s["title"] for s in out)


@pytest.mark.asyncio
async def test_mevzuat_rag_returns_empty_when_no_hits(six_month_invoices) -> None:
    """Retriever boş döndürse bile analyze() hata fırlatmamalı, [] dönmeli."""

    class _EmptyRetriever:
        async def search(self, *_args, **_kwargs):
            return []

    agent = MevzuatRagAgent(
        retrievers=[_EmptyRetriever()],  # type: ignore[list-item]
        gemini=AsyncMock(),
    )
    recs = await agent.analyze(six_month_invoices)
    assert recs == []

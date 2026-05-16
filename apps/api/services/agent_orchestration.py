"""Event-driven ajan orkestrasyonu.

Akış: upload/webhook → `agent_events.emit(event)` → `on_event(event)` →
ilgili ajanlar `schedule_agent` ile koşturulur → snapshot upsert → downstream
event (`forecast.updated`, `risk.updated`).

Tasarım notları:
- Aynı (tenant, agent) için tek seferde yalnız bir koşum: `asyncio.Lock`.
- Debounce 45s: aynı anahtara art arda gelen event'ler tek koşumda toparlanır.
- Idempotency: `input_version_hash` değişmediyse re-run yok.
- Hata izolasyonu: bir ajan başarısız olursa diğerleri etkilenmez (mevcut
  `return_exceptions` deseni korunur).
"""

from __future__ import annotations

import asyncio
import logging
import time
from datetime import datetime
from typing import Any

from agents.kosgeb import suggest_kosgeb
from agents.mevzuat_rag import MevzuatRagAgent
from agents.nakit_akisi import NakitAkisiAgent
from agents.readiness import (
    AGENT_NAMES,
    ReadinessResult,
    check_readiness,
)
from agents.risk import RiskAgent
from repositories.agent_snapshot_repo import (
    AgentName,
    AgentSnapshot,
    AgentSnapshotRepo,
    get_agent_snapshot_repo,
)
from schemas.analysis import AgentStep
from services.agent_events import AgentEvent, AgentEventBus, get_event_bus
from services.tenant_context import (
    TenantAnalysisContext,
    TenantDataService,
    get_tenant_data_service,
)

log = logging.getLogger(__name__)


EVENT_TO_AGENTS: dict[str, list[AgentName]] = {
    "invoice.created":         ["nakit_akisi", "risk", "mevzuat_rag"],
    "bank.imported":           ["nakit_akisi", "risk"],
    "pos.transaction.created": ["nakit_akisi", "risk"],
    "tenant_rag.indexed":      ["mevzuat_rag"],
    "tax_calendar.updated":    ["risk", "mevzuat_rag"],
    "tenant.profile.updated":  ["kosgeb"],
    "forecast.updated":        ["risk", "kosgeb"],
    "risk.updated":            ["kosgeb"],
    "analysis.requested": list(AGENT_NAMES),
}

DEBOUNCE_SECONDS = 45.0


class AgentOrchestrationService:
    def __init__(
        self,
        *,
        snapshot_repo: AgentSnapshotRepo,
        data_service: TenantDataService,
        event_bus: AgentEventBus,
    ) -> None:
        self._snapshots = snapshot_repo
        self._data = data_service
        self._bus = event_bus
        self._locks: dict[tuple[str, str], asyncio.Lock] = {}
        self._last_scheduled: dict[tuple[str, str], float] = {}

    # ----- public API -----

    async def on_event(self, event: AgentEvent) -> None:
        targets = EVENT_TO_AGENTS.get(event.event_type)
        if not targets:
            log.debug("Unhandled event type: %s", event.event_type)
            return
        try:
            ctx = await self._build_context(event.tenant_id)
        except Exception:  # noqa: BLE001
            log.exception("build_context failed for tenant=%s", event.tenant_id)
            return
        for agent_name in targets:
            await self.schedule_agent(
                tenant_id=event.tenant_id,
                agent_name=agent_name,
                ctx=ctx,
                last_event=event.event_type,
            )

    async def schedule_agent(
        self,
        *,
        tenant_id: str,
        agent_name: AgentName,
        ctx: TenantAnalysisContext | None = None,
        last_event: str | None = None,
        force: bool = False,
    ) -> bool:
        """Ajanı koşmaya hazırla. Çalıştırırsa True döner."""
        key = (tenant_id, agent_name)
        now = time.monotonic()
        last = self._last_scheduled.get(key, 0.0)
        if not force and (now - last) < DEBOUNCE_SECONDS:
            log.debug("Debounced %s:%s (delta=%.1fs)", tenant_id, agent_name, now - last)
            return False
        if ctx is None:
            ctx = await self._build_context(tenant_id)

        readiness = check_readiness(agent_name, ctx)
        if not readiness.ready:
            await self._snapshots.mark_idle(
                tenant_id=tenant_id,
                agent_name=agent_name,
                missing=readiness.missing,
            )
            return False

        # Idempotency: aynı hash + completed → re-run yok (force bile bunu geçemez,
        # çünkü aynı girdiyle ikinci Gemini çağrısı saf bir maliyet kaybı olur).
        existing = await self._snapshots.get(tenant_id=tenant_id, agent_name=agent_name)
        if (
            existing is not None
            and existing.status == "completed"
            and existing.input_version_hash == readiness.input_version_hash
        ):
            log.debug("Idempotent skip %s:%s (hash=%s)", tenant_id, agent_name, readiness.input_version_hash)
            return False

        self._last_scheduled[key] = now
        asyncio.create_task(
            self._run_single_agent(
                tenant_id=tenant_id,
                agent_name=agent_name,
                ctx=ctx,
                readiness=readiness,
                last_event=last_event,
            )
        )
        return True

    async def run_synchronously(
        self,
        *,
        tenant_id: str,
        agent_name: AgentName,
        ctx: TenantAnalysisContext | None = None,
    ) -> AgentSnapshot | None:
        """Test ve manuel refresh için: ajanı bekleyerek çalıştır."""
        if ctx is None:
            ctx = await self._build_context(tenant_id)
        readiness = check_readiness(agent_name, ctx)
        if not readiness.ready:
            await self._snapshots.mark_idle(
                tenant_id=tenant_id,
                agent_name=agent_name,
                missing=readiness.missing,
            )
            return await self._snapshots.get(tenant_id=tenant_id, agent_name=agent_name)
        await self._run_single_agent(
            tenant_id=tenant_id,
            agent_name=agent_name,
            ctx=ctx,
            readiness=readiness,
            last_event="manual.refresh",
        )
        return await self._snapshots.get(tenant_id=tenant_id, agent_name=agent_name)

    # ----- runner -----

    async def _run_single_agent(
        self,
        *,
        tenant_id: str,
        agent_name: AgentName,
        ctx: TenantAnalysisContext,
        readiness: ReadinessResult,
        last_event: str | None,
    ) -> None:
        key = (tenant_id, agent_name)
        lock = self._locks.setdefault(key, asyncio.Lock())
        async with lock:
            await self._snapshots.mark_running(
                tenant_id=tenant_id,
                agent_name=agent_name,
                input_version_hash=readiness.input_version_hash,
                last_event=last_event,
            )
            t0 = time.perf_counter()
            try:
                output, action = await self._dispatch(agent_name, tenant_id, ctx)
            except Exception as exc:  # noqa: BLE001
                log.exception("Agent %s failed for tenant %s", agent_name, tenant_id)
                trace = [
                    AgentStep(
                        agent_name=agent_name,
                        action=f"{agent_name} failed",
                        status="failed",
                        input={"tenant_id": tenant_id, "event": last_event or ""},
                        output={"summary": f"{type(exc).__name__}: {exc}"[:200]},
                        duration_ms=int((time.perf_counter() - t0) * 1000),
                        confidence=1.0,
                    ).model_dump(mode="json")
                ]
                await self._snapshots.mark_failed(
                    tenant_id=tenant_id,
                    agent_name=agent_name,
                    error=str(exc)[:300],
                    trace=trace,
                )
                return

            trace = [
                AgentStep(
                    agent_name=agent_name,
                    action=action,
                    status="completed",
                    input={"tenant_id": tenant_id, "event": last_event or ""},
                    output={"summary": f"{agent_name} tamamlandı"},
                    duration_ms=int((time.perf_counter() - t0) * 1000),
                    confidence=4.0,
                ).model_dump(mode="json")
            ]
            await self._snapshots.mark_completed(
                tenant_id=tenant_id,
                agent_name=agent_name,
                output=output,
                trace=trace,
                input_version_hash=readiness.input_version_hash,
            )

            await self._emit_downstream(tenant_id, agent_name)

    async def _dispatch(
        self, agent_name: AgentName, tenant_id: str, ctx: TenantAnalysisContext,
    ) -> tuple[dict[str, Any], str]:
        if agent_name == "nakit_akisi":
            forecast = await NakitAkisiAgent().forecast(ctx.invoices, tenant_context=ctx)
            return {"forecast": forecast}, "3 aylık nakit akışı projeksiyonu"
        if agent_name == "risk":
            forecast = await self._read_forecast(tenant_id)
            result = await RiskAgent().assess(ctx.invoices, forecast, tenant_context=ctx)
            return result, "Finansal anomaliler kontrol ediliyor"
        if agent_name == "mevzuat_rag":
            agent = MevzuatRagAgent(tenant_id=tenant_id)
            recs = await agent.analyze(ctx.invoices, tenant_context=ctx)
            return {"tax_recommendations": recs}, "Vergi mevzuatı taranıyor"
        if agent_name == "kosgeb":
            recs = suggest_kosgeb(
                sector=ctx.tenant_profile.get("sector", ""),
                company_type=ctx.tenant_profile.get("company_type", ""),
                tenant_context=ctx,
            )
            return {"kosgeb_suggestions": recs}, "KOSGEB destekleri inceleniyor"
        raise ValueError(f"Bilinmeyen ajan: {agent_name}")

    async def _read_forecast(self, tenant_id: str) -> list[dict[str, Any]]:
        snap = await self._snapshots.get(tenant_id=tenant_id, agent_name="nakit_akisi")
        if snap is None or snap.status != "completed" or not snap.output:
            return []
        forecast = snap.output.get("forecast")
        return forecast if isinstance(forecast, list) else []

    async def _emit_downstream(self, tenant_id: str, agent_name: AgentName) -> None:
        if agent_name == "nakit_akisi":
            await self._bus.emit(AgentEvent(
                tenant_id=tenant_id, event_type="forecast.updated",
            ))
        elif agent_name == "risk":
            await self._bus.emit(AgentEvent(
                tenant_id=tenant_id, event_type="risk.updated",
            ))

    async def _build_context(self, tenant_id: str) -> TenantAnalysisContext:
        return await self._data.build_context(
            tenant_id=tenant_id,
            include_all_tenant_data=True,
        )


_singleton: AgentOrchestrationService | None = None


def get_orchestration_service() -> AgentOrchestrationService:
    global _singleton
    if _singleton is None:
        _singleton = AgentOrchestrationService(
            snapshot_repo=get_agent_snapshot_repo(),
            data_service=get_tenant_data_service(),
            event_bus=get_event_bus(),
        )
        get_event_bus().subscribe(_singleton.on_event)
    return _singleton


def _reset_for_tests(svc: AgentOrchestrationService | None = None) -> None:
    global _singleton
    _singleton = svc

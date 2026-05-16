"""AgentOrchestrationService: event → ready ajan koşumu, debounce, idempotency."""

from __future__ import annotations

import asyncio
from datetime import date
from typing import Any

import pytest

from repositories.agent_snapshot_repo import InMemoryAgentSnapshotRepo
from schemas.invoice import InvoiceData, InvoiceItem
from services.agent_events import AgentEvent, AgentEventBus
from services.agent_orchestration import AgentOrchestrationService, DEBOUNCE_SECONDS
from services.tenant_context import TenantAnalysisContext


class FakeDataService:
    def __init__(self, ctx: TenantAnalysisContext) -> None:
        self._ctx = ctx
        self.calls = 0

    async def build_context(self, **kwargs: Any) -> TenantAnalysisContext:
        self.calls += 1
        return self._ctx


def _invoice(month: int) -> InvoiceData:
    item = InvoiceItem(
        description="x", quantity=1, unit_price=833.33, total=833.33, kdv_rate=20,
    )
    return InvoiceData(
        invoice_id=f"inv-{month}",
        vendor_name="V",
        vendor_tax_no="NOT_MENTIONED",
        date=date(2026, month, 1),
        due_date=None,
        items=[item],
        subtotal=833.33,
        kdv_amount=166.67,
        total_amount=1000,
        currency="TRY",
        category="gelir",
        raw_text=None,
    )


def _ctx_with_invoices(n: int, *, sector: str = "imalat") -> TenantAnalysisContext:
    return TenantAnalysisContext(
        tenant_id="tenant-1",
        tenant_profile={"sector": sector, "company_type": "ltd"},
        invoices=[_invoice(m) for m in range(1, n + 1)],
    )


def _make_service(ctx: TenantAnalysisContext) -> tuple[
    AgentOrchestrationService, InMemoryAgentSnapshotRepo, AgentEventBus
]:
    repo = InMemoryAgentSnapshotRepo()
    bus = AgentEventBus()
    svc = AgentOrchestrationService(
        snapshot_repo=repo,
        data_service=FakeDataService(ctx),
        event_bus=bus,
    )
    bus.subscribe(svc.on_event)
    return svc, repo, bus


@pytest.mark.asyncio
async def test_invoice_event_triggers_nakit_akisi_completed():
    ctx = _ctx_with_invoices(2)
    svc, repo, bus = _make_service(ctx)
    await bus.emit_and_wait(AgentEvent(tenant_id="tenant-1", event_type="invoice.created"))
    # Background task'ların bitmesini bekle
    await asyncio.sleep(0.2)
    snap = await repo.get(tenant_id="tenant-1", agent_name="nakit_akisi")
    assert snap is not None
    assert snap.status == "completed"
    assert snap.output and "forecast" in snap.output


@pytest.mark.asyncio
async def test_idempotent_skip_on_same_hash():
    ctx = _ctx_with_invoices(2)
    svc, repo, _ = _make_service(ctx)
    snap1 = await svc.run_synchronously(tenant_id="tenant-1", agent_name="nakit_akisi", ctx=ctx)
    assert snap1.status == "completed"
    hash1 = snap1.input_version_hash
    # Aynı hash'le yeniden schedule → koşmamalı
    scheduled = await svc.schedule_agent(
        tenant_id="tenant-1", agent_name="nakit_akisi", ctx=ctx, force=True,
    )
    # force=True debounce'u atlatır ama hash idempotency hâlâ skip etmeli
    assert scheduled is False
    snap2 = await repo.get(tenant_id="tenant-1", agent_name="nakit_akisi")
    assert snap2.input_version_hash == hash1


@pytest.mark.asyncio
async def test_hash_changes_with_new_invoice():
    ctx_a = _ctx_with_invoices(2)
    svc, repo, _ = _make_service(ctx_a)
    snap_a = await svc.run_synchronously(tenant_id="tenant-1", agent_name="nakit_akisi", ctx=ctx_a)
    ctx_b = _ctx_with_invoices(3)
    snap_b = await svc.run_synchronously(tenant_id="tenant-1", agent_name="nakit_akisi", ctx=ctx_b)
    assert snap_a.input_version_hash != snap_b.input_version_hash
    assert snap_b.status == "completed"


@pytest.mark.asyncio
async def test_not_ready_marks_idle_with_missing():
    ctx = TenantAnalysisContext(
        tenant_id="tenant-1",
        tenant_profile={},  # eksik sector + company_type
    )
    svc, repo, _ = _make_service(ctx)
    await svc.schedule_agent(tenant_id="tenant-1", agent_name="kosgeb", ctx=ctx)
    snap = await repo.get(tenant_id="tenant-1", agent_name="kosgeb")
    assert snap is not None
    assert snap.status == "idle"
    assert snap.missing


@pytest.mark.asyncio
async def test_debounce_skips_second_schedule():
    ctx = _ctx_with_invoices(2)
    svc, repo, _ = _make_service(ctx)
    first = await svc.schedule_agent(
        tenant_id="tenant-1", agent_name="nakit_akisi", ctx=ctx,
    )
    second = await svc.schedule_agent(
        tenant_id="tenant-1", agent_name="nakit_akisi", ctx=ctx,
    )
    assert first is True
    assert second is False
    assert DEBOUNCE_SECONDS >= 1.0


@pytest.mark.asyncio
async def test_unhandled_event_noop():
    ctx = _ctx_with_invoices(1)
    svc, repo, _ = _make_service(ctx)
    await svc.on_event(AgentEvent(tenant_id="tenant-1", event_type="unknown.event"))
    snap = await repo.get(tenant_id="tenant-1", agent_name="nakit_akisi")
    assert snap is None


@pytest.mark.asyncio
async def test_nakit_completion_emits_forecast_updated():
    ctx = _ctx_with_invoices(2)
    svc, repo, bus = _make_service(ctx)
    seen: list[str] = []

    async def capture(ev: AgentEvent) -> None:
        seen.append(ev.event_type)

    bus.subscribe(capture)
    await svc.run_synchronously(tenant_id="tenant-1", agent_name="nakit_akisi", ctx=ctx)
    await asyncio.sleep(0.05)
    assert "forecast.updated" in seen


@pytest.mark.asyncio
async def test_tenant_isolation():
    ctx_a = _ctx_with_invoices(2)
    repo = InMemoryAgentSnapshotRepo()
    bus = AgentEventBus()
    svc = AgentOrchestrationService(
        snapshot_repo=repo,
        data_service=FakeDataService(ctx_a),
        event_bus=bus,
    )
    await svc.run_synchronously(tenant_id="tenant-A", agent_name="nakit_akisi", ctx=ctx_a)
    snap_a = await repo.get(tenant_id="tenant-A", agent_name="nakit_akisi")
    snap_b = await repo.get(tenant_id="tenant-B", agent_name="nakit_akisi")
    assert snap_a is not None
    assert snap_b is None

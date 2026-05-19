"""Tenant başına ajan snapshot deposu.

Her ajan (nakit_akisi, risk, mevzuat_rag, kosgeb) için tenant_id başına tek
satır tutulur. Veri eventleri (`invoice.created`, `bank.imported`, ...) ajanı
tetikledikçe snapshot upsert edilir. analyze endpoint'i bu snapshot'ları okur.
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any, Literal, Protocol

from pydantic import BaseModel, Field

log = logging.getLogger(__name__)


AgentName = Literal[
    "nakit_akisi",
    "risk",
    "mevzuat_rag",
    "kosgeb",
    "collections_agent",
    "supplier_dependency_agent",
    "margin_agent",
]
SnapshotStatus = Literal[
    "idle", "pending", "running", "completed", "failed", "stale"
]


class AgentSnapshot(BaseModel):
    tenant_id: str
    agent_name: AgentName
    status: SnapshotStatus
    input_version_hash: str | None = None
    output: dict[str, Any] | None = None
    trace: list[dict[str, Any]] = Field(default_factory=list)
    missing: list[str] = Field(default_factory=list)
    error: str | None = None
    last_event: str | None = None
    updated_at: datetime | None = None


class AgentSnapshotRepo(Protocol):
    async def get_all(self, *, tenant_id: str) -> list[AgentSnapshot]: ...

    async def get(
        self, *, tenant_id: str, agent_name: AgentName,
    ) -> AgentSnapshot | None: ...

    async def upsert(self, snapshot: AgentSnapshot) -> None: ...

    async def mark_running(
        self, *, tenant_id: str, agent_name: AgentName,
        input_version_hash: str, last_event: str | None = None,
    ) -> None: ...

    async def mark_completed(
        self, *, tenant_id: str, agent_name: AgentName,
        output: dict[str, Any], trace: list[dict[str, Any]],
        input_version_hash: str,
    ) -> None: ...

    async def mark_failed(
        self, *, tenant_id: str, agent_name: AgentName,
        error: str, trace: list[dict[str, Any]] | None = None,
    ) -> None: ...

    async def mark_idle(
        self, *, tenant_id: str, agent_name: AgentName, missing: list[str],
    ) -> None: ...

    async def mark_stale(
        self, *, tenant_id: str, agent_name: AgentName,
    ) -> None: ...


def _row_to_snapshot(row: dict[str, Any]) -> AgentSnapshot:
    return AgentSnapshot(
        tenant_id=row["tenant_id"],
        agent_name=row["agent_name"],
        status=row["status"],
        input_version_hash=row.get("input_version_hash"),
        output=row.get("output"),
        trace=row.get("trace") or [],
        missing=row.get("missing") or [],
        error=row.get("error"),
        last_event=row.get("last_event"),
        updated_at=row.get("updated_at"),
    )


class SupabaseAgentSnapshotRepo:
    def __init__(self, client) -> None:
        self._db = client

    async def get_all(self, *, tenant_id: str) -> list[AgentSnapshot]:
        res = (
            self._db.table("tenant_agent_snapshots")
            .select("*")
            .eq("tenant_id", tenant_id)
            .execute()
        )
        return [_row_to_snapshot(row) for row in (res.data or [])]

    async def get(
        self, *, tenant_id: str, agent_name: AgentName,
    ) -> AgentSnapshot | None:
        res = (
            self._db.table("tenant_agent_snapshots")
            .select("*")
            .eq("tenant_id", tenant_id)
            .eq("agent_name", agent_name)
            .limit(1)
            .execute()
        )
        rows = res.data or []
        return _row_to_snapshot(rows[0]) if rows else None

    async def upsert(self, snapshot: AgentSnapshot) -> None:
        payload: dict[str, Any] = {
            "tenant_id": snapshot.tenant_id,
            "agent_name": snapshot.agent_name,
            "status": snapshot.status,
            "input_version_hash": snapshot.input_version_hash,
            "output": snapshot.output,
            "trace": snapshot.trace,
            "missing": snapshot.missing,
            "error": snapshot.error,
            "last_event": snapshot.last_event,
            "updated_at": datetime.utcnow().isoformat(),
        }
        (
            self._db.table("tenant_agent_snapshots")
            .upsert(payload, on_conflict="tenant_id,agent_name")
            .execute()
        )

    async def mark_running(
        self, *, tenant_id: str, agent_name: AgentName,
        input_version_hash: str, last_event: str | None = None,
    ) -> None:
        await self.upsert(AgentSnapshot(
            tenant_id=tenant_id,
            agent_name=agent_name,
            status="running",
            input_version_hash=input_version_hash,
            last_event=last_event,
        ))

    async def mark_completed(
        self, *, tenant_id: str, agent_name: AgentName,
        output: dict[str, Any], trace: list[dict[str, Any]],
        input_version_hash: str,
    ) -> None:
        await self.upsert(AgentSnapshot(
            tenant_id=tenant_id,
            agent_name=agent_name,
            status="completed",
            input_version_hash=input_version_hash,
            output=output,
            trace=trace,
        ))

    async def mark_failed(
        self, *, tenant_id: str, agent_name: AgentName,
        error: str, trace: list[dict[str, Any]] | None = None,
    ) -> None:
        await self.upsert(AgentSnapshot(
            tenant_id=tenant_id,
            agent_name=agent_name,
            status="failed",
            error=error,
            trace=trace or [],
        ))

    async def mark_idle(
        self, *, tenant_id: str, agent_name: AgentName, missing: list[str],
    ) -> None:
        await self.upsert(AgentSnapshot(
            tenant_id=tenant_id,
            agent_name=agent_name,
            status="idle",
            missing=missing,
        ))

    async def mark_stale(
        self, *, tenant_id: str, agent_name: AgentName,
    ) -> None:
        existing = await self.get(tenant_id=tenant_id, agent_name=agent_name)
        if existing is None:
            return
        existing.status = "stale"
        await self.upsert(existing)


class InMemoryAgentSnapshotRepo:
    """Test/dev için. Aynı süreçte AgentSnapshotRepo arayüzünü taklit eder."""

    def __init__(self) -> None:
        self._store: dict[tuple[str, str], AgentSnapshot] = {}

    async def get_all(self, *, tenant_id: str) -> list[AgentSnapshot]:
        return [s for (t, _), s in self._store.items() if t == tenant_id]

    async def get(
        self, *, tenant_id: str, agent_name: AgentName,
    ) -> AgentSnapshot | None:
        return self._store.get((tenant_id, agent_name))

    async def upsert(self, snapshot: AgentSnapshot) -> None:
        snapshot.updated_at = datetime.utcnow()
        self._store[(snapshot.tenant_id, snapshot.agent_name)] = snapshot

    async def mark_running(
        self, *, tenant_id: str, agent_name: AgentName,
        input_version_hash: str, last_event: str | None = None,
    ) -> None:
        await self.upsert(AgentSnapshot(
            tenant_id=tenant_id, agent_name=agent_name, status="running",
            input_version_hash=input_version_hash, last_event=last_event,
        ))

    async def mark_completed(
        self, *, tenant_id: str, agent_name: AgentName,
        output: dict[str, Any], trace: list[dict[str, Any]],
        input_version_hash: str,
    ) -> None:
        await self.upsert(AgentSnapshot(
            tenant_id=tenant_id, agent_name=agent_name, status="completed",
            input_version_hash=input_version_hash, output=output, trace=trace,
        ))

    async def mark_failed(
        self, *, tenant_id: str, agent_name: AgentName,
        error: str, trace: list[dict[str, Any]] | None = None,
    ) -> None:
        await self.upsert(AgentSnapshot(
            tenant_id=tenant_id, agent_name=agent_name, status="failed",
            error=error, trace=trace or [],
        ))

    async def mark_idle(
        self, *, tenant_id: str, agent_name: AgentName, missing: list[str],
    ) -> None:
        await self.upsert(AgentSnapshot(
            tenant_id=tenant_id, agent_name=agent_name, status="idle",
            missing=missing,
        ))

    async def mark_stale(
        self, *, tenant_id: str, agent_name: AgentName,
    ) -> None:
        existing = self._store.get((tenant_id, agent_name))
        if existing is None:
            return
        existing.status = "stale"
        await self.upsert(existing)


_singleton: AgentSnapshotRepo | None = None


def get_agent_snapshot_repo() -> AgentSnapshotRepo:
    global _singleton
    if _singleton is None:
        from supabase_client import get_service_client
        _singleton = SupabaseAgentSnapshotRepo(get_service_client())
    return _singleton


def _reset_for_tests(repo: AgentSnapshotRepo | None = None) -> None:
    global _singleton
    _singleton = repo

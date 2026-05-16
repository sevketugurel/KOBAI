"""GET /v2/tenants/{slug}/agents/snapshots — Faz 7 ajan snapshot listesi.

Tenant'a ait `tenant_agent_snapshots` satırlarını döndürür. Dashboard ve chat
bu endpoint'i polling/refetch ile tüketir.
"""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from middleware.tenant import require_tenant
from repositories.agent_snapshot_repo import (
    AgentSnapshotRepo,
    get_agent_snapshot_repo,
)
from schemas.tenant import TenantContext

router = APIRouter(prefix="/v2/tenants", tags=["v2-agents"])


class AgentSnapshotOut(BaseModel):
    agent_name: str
    status: str
    input_version_hash: str | None = None
    output: dict[str, Any] | None = None
    trace: list[dict[str, Any]] = Field(default_factory=list)
    missing: list[str] = Field(default_factory=list)
    error: str | None = None
    last_event: str | None = None
    updated_at: str | None = None


@router.get("/{slug}/agents/snapshots", response_model=list[AgentSnapshotOut])
async def list_agent_snapshots(
    ctx: Annotated[TenantContext, Depends(require_tenant)],
    repo: Annotated[AgentSnapshotRepo, Depends(get_agent_snapshot_repo)],
) -> list[AgentSnapshotOut]:
    snapshots = await repo.get_all(tenant_id=ctx.tenant_id)
    return [
        AgentSnapshotOut(
            agent_name=s.agent_name,
            status=s.status,
            input_version_hash=s.input_version_hash,
            output=s.output,
            trace=s.trace,
            missing=s.missing,
            error=s.error,
            last_event=s.last_event,
            updated_at=s.updated_at.isoformat() if s.updated_at else None,
        )
        for s in snapshots
    ]

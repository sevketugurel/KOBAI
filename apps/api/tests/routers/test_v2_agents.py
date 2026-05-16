"""GET /v2/tenants/{slug}/agents/snapshots — Faz 7 ajan snapshot endpoint'i."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

from main import app
from middleware.tenant import AuthPrincipal, require_auth
from repositories.agent_snapshot_repo import (
    AgentSnapshot,
    InMemoryAgentSnapshotRepo,
    get_agent_snapshot_repo,
)
from repositories.tenant_repo import MembershipOut, TenantOut, get_tenant_repo


USER_A = str(uuid.uuid4())
USER_OUTSIDER = str(uuid.uuid4())
TENANT_A = str(uuid.uuid4())
TENANT_B = str(uuid.uuid4())


def _t(tid: str, slug: str) -> TenantOut:
    return TenantOut(
        id=tid, slug=slug, display_name=slug, sector="hizmet",
        company_type="sahis_sirketi", tax_number=None, is_active=True,
        created_at=datetime.now(timezone.utc),
    )


def _m(tid: str, uid: str, role: str = "owner") -> MembershipOut:
    return MembershipOut(
        id=str(uuid.uuid4()), tenant_id=tid, user_id=uid, role=role,
        created_at=datetime.now(timezone.utc),
    )


class FakeTenantRepoMin:
    def __init__(self, tenants, members) -> None:
        self._tenants = tenants
        self._members = members

    async def get_by_slug(self, slug):
        for t in self._tenants.values():
            if t.slug == slug:
                return t
        return None

    async def get_membership(self, *, tenant_id, user_id):
        for m in self._members:
            if m.tenant_id == tenant_id and m.user_id == user_id:
                return m
        return None

    async def create_tenant_with_owner(self, *a, **k): ...
    async def update(self, *a, **k): ...
    async def list_for_user(self, *a, **k): return []
    async def list_members(self, *a, **k): return []


@pytest.fixture
def tenant_repo():
    return FakeTenantRepoMin(
        tenants={TENANT_A: _t(TENANT_A, "acme-co"), TENANT_B: _t(TENANT_B, "zeta-co")},
        members=[_m(TENANT_A, USER_A)],
    )


@pytest.fixture
def client_for(tenant_repo):
    state = {"snapshots": InMemoryAgentSnapshotRepo()}

    def _make(*, user_id, snapshots=None):
        if snapshots is not None:
            state["snapshots"] = snapshots
        app.dependency_overrides[require_auth] = lambda: AuthPrincipal(user_id=user_id, email="x@y")
        app.dependency_overrides[get_tenant_repo] = lambda: tenant_repo
        app.dependency_overrides[get_agent_snapshot_repo] = lambda: state["snapshots"]
        return TestClient(app)

    yield _make
    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_agents_snapshots_returns_only_tenant_rows(client_for):
    repo = InMemoryAgentSnapshotRepo()
    await repo.upsert(AgentSnapshot(
        tenant_id=TENANT_A, agent_name="nakit_akisi", status="completed",
        input_version_hash="h1", output={"forecast": [{"month": "2026-05"}]},
    ))
    await repo.upsert(AgentSnapshot(
        tenant_id=TENANT_B, agent_name="risk", status="completed",
        input_version_hash="h2",
    ))
    client = client_for(user_id=USER_A, snapshots=repo)
    res = client.get("/v2/tenants/acme-co/agents/snapshots")
    assert res.status_code == 200, res.text
    body = res.json()
    assert len(body) == 1
    assert body[0]["agent_name"] == "nakit_akisi"
    assert body[0]["status"] == "completed"
    assert body[0]["output"]["forecast"][0]["month"] == "2026-05"


def test_agents_snapshots_empty_for_fresh_tenant(client_for):
    client = client_for(user_id=USER_A, snapshots=InMemoryAgentSnapshotRepo())
    res = client.get("/v2/tenants/acme-co/agents/snapshots")
    assert res.status_code == 200
    assert res.json() == []


def test_agents_snapshots_403_for_non_member(client_for):
    client = client_for(user_id=USER_OUTSIDER)
    res = client.get("/v2/tenants/acme-co/agents/snapshots")
    assert res.status_code == 403


def test_agents_snapshots_404_for_unknown_slug(client_for):
    client = client_for(user_id=USER_A)
    res = client.get("/v2/tenants/yok-bu/agents/snapshots")
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_agents_snapshots_includes_idle_missing(client_for):
    repo = InMemoryAgentSnapshotRepo()
    await repo.upsert(AgentSnapshot(
        tenant_id=TENANT_A, agent_name="kosgeb", status="idle",
        missing=["Tenant sektörü tanımlı değil."],
    ))
    client = client_for(user_id=USER_A, snapshots=repo)
    res = client.get("/v2/tenants/acme-co/agents/snapshots")
    assert res.status_code == 200
    body = res.json()
    assert body[0]["status"] == "idle"
    assert body[0]["missing"] == ["Tenant sektörü tanımlı değil."]

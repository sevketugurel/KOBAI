"""Faz 7 — v2 endpoint'lerinin AgentEventBus'a emit ettiğini doğrula.

Heavy upload yollarını mocklamak yerine; (a) emit edilen event tiplerinin
EVENT_TO_AGENTS mapping'inde bulunduğunu, (b) tenant update endpoint'inin
gerçek emit yaptığını sınarız. Diğer emit noktaları (invoice/bank/pos) için
endpoint logic'inde emit çağrısı statik kalır; bu test mapping kontratını
kırılmaya karşı korur.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

from main import app
from middleware.tenant import AuthPrincipal, require_auth
from repositories.tenant_repo import MembershipOut, TenantOut, get_tenant_repo
from schemas.tenant import TenantUpdate
from services.agent_events import (
    AgentEvent,
    _reset_for_tests as _reset_event_bus,
    get_event_bus,
)
from services.agent_orchestration import EVENT_TO_AGENTS


USER_A = str(uuid.uuid4())
TENANT_A = str(uuid.uuid4())


@pytest.fixture(autouse=True)
def _isolated_event_bus():
    _reset_event_bus()
    yield
    _reset_event_bus()


class FakeTenantRepoForUpdate:
    def __init__(self) -> None:
        self._tenant = TenantOut(
            id=TENANT_A, slug="acme-co", display_name="ACME",
            sector="hizmet", company_type="ltd", tax_number=None,
            is_active=True, created_at=datetime.now(timezone.utc),
        )
        self._member = MembershipOut(
            id=str(uuid.uuid4()), tenant_id=TENANT_A, user_id=USER_A,
            role="owner", created_at=datetime.now(timezone.utc),
        )

    async def get_by_slug(self, slug):
        return self._tenant if slug == self._tenant.slug else None

    async def get_membership(self, *, tenant_id, user_id):
        if tenant_id == self._member.tenant_id and user_id == self._member.user_id:
            return self._member
        return None

    async def update(self, slug, patch: TenantUpdate):
        data = self._tenant.model_dump()
        data.update(patch.model_dump(exclude_unset=True))
        self._tenant = TenantOut.model_validate(data)
        return self._tenant

    async def list_for_user(self, *a, **k): return []
    async def list_members(self, *a, **k): return []
    async def create_tenant_with_owner(self, *a, **k): ...


def test_known_emit_events_are_all_mapped():
    """Endpoint'lerden emit edilen event tipleri mapping'de var olmalı."""
    emitted = {
        "invoice.created",
        "tenant_rag.indexed",
        "bank.imported",
        "pos.transaction.created",
        "tenant.profile.updated",
        "analysis.requested",
    }
    assert emitted <= set(EVENT_TO_AGENTS.keys()), (
        f"mapping eksik: {emitted - set(EVENT_TO_AGENTS.keys())}"
    )


def test_tenant_update_emits_profile_updated_event():
    captured: list[AgentEvent] = []

    async def capture(ev: AgentEvent) -> None:
        captured.append(ev)

    bus = get_event_bus()
    bus.subscribe(capture)

    repo = FakeTenantRepoForUpdate()
    app.dependency_overrides[require_auth] = lambda: AuthPrincipal(
        user_id=USER_A, email="o@x.test",
    )
    app.dependency_overrides[get_tenant_repo] = lambda: repo
    try:
        client = TestClient(app)
        res = client.put(
            "/v2/tenants/acme-co",
            json={"sector": "imalat"},
        )
        assert res.status_code == 200, res.text
    finally:
        app.dependency_overrides.clear()

    # emit fire-and-forget — TestClient bloğu kapanmadan task drain edilmiş olmalı.
    # En kötü ihtimal: 1 küçük bekleme yerine event'leri tekrar topla.
    assert any(
        ev.event_type == "tenant.profile.updated" and ev.tenant_id == TENANT_A
        for ev in captured
    ), f"beklenen event yakalanmadı, captured={captured}"
    profile_ev = next(
        ev for ev in captured if ev.event_type == "tenant.profile.updated"
    )
    assert "sector" in profile_ev.payload["changed"]

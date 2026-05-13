"""POST /v2/{slug}/chat — persistans, izolasyon, JWT akışı."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock

import pytest
from fastapi.testclient import TestClient

from main import app
from middleware.tenant import AuthPrincipal, require_auth
from repositories.chat_repo import get_chat_repo
from repositories.tenant_repo import MembershipOut, TenantOut, get_tenant_repo
from schemas.chat_v2 import ChatMessageV2


# ── Fake repos ────────────────────────────────────────────────────────


class FakeChatRepo:
    def __init__(self) -> None:
        self.rows: list[tuple[str, str, str, str]] = []  # (tenant_id, session, role, content)

    async def save_message(self, *, tenant_id, session_id, role, content):
        self.rows.append((tenant_id, session_id, role, content))
        return ChatMessageV2(id=str(uuid.uuid4()), role=role, content=content,
                              created_at=datetime.now(timezone.utc))

    async def list_recent(self, *, tenant_id, session_id, limit=10):
        return [
            ChatMessageV2(id=str(uuid.uuid4()), role=r, content=c,
                          created_at=datetime.now(timezone.utc))
            for (t, s, r, c) in self.rows
            if t == tenant_id and s == session_id
        ][-limit:]


class FakeTenantRepoMin:
    """Sadece chat'in ihtiyaç duyduğu metodları sağlar."""

    def __init__(self, *, tenants: dict[str, TenantOut], members: list[MembershipOut]) -> None:
        self.tenants = tenants
        self.members = members

    async def get_by_slug(self, slug):
        for t in self.tenants.values():
            if t.slug == slug:
                return t
        return None

    async def get_membership(self, *, tenant_id, user_id):
        for m in self.members:
            if m.tenant_id == tenant_id and m.user_id == user_id:
                return m
        return None

    async def create_tenant_with_owner(self, *a, **k): ...
    async def update(self, *a, **k): ...
    async def list_for_user(self, *a, **k): return []
    async def list_members(self, *a, **k): return []


# ── Fixtures ───────────────────────────────────────────────────────────


USER_A = str(uuid.uuid4())
USER_B = str(uuid.uuid4())
TENANT_A_ID = str(uuid.uuid4())
TENANT_B_ID = str(uuid.uuid4())


def _tenant(tid: str, slug: str) -> TenantOut:
    return TenantOut(
        id=tid, slug=slug, display_name=slug.upper(), sector="hizmet",
        company_type="sahis_sirketi", tax_number=None, is_active=True,
        created_at=datetime.now(timezone.utc),
    )


def _member(tid: str, uid: str) -> MembershipOut:
    return MembershipOut(
        id=str(uuid.uuid4()), tenant_id=tid, user_id=uid, role="owner",
        created_at=datetime.now(timezone.utc),
    )


@pytest.fixture
def chat_repo() -> FakeChatRepo:
    return FakeChatRepo()


@pytest.fixture
def tenant_repo() -> FakeTenantRepoMin:
    return FakeTenantRepoMin(
        tenants={
            TENANT_A_ID: _tenant(TENANT_A_ID, "acme-co"),
            TENANT_B_ID: _tenant(TENANT_B_ID, "zeta-co"),
        },
        members=[_member(TENANT_A_ID, USER_A), _member(TENANT_B_ID, USER_B)],
    )


@pytest.fixture
def gemini_mock(monkeypatch):
    """v2 chat router'ın modüle-level GeminiService instance'ını mock'la."""
    from routers.v2 import chat as v2chat
    fake = AsyncMock()
    fake.generate_text = AsyncMock(return_value="Test yanıt")
    monkeypatch.setattr(v2chat, "_gemini", fake)
    return fake


@pytest.fixture
def client_for(chat_repo, tenant_repo, gemini_mock):
    def _make(user_id: str) -> TestClient:
        app.dependency_overrides[require_auth] = lambda: AuthPrincipal(user_id=user_id, email="x@y")
        app.dependency_overrides[get_chat_repo] = lambda: chat_repo
        app.dependency_overrides[get_tenant_repo] = lambda: tenant_repo
        return TestClient(app)
    yield _make
    app.dependency_overrides.clear()


# ── Testler ───────────────────────────────────────────────────────────


def test_chat_persists_user_and_assistant_messages(client_for, chat_repo: FakeChatRepo) -> None:
    c = client_for(USER_A)
    session = str(uuid.uuid4())
    r = c.post(
        "/v2/acme-co/chat",
        json={"message": "Merhaba", "session_id": session},
    )
    assert r.status_code == 200
    # SSE stream tüketildi
    body = r.text
    assert "Test" in body and "[DONE]" in body
    # İki mesaj persist edilmiş: user + assistant
    a_rows = [r for r in chat_repo.rows if r[0] == TENANT_A_ID and r[1] == session]
    roles = [r[2] for r in a_rows]
    assert roles == ["user", "assistant"]


def test_cross_tenant_chat_forbidden(client_for, chat_repo: FakeChatRepo) -> None:
    # USER_B, acme-co (A'nın tenant'ı) endpoint'ine ulaşmaya çalışır → 403
    c = client_for(USER_B)
    r = c.post("/v2/acme-co/chat", json={"message": "x", "session_id": "s1"})
    assert r.status_code == 403
    assert not chat_repo.rows  # hiç yazılmamış olmalı


def test_history_endpoint_isolation(client_for, chat_repo: FakeChatRepo) -> None:
    session = "shared-session"
    # A bir mesaj atar
    ca = client_for(USER_A)
    ca.post("/v2/acme-co/chat", json={"message": "A sırrı", "session_id": session})
    # B kendi tenant'ında aynı session_id'yi sorgular → A'nın mesajlarını GÖRMEMELİ
    cb = client_for(USER_B)
    r = cb.get(f"/v2/zeta-co/chat/{session}/history")
    assert r.status_code == 200
    assert r.json() == []
    # B kendi tenant'ında doğru cevap alır
    ra = client_for(USER_A).get(f"/v2/acme-co/chat/{session}/history")
    assert ra.status_code == 200
    contents = [m["content"] for m in ra.json()]
    assert any("A sırrı" in c for c in contents)


def test_invalid_session_id_empty_string_rejected(client_for) -> None:
    c = client_for(USER_A)
    r = c.post("/v2/acme-co/chat", json={"message": "x", "session_id": ""})
    assert r.status_code == 422

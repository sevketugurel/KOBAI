"""ChatRepo — chat_messages DAO (tenant_id explicit filter)."""

from __future__ import annotations

from typing import Protocol

from schemas.chat_v2 import ChatMessageV2


class ChatRepo(Protocol):
    async def save_message(
        self, *, tenant_id: str, session_id: str, role: str, content: str
    ) -> ChatMessageV2: ...

    async def list_recent(
        self, *, tenant_id: str, session_id: str, limit: int = 10
    ) -> list[ChatMessageV2]: ...


class SupabaseChatRepo:
    def __init__(self, client) -> None:
        self._db = client

    async def save_message(
        self, *, tenant_id: str, session_id: str, role: str, content: str
    ) -> ChatMessageV2:
        res = (
            self._db.table("chat_messages")
            .insert(
                {
                    "tenant_id": tenant_id,
                    "session_id": session_id,
                    "role": role,
                    "content": content,
                }
            )
            .execute()
        )
        if not res.data:
            raise RuntimeError("chat insert boş döndü")
        return ChatMessageV2.model_validate(res.data[0])

    async def list_recent(
        self, *, tenant_id: str, session_id: str, limit: int = 10
    ) -> list[ChatMessageV2]:
        res = (
            self._db.table("chat_messages")
            .select("*")
            .eq("tenant_id", tenant_id)
            .eq("session_id", session_id)
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        rows = list(reversed(res.data or []))  # kronolojik sıra
        return [ChatMessageV2.model_validate(r) for r in rows]


_singleton: SupabaseChatRepo | None = None


def get_chat_repo() -> ChatRepo:
    global _singleton
    if _singleton is None:
        from supabase_client import get_service_client

        _singleton = SupabaseChatRepo(get_service_client())
    return _singleton


def _reset_for_tests() -> None:
    global _singleton
    _singleton = None

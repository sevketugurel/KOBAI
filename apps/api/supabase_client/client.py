"""Service-role Supabase client — lazy singleton.

- v2 endpoint'leri bunu çağırır; RLS bypass eder, her sorguda `tenant_id`/`user_id`
  filtresini *explicit* uygulamak repository katmanının sorumluluğundadır.
- Env yoksa `SupabaseNotConfigured` raise edilir (testte mock'lanabilir; v1 yolu etkilenmez).
"""

from __future__ import annotations

from threading import Lock
from typing import Optional

from supabase import Client, create_client

from config import settings


class SupabaseNotConfigured(RuntimeError):
    """SUPABASE_URL / SERVICE_ROLE_KEY eksikse fırlatılır."""


_client: Optional[Client] = None
_lock = Lock()


def is_configured() -> bool:
    return bool(settings.supabase_url and settings.supabase_service_role_key)


def get_service_client() -> Client:
    """Service-role singleton. Test'lerde `reset_client()` + monkeypatch."""
    global _client
    if _client is not None:
        return _client
    with _lock:
        if _client is not None:
            return _client
        if not is_configured():
            raise SupabaseNotConfigured(
                "SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY .env'de tanımlanmalı"
            )
        _client = create_client(
            settings.supabase_url,  # type: ignore[arg-type]
            settings.supabase_service_role_key,  # type: ignore[arg-type]
        )
        return _client


def reset_client() -> None:
    """Test-only: singleton'ı sıfırla."""
    global _client
    with _lock:
        _client = None

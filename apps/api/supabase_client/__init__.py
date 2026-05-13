"""Supabase wrapper — v2 multi-tenant.

`supabase/` adı yerine `supabase_client/` kullandık; yoksa Supabase CLI'nın
kök `supabase/` dizini (config.toml + migrations) ile import çakışırdı.
"""

from supabase_client.client import (
    SupabaseNotConfigured,
    get_service_client,
    is_configured,
    reset_client,
)

__all__ = [
    "SupabaseNotConfigured",
    "get_service_client",
    "is_configured",
    "reset_client",
]

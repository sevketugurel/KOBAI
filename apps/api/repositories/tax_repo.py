"""Vergi takvimi DAO (Faz 4)."""

from __future__ import annotations

import logging
from datetime import date, timedelta
from typing import Any, Protocol

from postgrest.exceptions import APIError

from schemas.tax import TaxCalendarItemCreate, TaxCalendarItemOut, TaxCalendarItemPatch

log = logging.getLogger(__name__)


class TaxRepo(Protocol):
    async def bulk_seed(
        self, *, tenant_id: str, items: list[TaxCalendarItemCreate],
    ) -> int: ...

    async def list_items(
        self,
        *,
        tenant_id: str,
        status: str | None = None,
        upcoming_within_days: int | None = None,
    ) -> list[TaxCalendarItemOut]: ...

    async def patch_item(
        self, *, tenant_id: str, item_id: str, patch: TaxCalendarItemPatch,
    ) -> TaxCalendarItemOut: ...

    async def mark_overdue_for_all_tenants(self, *, today: date) -> int: ...

    async def list_upcoming_across_tenants(
        self, *, today: date, window_days: int,
    ) -> list[TaxCalendarItemOut]: ...


class SupabaseTaxRepo:
    def __init__(self, client) -> None:
        self._db = client

    async def bulk_seed(
        self, *, tenant_id: str, items: list[TaxCalendarItemCreate],
    ) -> int:
        if not items:
            return 0
        inserted = 0
        for it in items:
            payload = {
                "tenant_id": tenant_id,
                "title": it.title,
                "description": it.description,
                "tax_type": it.tax_type,
                "due_date": it.due_date.isoformat(),
                "period": it.period,
            }
            try:
                self._db.table("tax_calendar_items").insert(payload).execute()
                inserted += 1
            except APIError as e:
                if getattr(e, "code", None) == "23505" or "duplicate" in str(e).lower():
                    continue
                raise
        return inserted

    async def list_items(
        self,
        *,
        tenant_id: str,
        status: str | None = None,
        upcoming_within_days: int | None = None,
    ) -> list[TaxCalendarItemOut]:
        q = (
            self._db.table("tax_calendar_items")
            .select("*")
            .eq("tenant_id", tenant_id)
        )
        if status:
            q = q.eq("status", status)
        if upcoming_within_days is not None:
            limit_date = (date.today() + timedelta(days=upcoming_within_days)).isoformat()
            q = q.lte("due_date", limit_date).gte("due_date", date.today().isoformat())
        res = q.order("due_date").execute()
        return [TaxCalendarItemOut.model_validate(r) for r in (res.data or [])]

    async def patch_item(
        self, *, tenant_id: str, item_id: str, patch: TaxCalendarItemPatch,
    ) -> TaxCalendarItemOut:
        payload: dict[str, Any] = patch.model_dump(exclude_none=True)
        if "amount" in payload:
            payload["amount"] = float(payload["amount"])
        res = (
            self._db.table("tax_calendar_items")
            .update(payload)
            .eq("id", item_id)
            .eq("tenant_id", tenant_id)  # explicit tenant filter — RLS yedek
            .execute()
        )
        if not res.data:
            raise KeyError(item_id)
        return TaxCalendarItemOut.model_validate(res.data[0])

    async def mark_overdue_for_all_tenants(self, *, today: date) -> int:
        """Cron: due_date < today AND status = 'pending' → 'overdue'."""
        res = (
            self._db.table("tax_calendar_items")
            .update({"status": "overdue"})
            .eq("status", "pending")
            .lt("due_date", today.isoformat())
            .execute()
        )
        return len(res.data or [])

    async def list_upcoming_across_tenants(
        self, *, today: date, window_days: int,
    ) -> list[TaxCalendarItemOut]:
        """Cron raporu için tenant-cross liste (yalnızca service-role çağırır)."""
        upper = (today + timedelta(days=window_days)).isoformat()
        res = (
            self._db.table("tax_calendar_items")
            .select("*")
            .eq("status", "pending")
            .gte("due_date", today.isoformat())
            .lte("due_date", upper)
            .order("due_date")
            .execute()
        )
        return [TaxCalendarItemOut.model_validate(r) for r in (res.data or [])]


_singleton: SupabaseTaxRepo | None = None


def get_tax_repo() -> TaxRepo:
    global _singleton
    if _singleton is None:
        from supabase_client import get_service_client

        _singleton = SupabaseTaxRepo(get_service_client())
    return _singleton


def _reset_for_tests() -> None:
    global _singleton
    _singleton = None

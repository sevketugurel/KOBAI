"""POS DAO (Faz 6) — integrations + pos_transactions."""

from __future__ import annotations

import logging
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any, Protocol

from postgrest.exceptions import APIError

from schemas.pos import PosTransactionOut, PosWebhookEvent

log = logging.getLogger(__name__)


class PosRepo(Protocol):
    async def upsert_provider(
        self,
        *,
        tenant_id: str,
        provider: str,
        encrypted_credentials: str,
        encrypted_webhook_secret: str,
    ) -> dict[str, Any]: ...

    async def get_provider(self, *, tenant_id: str) -> dict[str, Any] | None: ...

    async def mark_webhook_received(
        self, *, tenant_id: str, last_error: str | None = None,
    ) -> None: ...

    async def insert_transaction(
        self, *, tenant_id: str, event: PosWebhookEvent,
    ) -> tuple[str, bool]: ...
    """Returns (transaction_id, was_duplicate)."""

    async def list_transactions(
        self, *, tenant_id: str, limit: int = 100,
    ) -> list[PosTransactionOut]: ...

    async def daily_summary(self, *, tenant_id: str, target: date) -> dict[str, Any]: ...


class SupabasePosRepo:
    def __init__(self, client) -> None:
        self._db = client

    # ── integration satırı ────────────────────────────────────────────

    async def upsert_provider(
        self,
        *,
        tenant_id: str,
        provider: str,
        encrypted_credentials: str,
        encrypted_webhook_secret: str,
    ) -> dict[str, Any]:
        existing = (
            self._db.table("integrations")
            .select("id")
            .eq("tenant_id", tenant_id)
            .in_("provider", ["iyzico_checkout", "craftgate"])
            .limit(1)
            .execute()
        )
        payload = {
            "tenant_id": tenant_id,
            "provider": provider,
            "is_active": True,
            "credentials": {
                "cipher": encrypted_credentials,
                "webhook_secret_cipher": encrypted_webhook_secret,
            },
            "config": {},
            "last_error": None,
        }
        if existing.data:
            res = (
                self._db.table("integrations")
                .update(payload)
                .eq("id", existing.data[0]["id"])
                .execute()
            )
        else:
            res = self._db.table("integrations").insert(payload).execute()
        return res.data[0] if res.data else payload

    async def get_provider(self, *, tenant_id: str) -> dict[str, Any] | None:
        res = (
            self._db.table("integrations")
            .select("id,provider,is_active,credentials,last_sync_at,last_error,updated_at")
            .eq("tenant_id", tenant_id)
            .in_("provider", ["iyzico_checkout", "craftgate"])
            .limit(1)
            .execute()
        )
        return res.data[0] if res.data else None

    async def mark_webhook_received(
        self, *, tenant_id: str, last_error: str | None = None,
    ) -> None:
        self._db.table("integrations").update({
            "last_sync_at": datetime.now(timezone.utc).isoformat(),
            "last_error": last_error,
        }).eq("tenant_id", tenant_id).in_(
            "provider", ["iyzico_checkout", "craftgate"]
        ).execute()

    # ── pos_transactions ──────────────────────────────────────────────

    async def insert_transaction(
        self, *, tenant_id: str, event: PosWebhookEvent,
    ) -> tuple[str, bool]:
        provider_row = await self.get_provider(tenant_id=tenant_id)
        provider = (provider_row or {}).get("provider") or "iyzico_checkout"
        payload = {
            "tenant_id": tenant_id,
            "pos_provider": provider,
            "external_id": event.external_id,
            "amount": float(event.amount or Decimal("0")),
            "currency": event.currency,
            "txn_type": event.txn_type,
            "status": event.status,
            "payment_method": event.payment_method,
            "installments": event.installments,
            "card_last_four": event.card_last_four,
            "description": event.description,
            "raw_data": event.model_dump(mode="json"),
            "transacted_at": event.transacted_at.isoformat(),
        }
        try:
            res = self._db.table("pos_transactions").insert(payload).execute()
            return res.data[0]["id"], False
        except APIError as e:
            if getattr(e, "code", None) == "23505" or "duplicate" in str(e).lower():
                # UNIQUE (pos_provider, external_id) çakışması → mevcut satırı bul
                res = (
                    self._db.table("pos_transactions")
                    .select("id")
                    .eq("tenant_id", tenant_id)
                    .eq("pos_provider", provider)
                    .eq("external_id", event.external_id)
                    .limit(1)
                    .execute()
                )
                if res.data:
                    return res.data[0]["id"], True
            raise

    async def list_transactions(
        self, *, tenant_id: str, limit: int = 100,
    ) -> list[PosTransactionOut]:
        res = (
            self._db.table("pos_transactions")
            .select("*")
            .eq("tenant_id", tenant_id)
            .order("transacted_at", desc=True)
            .limit(limit)
            .execute()
        )
        return [PosTransactionOut.model_validate(r) for r in (res.data or [])]

    async def daily_summary(self, *, tenant_id: str, target: date) -> dict[str, Any]:
        start = datetime.combine(target, datetime.min.time(), tzinfo=timezone.utc).isoformat()
        end = datetime.combine(target, datetime.max.time(), tzinfo=timezone.utc).isoformat()
        res = (
            self._db.table("pos_transactions")
            .select("amount,txn_type,status")
            .eq("tenant_id", tenant_id)
            .gte("transacted_at", start)
            .lte("transacted_at", end)
            .execute()
        )
        rows = res.data or []
        sales = [r for r in rows if r["txn_type"] == "sale" and r["status"] == "success"]
        refunds = [r for r in rows if r["txn_type"] == "refund" and r["status"] == "success"]
        total_sales = sum(Decimal(str(r["amount"])) for r in sales)
        total_refunds = sum(Decimal(str(r["amount"])) for r in refunds)
        return {
            "date": target.isoformat(),
            "total_sales": total_sales,
            "total_refunds": total_refunds,
            "net_amount": total_sales - total_refunds,
            "sale_count": len(sales),
            "refund_count": len(refunds),
            "avg_ticket": (total_sales / len(sales)) if sales else None,
        }


_singleton: SupabasePosRepo | None = None


def get_pos_repo() -> PosRepo:
    global _singleton
    if _singleton is None:
        from supabase_client import get_service_client

        _singleton = SupabasePosRepo(get_service_client())
    return _singleton


def _reset_for_tests() -> None:
    global _singleton
    _singleton = None

"""Banka hareketi + entegrasyon + belge DAO'ları (Faz 3)."""

from __future__ import annotations

import logging
from datetime import datetime
from decimal import Decimal
from typing import Any, Protocol

from postgrest.exceptions import APIError

from schemas.bank import BankTransactionOut, BankTransactionParsed

log = logging.getLogger(__name__)


class BankRepo(Protocol):
    async def create_document(
        self, *, tenant_id: str, file_name: str, file_url: str,
    ) -> str: ...

    async def bulk_insert_transactions(
        self,
        *,
        tenant_id: str,
        source_document_id: str,
        bank_name: str,
        account_iban: str | None,
        rows: list[BankTransactionParsed],
    ) -> tuple[int, int]: ...

    async def list_transactions(
        self, *, tenant_id: str, limit: int = 100,
    ) -> list[BankTransactionOut]: ...

    async def upsert_integration(
        self, *, tenant_id: str, provider: str, config: dict[str, Any],
    ) -> dict[str, Any]: ...

    async def list_integrations(self, *, tenant_id: str) -> list[dict[str, Any]]: ...


class SupabaseBankRepo:
    def __init__(self, client) -> None:
        self._db = client

    async def create_document(
        self, *, tenant_id: str, file_name: str, file_url: str,
    ) -> str:
        res = (
            self._db.table("documents")
            .insert({
                "tenant_id": tenant_id,
                "file_name": file_name,
                "file_url": file_url,
                "doc_type": "bank_statement",
                "source": "manual",
            })
            .execute()
        )
        if not res.data:
            raise RuntimeError("documents insert boş döndü")
        return res.data[0]["id"]

    async def bulk_insert_transactions(
        self,
        *,
        tenant_id: str,
        source_document_id: str,
        bank_name: str,
        account_iban: str | None,
        rows: list[BankTransactionParsed],
    ) -> tuple[int, int]:
        """Tek tek INSERT et — dedupe UNIQUE index çakışması 23505 → skip.

        Tüm satırı tek batch ile atmak yerine tek tek atıyoruz; aksi halde
        batch'teki bir duplicate hepsini reddederdi (Postgres COPY-ish davranış).
        Performans MVP için kabul edilebilir (1 ekstre ≈ 50-500 satır).
        """
        inserted = 0
        skipped = 0
        for r in rows:
            payload = {
                "tenant_id": tenant_id,
                "source_document_id": source_document_id,
                "bank_name": bank_name,
                "account_iban": account_iban,
                "amount": float(r.amount),  # postgrest Decimal'i kabul etmez
                "currency": "TRY",
                "direction": r.direction,
                "description": r.description,
                "reference_no": r.reference_no,
                "category": r.category,
                "transacted_at": r.transacted_at.isoformat(),
            }
            try:
                self._db.table("bank_transactions").insert(payload).execute()
                inserted += 1
            except APIError as e:
                # 23505 = unique violation (dedupe index)
                if getattr(e, "code", None) == "23505" or "duplicate" in str(e).lower():
                    skipped += 1
                    continue
                raise
        return inserted, skipped

    async def list_transactions(
        self, *, tenant_id: str, limit: int = 100,
    ) -> list[BankTransactionOut]:
        res = (
            self._db.table("bank_transactions")
            .select("*")
            .eq("tenant_id", tenant_id)
            .order("transacted_at", desc=True)
            .limit(limit)
            .execute()
        )
        return [BankTransactionOut.model_validate(r) for r in (res.data or [])]

    async def upsert_integration(
        self, *, tenant_id: str, provider: str, config: dict[str, Any],
    ) -> dict[str, Any]:
        existing = (
            self._db.table("integrations")
            .select("id")
            .eq("tenant_id", tenant_id)
            .eq("provider", provider)
            .limit(1)
            .execute()
        )
        payload = {
            "tenant_id": tenant_id,
            "provider": provider,
            "config": config,
            "is_active": True,
            "last_sync_at": datetime.utcnow().isoformat(),
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

    async def list_integrations(self, *, tenant_id: str) -> list[dict[str, Any]]:
        res = (
            self._db.table("integrations")
            .select("id,provider,is_active,config,last_sync_at,last_error,created_at,updated_at")
            .eq("tenant_id", tenant_id)
            .execute()
        )
        return res.data or []


_singleton: SupabaseBankRepo | None = None


def get_bank_repo() -> BankRepo:
    global _singleton
    if _singleton is None:
        from supabase_client import get_service_client

        _singleton = SupabaseBankRepo(get_service_client())
    return _singleton


def _reset_for_tests() -> None:
    global _singleton
    _singleton = None

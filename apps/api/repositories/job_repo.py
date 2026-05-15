"""Tenant-scoped fatura belgesi + analiz job'u DAO'su.

`documents` tablosunu doc_type='invoice' ile, `analyses` tablosunu job_id ile kullanır.
Her sorgu tenant_id ile filtrelenir (defense-in-depth; RLS de aynısını yapar).
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime
from typing import Any, Protocol

from schemas.analysis import AnalysisResult
from schemas.invoice import InvoiceData

log = logging.getLogger(__name__)


class JobRepo(Protocol):
    async def save_invoice(
        self, *, tenant_id: str, file_name: str, file_url: str, invoice: InvoiceData,
        period: str | None = None,
    ) -> str: ...

    async def get_invoices(
        self, *, tenant_id: str, document_ids: list[str],
    ) -> list[InvoiceData]: ...

    async def create_job(
        self, *, tenant_id: str, period: str | None, initial: AnalysisResult,
    ) -> str: ...

    async def update_job_status(
        self, *, tenant_id: str, job_id: str, status: str,
    ) -> None: ...

    async def set_job_result(
        self, *, tenant_id: str, job_id: str, result: AnalysisResult,
    ) -> None: ...

    async def get_job(
        self, *, tenant_id: str, job_id: str,
    ) -> AnalysisResult: ...


class JobNotFound(KeyError):
    pass


class SupabaseJobRepo:
    def __init__(self, client) -> None:
        self._db = client

    async def save_invoice(
        self, *, tenant_id: str, file_name: str, file_url: str, invoice: InvoiceData,
        period: str | None = None,
    ) -> str:
        payload: dict[str, Any] = {
            "tenant_id": tenant_id,
            "file_name": file_name,
            "file_url": file_url,
            "doc_type": "invoice",
            "source": "manual",
            "parsed_data": invoice.model_dump(mode="json"),
            "period": period,
        }
        res = self._db.table("documents").insert(payload).execute()
        if not res.data:
            raise RuntimeError("documents insert boş döndü")
        return res.data[0]["id"]

    async def get_invoices(
        self, *, tenant_id: str, document_ids: list[str],
    ) -> list[InvoiceData]:
        if not document_ids:
            return []
        res = (
            self._db.table("documents")
            .select("id,parsed_data")
            .eq("tenant_id", tenant_id)
            .eq("doc_type", "invoice")
            .in_("id", document_ids)
            .execute()
        )
        out: list[InvoiceData] = []
        for row in (res.data or []):
            data = row.get("parsed_data")
            if not data:
                continue
            out.append(InvoiceData.model_validate(data))
        return out

    async def create_job(
        self, *, tenant_id: str, period: str | None, initial: AnalysisResult,
    ) -> str:
        # job_id istemciye dönüş için Pydantic modelindeki ile aynı olmalı.
        payload: dict[str, Any] = {
            "tenant_id": tenant_id,
            "job_id": initial.job_id,
            "status": initial.status,
            "period": period,
            "result": initial.model_dump(mode="json"),
        }
        res = self._db.table("analyses").insert(payload).execute()
        if not res.data:
            raise RuntimeError("analyses insert boş döndü")
        return initial.job_id

    async def update_job_status(
        self, *, tenant_id: str, job_id: str, status: str,
    ) -> None:
        (
            self._db.table("analyses")
            .update({"status": status})
            .eq("tenant_id", tenant_id)
            .eq("job_id", job_id)
            .execute()
        )

    async def set_job_result(
        self, *, tenant_id: str, job_id: str, result: AnalysisResult,
    ) -> None:
        payload: dict[str, Any] = {
            "status": result.status,
            "result": result.model_dump(mode="json"),
        }
        if result.completed_at is not None:
            payload["completed_at"] = result.completed_at.isoformat()
        (
            self._db.table("analyses")
            .update(payload)
            .eq("tenant_id", tenant_id)
            .eq("job_id", job_id)
            .execute()
        )

    async def get_job(
        self, *, tenant_id: str, job_id: str,
    ) -> AnalysisResult:
        res = (
            self._db.table("analyses")
            .select("result")
            .eq("tenant_id", tenant_id)
            .eq("job_id", job_id)
            .limit(1)
            .execute()
        )
        rows = res.data or []
        if not rows or not rows[0].get("result"):
            raise JobNotFound(job_id)
        return AnalysisResult.model_validate(rows[0]["result"])


_singleton: SupabaseJobRepo | None = None


def get_job_repo() -> JobRepo:
    global _singleton
    if _singleton is None:
        from supabase_client import get_service_client
        _singleton = SupabaseJobRepo(get_service_client())
    return _singleton


def _reset_for_tests() -> None:
    global _singleton
    _singleton = None


def make_initial_result(job_id: str | None = None) -> AnalysisResult:
    """Yeni iş başlatırken iskelet AnalysisResult üretir (pending)."""
    return AnalysisResult(
        job_id=job_id or str(uuid.uuid4()),
        status="pending",
        risk_score=1,
        risk_label="green",
        risk_explanation="Henüz analiz başlamadı.",
        created_at=datetime.utcnow(),
    )

"""POST /v2/{slug}/integrations/bank-statement — PDF ekstre yükle, parse et, kaydet.
GET  /v2/{slug}/integrations                       — tenant'ın entegrasyonları.
GET  /v2/{slug}/bank-transactions                  — son banka hareketleri.

PDF bytes önce Gemini Vision'a parse için gönderilir, sonra Supabase Storage'a
yüklenir ve `documents.file_url` `supabase://bucket/path` formatında saklanır.
"""

from __future__ import annotations

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

from config import settings
from middleware.tenant import require_tenant
from repositories.bank_repo import BankRepo, get_bank_repo
from schemas.bank import BankStatementImportResult, BankTransactionOut
from schemas.tenant import TenantContext
from services.bank_statement_parser import BankParseError, BankStatementParser
from services.storage import StorageError, StorageService, get_storage_service

log = logging.getLogger(__name__)
router = APIRouter(prefix="/v2/{slug}", tags=["v2-integrations"])

# Parser modül-seviyesinde lazy oluşur (testte monkeypatch).
_parser: BankStatementParser | None = None


def _get_parser() -> BankStatementParser:
    global _parser
    if _parser is None:
        _parser = BankStatementParser()
    return _parser


def _reset_parser_for_tests() -> None:
    global _parser
    _parser = None


@router.post(
    "/integrations/bank-statement",
    status_code=status.HTTP_201_CREATED,
    response_model=BankStatementImportResult,
)
async def upload_bank_statement(
    ctx: Annotated[TenantContext, Depends(require_tenant)],
    repo: Annotated[BankRepo, Depends(get_bank_repo)],
    storage: Annotated[StorageService, Depends(get_storage_service)],
    file: UploadFile = File(...),
) -> BankStatementImportResult:
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="yalnızca PDF kabul edilir")
    pdf_bytes = await file.read()
    if not pdf_bytes:
        raise HTTPException(status_code=400, detail="boş dosya")
    if len(pdf_bytes) > settings.max_pdf_size_mb * 1024 * 1024:
        raise HTTPException(
            status_code=413,
            detail=f"dosya {settings.max_pdf_size_mb}MB'tan büyük",
        )

    parser = _get_parser()
    try:
        statement = await parser.parse(pdf_bytes)
    except BankParseError as e:
        raise HTTPException(status_code=422, detail=f"ekstre okunamadı: {e}") from e

    file_name = file.filename or "bank_statement.pdf"
    try:
        file_url = await storage.upload_pdf(
            tenant_id=ctx.tenant_id, doc_type="bank_statement",
            file_name=file_name, data=pdf_bytes,
        )
    except StorageError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e

    document_id = await repo.create_document(
        tenant_id=ctx.tenant_id, file_name=file_name, file_url=file_url,
    )

    inserted, skipped = await repo.bulk_insert_transactions(
        tenant_id=ctx.tenant_id,
        source_document_id=document_id,
        bank_name=statement.bank_name,
        account_iban=statement.account_iban,
        rows=statement.transactions,
    )

    # bank_statement provider'ı için integration kaydı tut (last_sync_at güncellenir)
    await repo.upsert_integration(
        tenant_id=ctx.tenant_id,
        provider="bank_statement",
        config={"last_document_id": document_id, "last_bank": statement.bank_name},
    )

    txs = statement.transactions
    period_start = min((t.transacted_at for t in txs), default=None)
    period_end = max((t.transacted_at for t in txs), default=None)

    return BankStatementImportResult(
        document_id=document_id,
        transactions_imported=inserted,
        transactions_skipped_duplicate=skipped,
        bank_name=statement.bank_name,
        period_start=period_start,
        period_end=period_end,
    )


@router.get("/integrations")
async def list_integrations(
    ctx: Annotated[TenantContext, Depends(require_tenant)],
    repo: Annotated[BankRepo, Depends(get_bank_repo)],
) -> list[dict]:
    return await repo.list_integrations(tenant_id=ctx.tenant_id)


@router.get("/bank-transactions", response_model=list[BankTransactionOut])
async def list_bank_transactions(
    ctx: Annotated[TenantContext, Depends(require_tenant)],
    repo: Annotated[BankRepo, Depends(get_bank_repo)],
    limit: int = 100,
) -> list[BankTransactionOut]:
    if limit < 1 or limit > 1000:
        raise HTTPException(status_code=400, detail="limit 1-1000 arası olmalı")
    return await repo.list_transactions(tenant_id=ctx.tenant_id, limit=limit)

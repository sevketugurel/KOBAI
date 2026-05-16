"""v2 Sanal POS router (Faz 6 — iyzico Checkout webhook stub).

Tenant-bound:
  PUT  /v2/{slug}/integrations/pos              — provider + credentials
  GET  /v2/{slug}/integrations/pos              — durum
  GET  /v2/{slug}/pos/transactions              — son N işlem
  GET  /v2/{slug}/pos/summary?date=YYYY-MM-DD   — günlük özet

Public (HMAC korumalı):
  POST /v2/pos/webhook/{tenant_id}              — iyzico tarafından tetiklenir

Webhook UNIQUE(pos_provider, external_id) idempotent — retry'larda 200 +
`duplicate: true` dönülür, çift kayıt yazılmaz.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
from datetime import date, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status

from middleware.tenant import require_tenant
from repositories.pos_repo import PosRepo, get_pos_repo
from schemas.pos import (
    PosConfigIn,
    PosConfigOut,
    PosDailySummary,
    PosTransactionOut,
    PosWebhookAck,
    PosWebhookEvent,
)
from schemas.tenant import TenantContext
from services.encryption import (
    EncryptionError,
    EncryptionNotConfigured,
    decrypt_credentials,
    encrypt_credentials,
)
from services.agent_events import AgentEvent, get_event_bus
from services.tenant_rag import refresh_tenant_rag

log = logging.getLogger(__name__)
tenant_router = APIRouter(prefix="/v2/{slug}", tags=["v2-pos"])
public_router = APIRouter(prefix="/v2/pos", tags=["v2-pos-webhook"])


def _webhook_url(tenant_id: str) -> str:
    return f"/v2/pos/webhook/{tenant_id}"


# ── PUT/GET config ────────────────────────────────────────────────────


@tenant_router.put("/integrations/pos", response_model=PosConfigOut)
async def upsert_pos_provider(
    payload: PosConfigIn,
    ctx: Annotated[TenantContext, Depends(require_tenant)],
    repo: Annotated[PosRepo, Depends(get_pos_repo)],
) -> PosConfigOut:
    if ctx.role not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="yalnızca owner/admin yapılandırabilir")
    try:
        enc_creds = encrypt_credentials(payload.credentials)
        enc_secret = encrypt_credentials({"secret": payload.webhook_secret})
    except EncryptionNotConfigured as e:
        raise HTTPException(status_code=503, detail=str(e)) from e

    row = await repo.upsert_provider(
        tenant_id=ctx.tenant_id,
        provider=payload.provider,
        encrypted_credentials=enc_creds,
        encrypted_webhook_secret=enc_secret,
    )
    return PosConfigOut(
        provider=payload.provider,
        is_active=bool(row.get("is_active", True)),
        has_credentials=True,
        has_webhook_secret=True,
        webhook_url=_webhook_url(ctx.tenant_id),
    )


@tenant_router.get("/integrations/pos", response_model=PosConfigOut)
async def get_pos_provider(
    ctx: Annotated[TenantContext, Depends(require_tenant)],
    repo: Annotated[PosRepo, Depends(get_pos_repo)],
) -> PosConfigOut:
    row = await repo.get_provider(tenant_id=ctx.tenant_id)
    if not row:
        return PosConfigOut(webhook_url=_webhook_url(ctx.tenant_id))
    creds = row.get("credentials") or {}
    return PosConfigOut(
        provider=row.get("provider"),
        is_active=bool(row.get("is_active")),
        has_credentials=bool(creds.get("cipher")),
        has_webhook_secret=bool(creds.get("webhook_secret_cipher")),
        last_sync_at=row.get("last_sync_at"),
        last_error=row.get("last_error"),
        webhook_url=_webhook_url(ctx.tenant_id),
    )


@tenant_router.get("/pos/transactions", response_model=list[PosTransactionOut])
async def list_pos_transactions(
    ctx: Annotated[TenantContext, Depends(require_tenant)],
    repo: Annotated[PosRepo, Depends(get_pos_repo)],
    limit: int = 100,
) -> list[PosTransactionOut]:
    if not 1 <= limit <= 1000:
        raise HTTPException(status_code=400, detail="limit 1-1000")
    return await repo.list_transactions(tenant_id=ctx.tenant_id, limit=limit)


@tenant_router.get("/pos/summary", response_model=PosDailySummary)
async def pos_daily_summary(
    ctx: Annotated[TenantContext, Depends(require_tenant)],
    repo: Annotated[PosRepo, Depends(get_pos_repo)],
    target_date: str | None = None,
) -> PosDailySummary:
    if target_date:
        try:
            target = date.fromisoformat(target_date)
        except ValueError as e:
            raise HTTPException(status_code=400, detail="date YYYY-MM-DD") from e
    else:
        target = date.today()
    summary = await repo.daily_summary(tenant_id=ctx.tenant_id, target=target)
    return PosDailySummary(**summary)


# ── Webhook ───────────────────────────────────────────────────────────


def _compute_hmac(body: bytes, secret: str) -> str:
    return hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()


@public_router.post(
    "/webhook/{tenant_id}",
    response_model=PosWebhookAck,
    status_code=status.HTTP_200_OK,
)
async def pos_webhook(
    tenant_id: str,
    request: Request,
    repo: Annotated[PosRepo, Depends(get_pos_repo)],
    x_pos_signature: Annotated[str | None, Header()] = None,
) -> PosWebhookAck:
    body = await request.body()
    if not body:
        raise HTTPException(status_code=400, detail="boş gövde")

    row = await repo.get_provider(tenant_id=tenant_id)
    if not row:
        raise HTTPException(status_code=401, detail="imza doğrulanamadı")
    creds = row.get("credentials") or {}
    secret_cipher = creds.get("webhook_secret_cipher")
    if not secret_cipher or not x_pos_signature:
        raise HTTPException(status_code=401, detail="imza doğrulanamadı")
    try:
        secret = decrypt_credentials(secret_cipher)["secret"]
    except (EncryptionError, EncryptionNotConfigured, KeyError) as e:
        log.exception("pos webhook secret decrypt başarısız tenant=%s", tenant_id)
        raise HTTPException(status_code=503, detail="config bozuk") from e

    expected = _compute_hmac(body, secret)
    if not hmac.compare_digest(expected, x_pos_signature):
        raise HTTPException(status_code=401, detail="imza doğrulanamadı")

    # Body parse
    try:
        data = json.loads(body)
        event = PosWebhookEvent.model_validate(data)
    except Exception as e:  # noqa: BLE001
        log.exception("pos webhook body parse fail tenant=%s", tenant_id)
        await repo.mark_webhook_received(tenant_id=tenant_id, last_error=str(e))
        raise HTTPException(status_code=422, detail=f"event parse edilemedi: {e}") from e

    if event.event_type == "ping":
        await repo.mark_webhook_received(tenant_id=tenant_id)
        return PosWebhookAck(accepted=True, message="ping kabul edildi")

    txn_id, duplicate = await repo.insert_transaction(
        tenant_id=tenant_id, event=event,
    )
    await repo.mark_webhook_received(tenant_id=tenant_id)
    try:
        await refresh_tenant_rag(tenant_id=tenant_id)
    except Exception as e:  # noqa: BLE001
        log.warning("tenant RAG index güncellenemedi tenant=%s: %s", tenant_id, e)
    if not duplicate:
        bus = get_event_bus()
        await bus.emit(AgentEvent(
            tenant_id=tenant_id,
            event_type="pos.transaction.created",
            payload={"txn_id": txn_id, "external_id": event.external_id},
        ))
        await bus.emit(AgentEvent(
            tenant_id=tenant_id,
            event_type="tenant_rag.indexed",
            payload={"reason": "pos"},
        ))
    log.info(
        "pos webhook: tenant=%s txn=%s dup=%s ext=%s amount=%s",
        tenant_id, txn_id, duplicate, event.external_id, event.amount,
    )
    return PosWebhookAck(
        accepted=True,
        transaction_id=txn_id,
        duplicate=duplicate,
        message=("mükerrer (idempotent)" if duplicate else "işlem kaydedildi"),
    )

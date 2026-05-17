"""v2 chat için tool-backed context assembly."""

from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timezone

from rag.collections import global_mevzuat_collection, tenant_docs_collection
from rag.retriever import RagRetriever
from repositories.agent_snapshot_repo import AgentSnapshotRepo
from repositories.bank_repo import BankRepo
from repositories.chat_repo import ChatRepo
from repositories.job_repo import JobNotFound, JobRepo
from repositories.pos_repo import PosRepo
from repositories.tax_repo import TaxRepo
from services.dashboard_summary import build_dashboard_summary
from services.tenant_context import TenantDataService

log = logging.getLogger(__name__)

SYSTEM_GUIDANCE = (
    "Sistem yönergesi: Mevcut tenant verisi yeterliyse kullanıcıdan tekrar veri isteme. "
    "Eksikse hangi tablo/veri eksik olduğunu açıkça söyle. KDV sorularında öncelik sırası: "
    "tax_calendar_items pending/overdue tutarları, sonra fatura KDV toplamları, sonra POS/banka açıklayıcı sinyalleri. "
    "Yanıtı yalnızca bu tenant bağlamıyla sınırla."
)


class ChatContextServiceV2:
    def __init__(
        self,
        *,
        chat_repo: ChatRepo,
        job_repo: JobRepo,
        tenant_data: TenantDataService,
        bank_repo: BankRepo,
        pos_repo: PosRepo,
        tax_repo: TaxRepo,
        snapshot_repo: AgentSnapshotRepo,
    ) -> None:
        self._chat_repo = chat_repo
        self._job_repo = job_repo
        self._tenant_data = tenant_data
        self._bank_repo = bank_repo
        self._pos_repo = pos_repo
        self._tax_repo = tax_repo
        self._snapshot_repo = snapshot_repo

    async def build(
        self,
        *,
        tenant_id: str,
        session_id: str,
        message: str,
        job_id: str | None,
    ) -> str:
        parts: list[str] = [SYSTEM_GUIDANCE]
        used_tools: list[str] = []

        await self._append_job_context(parts=parts, tenant_id=tenant_id, job_id=job_id)

        dashboard = await build_dashboard_summary(
            tenant_id=tenant_id,
            bank_repo=self._bank_repo,
            pos_repo=self._pos_repo,
            tax_repo=self._tax_repo,
            snapshot_repo=self._snapshot_repo,
            today=datetime.now(timezone.utc).date(),
        )
        used_tools.append("dashboard_summary")
        parts.append(
            "Tool dashboard_summary:\n"
            + json.dumps(
                {
                    "period_start": dashboard.period_start.isoformat(),
                    "period_end": dashboard.period_end.isoformat(),
                    "net_flow_this_month": str(dashboard.net_flow_this_month),
                    "pos_sales_this_month": str(dashboard.pos_sales_this_month),
                    "upcoming_tax_count": dashboard.upcoming_tax_count,
                    "integration_count": dashboard.integration_count,
                    "recommended_actions": [item.model_dump(mode="json") for item in dashboard.recommended_actions],
                },
                ensure_ascii=False,
            )
        )

        tenant_context = await self._tenant_data.build_context(tenant_id=tenant_id)
        used_tools.append("tenant_structured_context")
        parts.append("Tool tenant_structured_context:\n" + tenant_context.summary_text())

        tax_items = [item for item in tenant_context.tax_calendar_items if item.status in ("pending", "overdue")]
        used_tools.append("tax_calendar_items")
        if tax_items:
            parts.append(
                "Tool tax_calendar_items:\n"
                + json.dumps(
                    [
                        {
                            "title": item.title,
                            "period": item.period,
                            "status": item.status,
                            "due_date": str(item.due_date),
                            "amount": str(item.amount) if item.amount is not None else None,
                            "currency": item.currency,
                        }
                        for item in tax_items[:8]
                    ],
                    ensure_ascii=False,
                )
            )

        bank_txns, pos_txns, snapshots, private_hits, global_hits = await asyncio.gather(
            self._bank_repo.list_transactions(tenant_id=tenant_id, limit=8),
            self._pos_repo.list_transactions(tenant_id=tenant_id, limit=8),
            self._snapshot_repo.get_all(tenant_id=tenant_id),
            RagRetriever(
                collection_name=tenant_docs_collection(tenant_id), scope="private"
            ).search(f"{message} tenant finans özeti vergi banka pos fatura gider gelir", n_results=5),
            RagRetriever(
                collection_name=global_mevzuat_collection(), scope="global"
            ).search(f"{message} Türk vergi mevzuatı KDV GVK SGK kanun yönetmelik", n_results=5),
        )

        used_tools.append("recent_bank_transactions")
        if bank_txns:
            parts.append(
                "Tool recent_bank_transactions:\n"
                + json.dumps(
                    [
                        {
                            "direction": tx.direction,
                            "amount": str(tx.amount),
                            "currency": tx.currency,
                            "description": tx.description,
                            "transacted_at": tx.transacted_at.isoformat(),
                        }
                        for tx in bank_txns
                    ],
                    ensure_ascii=False,
                )
            )

        used_tools.extend(["pos_transactions", "pos_daily_summary"])
        if pos_txns:
            parts.append(
                "Tool pos_transactions:\n"
                + json.dumps(
                    [
                        {
                            "txn_type": tx.txn_type,
                            "status": tx.status,
                            "amount": str(tx.amount),
                            "currency": tx.currency,
                            "transacted_at": tx.transacted_at.isoformat(),
                        }
                        for tx in pos_txns
                    ],
                    ensure_ascii=False,
                )
            )
            latest_day = max(tx.transacted_at.date() for tx in pos_txns)
            pos_daily = await self._pos_repo.daily_summary(tenant_id=tenant_id, target=latest_day)
            parts.append(
                "Tool pos_daily_summary:\n"
                + json.dumps(pos_daily, ensure_ascii=False, default=str)
            )

        used_tools.append("agent_snapshots")
        if snapshots:
            parts.append(
                "Tool agent_snapshots:\n"
                + json.dumps(
                    [
                        {
                            "agent_name": snap.agent_name,
                            "status": snap.status,
                            "missing": snap.missing,
                            "output": snap.output,
                            "updated_at": snap.updated_at.isoformat() if snap.updated_at else None,
                        }
                        for snap in snapshots
                    ],
                    ensure_ascii=False,
                    default=str,
                )
            )

        if private_hits:
            used_tools.append("tenant_private_rag")
            parts.append(
                "Tenant private RAG kaynakları:\n"
                + json.dumps(private_hits, ensure_ascii=False)
            )
        if global_hits:
            used_tools.append("global_mevzuat_rag")
            parts.append(
                "Global mevzuat RAG kaynakları:\n"
                + json.dumps(global_hits, ensure_ascii=False)
            )

        history = await self._chat_repo.list_recent(tenant_id=tenant_id, session_id=session_id, limit=10)
        if history:
            used_tools.append("chat_history")
            parts.append(
                "Önceki sohbet:\n"
                + json.dumps(
                    [{"role": m.role, "content": m.content} for m in history],
                    ensure_ascii=False,
                )
            )

        parts.insert(1, "Kullanılan tool verileri: " + ", ".join(dict.fromkeys(used_tools)))
        return "\n\n".join(parts)

    async def _append_job_context(
        self,
        *,
        parts: list[str],
        tenant_id: str,
        job_id: str | None,
    ) -> None:
        try:
            if job_id:
                job = await self._job_repo.get_job(tenant_id=tenant_id, job_id=job_id)
                parts.append(
                    f"Şirket nakit akışı (3 ay): {job.cash_flow_forecast}\n"
                    f"Risk: {job.risk_label} — {job.risk_explanation}\n"
                    f"Risk sürücüleri: {job.risk_key_drivers}\n"
                    f"Vergi önerileri sayısı: {len(job.tax_recommendations)}"
                )
                return
            job = await self._job_repo.get_latest_completed(tenant_id=tenant_id)
            if job is not None:
                parts.append(
                    f"Son tamamlanan analiz: job={job.job_id}, risk={job.risk_label}, "
                    f"nakit akışı={job.cash_flow_forecast}, açıklama={job.risk_explanation}, "
                    f"aksiyon sayısı={len(job.risk_recommended_actions)}"
                )
        except JobNotFound:
            parts.append(f"(job {job_id} bulunamadı — güncel tenant bağlamı kullanılıyor)")
        except Exception as exc:  # noqa: BLE001
            log.warning("analiz bağlamı okunamadı tenant=%s job=%s: %s", tenant_id, job_id, exc)

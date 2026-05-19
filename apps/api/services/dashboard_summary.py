"""Tenant dashboard aggregation (Sprint B).

İçinde DB'ye erişim yok — yalnızca repo protokollerini kullanarak Python
tarafında toplama yapar. Bu sayede testler FakeRepo'larla deterministik
çalışır ve router ince kalır.
"""

from __future__ import annotations

from datetime import date, datetime, timezone
from decimal import Decimal

from repositories.agent_snapshot_repo import AgentSnapshotRepo
from repositories.bank_repo import BankRepo
from repositories.pos_repo import PosRepo
from repositories.tax_repo import TaxRepo
from schemas.analysis import RecommendedAction
from schemas.dashboard import DashboardActivity, DashboardSummaryOut

UPCOMING_TAX_WINDOW_DAYS = 30
RECENT_ACTIVITY_LIMIT = 10
UPCOMING_TAXES_DISPLAY = 3
BANK_LOOKBACK = 200
POS_LOOKBACK = 200


def _tax_action_due_hint(item_due_date: date, *, today: date, status: str) -> str:
    if status == "overdue":
        return "Bugün"
    delta = (item_due_date - today).days
    if delta <= 7:
        return "Bu hafta"
    return "Bu ay"


def _fallback_tax_actions(*, tax_items, today: date) -> list[RecommendedAction]:
    pending_or_overdue = sorted(
        [item for item in tax_items if item.status in ("overdue", "pending")],
        key=lambda item: (0 if item.status == "overdue" else 1, item.due_date),
    )
    actions: list[RecommendedAction] = []
    for item in pending_or_overdue[:3]:
        actions.append(
            RecommendedAction(
                title=f"{item.title} için plan yapın",
                detail=(
                    f"{item.period or 'Güncel dönem'} kalemi {item.status} durumda. "
                    f"Vade {item.due_date.isoformat()} öncesi ödeme ve mutabakatı netleştirin."
                ),
                priority="high" if item.status == "overdue" else "medium",
                due_hint=_tax_action_due_hint(item.due_date, today=today, status=item.status),
                source_agent="tax_calendar",
            )
        )
    return actions


async def _recommended_actions(
    *,
    tenant_id: str,
    snapshot_repo: AgentSnapshotRepo,
    tax_items,
    today: date,
) -> list[RecommendedAction]:
    risk_snapshot = await snapshot_repo.get(tenant_id=tenant_id, agent_name="risk")
    raw_actions = (
        risk_snapshot.output.get("risk_recommended_actions")
        if risk_snapshot and risk_snapshot.status == "completed" and risk_snapshot.output
        else None
    )
    if isinstance(raw_actions, list):
        parsed: list[RecommendedAction] = []
        for row in raw_actions:
            try:
                parsed.append(RecommendedAction.model_validate(row))
            except Exception:
                continue
        if parsed:
            return parsed[:3]
    return _fallback_tax_actions(tax_items=tax_items, today=today)


def _month_window(today: date) -> tuple[date, date]:
    first = today.replace(day=1)
    return first, today


async def build_dashboard_summary(
    *,
    tenant_id: str,
    bank_repo: BankRepo,
    pos_repo: PosRepo,
    tax_repo: TaxRepo,
    snapshot_repo: AgentSnapshotRepo,
    today: date | None = None,
) -> DashboardSummaryOut:
    today = today or datetime.now(timezone.utc).date()
    period_start, period_end = _month_window(today)

    bank_txns = await bank_repo.list_transactions(tenant_id=tenant_id, limit=BANK_LOOKBACK)
    pos_txns = await pos_repo.list_transactions(tenant_id=tenant_id, limit=POS_LOOKBACK)
    tax_items = await tax_repo.list_items(tenant_id=tenant_id)
    integrations = await bank_repo.list_integrations(tenant_id=tenant_id)

    net_flow = Decimal("0")
    for t in bank_txns:
        if t.transacted_at.date() < period_start or t.transacted_at.date() > period_end:
            continue
        signed = t.amount if t.direction == "credit" else -t.amount
        net_flow += signed

    pos_sales = Decimal("0")
    for p in pos_txns:
        if p.transacted_at.date() < period_start or p.transacted_at.date() > period_end:
            continue
        if p.txn_type == "sale" and p.status == "success":
            pos_sales += p.amount

    pending_upcoming = sorted(
        [
            it for it in tax_items
            if it.status == "pending" and 0 <= (it.due_date - today).days <= UPCOMING_TAX_WINDOW_DAYS
        ],
        key=lambda i: i.due_date,
    )
    upcoming_taxes = pending_upcoming[:UPCOMING_TAXES_DISPLAY]

    active_integrations = [i for i in integrations if i.get("is_active")]
    recommended_actions = await _recommended_actions(
        tenant_id=tenant_id,
        snapshot_repo=snapshot_repo,
        tax_items=tax_items,
        today=today,
    )

    activities: list[DashboardActivity] = []
    for t in bank_txns[:RECENT_ACTIVITY_LIMIT]:
        sign = "+" if t.direction == "credit" else "−"
        activities.append(
            DashboardActivity(
                id=str(t.id),
                type="bank",
                title=f"{sign} {t.description or t.bank_name}",
                amount=t.amount if t.direction == "credit" else -t.amount,
                currency=t.currency or "TRY",
                timestamp=t.transacted_at,
            )
        )
    for p in pos_txns[:RECENT_ACTIVITY_LIMIT]:
        activities.append(
            DashboardActivity(
                id=str(p.id),
                type="pos",
                title=f"POS {p.txn_type} ({p.status})",
                amount=p.amount,
                currency=p.currency or "TRY",
                timestamp=p.transacted_at,
            )
        )
    activities.sort(key=lambda a: a.timestamp, reverse=True)
    activities = activities[:RECENT_ACTIVITY_LIMIT]

    return DashboardSummaryOut(
        period_start=period_start,
        period_end=period_end,
        net_flow_this_month=net_flow,
        pos_sales_this_month=pos_sales,
        upcoming_tax_count=len(pending_upcoming),
        integration_count=len(active_integrations),
        upcoming_taxes=upcoming_taxes,
        recent_activities=activities,
        recommended_actions=recommended_actions,
        updated_at=datetime.now(timezone.utc),
    )

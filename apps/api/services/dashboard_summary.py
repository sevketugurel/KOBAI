"""Tenant dashboard aggregation (Sprint B).

İçinde DB'ye erişim yok — yalnızca repo protokollerini kullanarak Python
tarafında toplama yapar. Bu sayede testler FakeRepo'larla deterministik
çalışır ve router ince kalır.
"""

from __future__ import annotations

from datetime import date, datetime, timezone
from decimal import Decimal

from repositories.bank_repo import BankRepo
from repositories.pos_repo import PosRepo
from repositories.tax_repo import TaxRepo
from schemas.dashboard import DashboardActivity, DashboardSummaryOut

UPCOMING_TAX_WINDOW_DAYS = 30
RECENT_ACTIVITY_LIMIT = 10
UPCOMING_TAXES_DISPLAY = 3
BANK_LOOKBACK = 200
POS_LOOKBACK = 200


def _month_window(today: date) -> tuple[date, date]:
    first = today.replace(day=1)
    return first, today


async def build_dashboard_summary(
    *,
    tenant_id: str,
    bank_repo: BankRepo,
    pos_repo: PosRepo,
    tax_repo: TaxRepo,
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
        updated_at=datetime.now(timezone.utc),
    )

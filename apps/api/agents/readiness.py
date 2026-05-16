"""Ajan başına veri hazır olma (readiness) kontrolü ve giriş versiyon hash'i.

Her ajan kendi minimum veri eşiğine sahip. `check_readiness` bir
`TenantAnalysisContext` alıp ajan için (ready, missing) ile birlikte bir
`input_version_hash` döner. Hash, kaynak sayıları + max tarih bileşeninden
türetilir; aynı hash ile ajan tekrar koşulmaz (idempotency).
"""

from __future__ import annotations

import hashlib
import json
from collections import defaultdict
from dataclasses import dataclass

from services.tenant_context import TenantAnalysisContext

AgentName = str

AGENT_NAMES: tuple[AgentName, ...] = (
    "nakit_akisi",
    "risk",
    "mevzuat_rag",
    "kosgeb",
)


@dataclass
class ReadinessResult:
    agent_name: AgentName
    ready: bool
    missing: list[str]
    input_version_hash: str


def _has_invoice_trend(ctx: TenantAnalysisContext, *, min_months: int) -> bool:
    months = {inv.date.strftime("%Y-%m") for inv in ctx.invoices}
    return len(months) >= min_months


def _has_revenue_signal(ctx: TenantAnalysisContext) -> bool:
    """Banka kredisi veya başarılı POS satışı varsa mevzuat için gelir sinyali sayar."""
    if any(tx.direction == "credit" for tx in ctx.bank_transactions):
        return True
    if any(
        tx.status == "success" and tx.txn_type == "sale"
        for tx in ctx.pos_transactions
    ):
        return True
    return False


def _ready_nakit_akisi(ctx: TenantAnalysisContext) -> tuple[bool, list[str]]:
    if ctx.invoices:
        return True, []
    if ctx.bank_transactions:
        return True, []
    if any(tx.status == "success" for tx in ctx.pos_transactions):
        return True, []
    return False, [
        "En az 1 fatura, banka hareketi veya başarılı POS işlemi yüklenmeli."
    ]


def _ready_risk(ctx: TenantAnalysisContext) -> tuple[bool, list[str]]:
    nakit_ready, _ = _ready_nakit_akisi(ctx)
    if nakit_ready:
        return True, []
    if _has_invoice_trend(ctx, min_months=2):
        return True, []
    return False, ["Risk için nakit akışı verisi veya 2+ aylık fatura trendi gerekli."]


def _ready_mevzuat_rag(ctx: TenantAnalysisContext) -> tuple[bool, list[str]]:
    if ctx.invoices:
        return True, []
    if _has_revenue_signal(ctx):
        return True, []
    return False, ["Mevzuat analizi için fatura veya gelir sinyali (banka/POS) gerekli."]


def _ready_kosgeb(ctx: TenantAnalysisContext) -> tuple[bool, list[str]]:
    missing: list[str] = []
    if not ctx.tenant_profile.get("sector"):
        missing.append("Tenant sektörü tanımlı değil.")
    if not ctx.tenant_profile.get("company_type"):
        missing.append("Tenant şirket tipi tanımlı değil.")
    return (not missing), missing


_CHECKERS = {
    "nakit_akisi": _ready_nakit_akisi,
    "risk": _ready_risk,
    "mevzuat_rag": _ready_mevzuat_rag,
    "kosgeb": _ready_kosgeb,
}


def _max_invoice_date(ctx: TenantAnalysisContext) -> str:
    if not ctx.invoices:
        return ""
    return max(inv.date.isoformat() for inv in ctx.invoices)


def _max_bank_date(ctx: TenantAnalysisContext) -> str:
    if not ctx.bank_transactions:
        return ""
    return max(tx.transacted_at.isoformat() for tx in ctx.bank_transactions)


def _max_pos_date(ctx: TenantAnalysisContext) -> str:
    if not ctx.pos_transactions:
        return ""
    return max(tx.transacted_at.isoformat() for tx in ctx.pos_transactions)


def _max_tax_updated(ctx: TenantAnalysisContext) -> str:
    if not ctx.tax_calendar_items:
        return ""
    dates = [
        getattr(item, "updated_at", None) or item.due_date
        for item in ctx.tax_calendar_items
    ]
    return max(str(d) for d in dates if d is not None)


def compute_version_hash(
    agent_name: AgentName, ctx: TenantAnalysisContext
) -> str:
    """Ajanın girdi sürümü için kısa SHA256. Aynı hash → re-run gerekmez."""
    base = {
        "invoice_count": len(ctx.invoices),
        "bank_count": len(ctx.bank_transactions),
        "pos_count": len(ctx.pos_transactions),
        "max_invoice": _max_invoice_date(ctx),
        "max_bank": _max_bank_date(ctx),
        "max_pos": _max_pos_date(ctx),
    }
    if agent_name in ("risk", "mevzuat_rag"):
        base["max_tax"] = _max_tax_updated(ctx)
        base["tax_count"] = len(ctx.tax_calendar_items)
    if agent_name == "kosgeb":
        base["sector"] = ctx.tenant_profile.get("sector") or ""
        base["company_type"] = ctx.tenant_profile.get("company_type") or ""
    if agent_name == "mevzuat_rag":
        # Tenant RAG indeksinin güncelliği invoice/bank max tarih kombinasyonu
        # üzerinden indirekt yakalanır; ayrıca son past_analysis sayısı eklenir.
        base["past_count"] = len(ctx.past_analyses)
    raw = json.dumps(base, sort_keys=True, default=str)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:16]


def check_readiness(
    agent_name: AgentName, ctx: TenantAnalysisContext
) -> ReadinessResult:
    checker = _CHECKERS.get(agent_name)
    if checker is None:
        raise ValueError(f"Bilinmeyen ajan: {agent_name}")
    ready, missing = checker(ctx)
    version_hash = compute_version_hash(agent_name, ctx)
    return ReadinessResult(
        agent_name=agent_name,
        ready=ready,
        missing=missing,
        input_version_hash=version_hash,
    )

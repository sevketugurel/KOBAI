"""Tenant-scoped finansal bağlam toplama ve özetleme.

Bu modül ajan pipeline'ı ve v2 chat için tek structured context katmanıdır.
RAG'e ham JSON yerine kısa, kaynaklı ve hassas alanları temizlenmiş domain
özetleri verir.
"""

from __future__ import annotations

from collections import Counter, defaultdict
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Protocol

from pydantic import BaseModel, ConfigDict, Field

from schemas.analysis import AnalysisResult
from schemas.bank import BankTransactionOut
from schemas.invoice import InvoiceData
from schemas.pos import PosTransactionOut
from schemas.tax import TaxCalendarItemOut


SENSITIVE_KEYS = {
    "credentials",
    "credential",
    "password",
    "secret",
    "webhook_secret",
    "webhook_secret_cipher",
    "cipher",
    "encrypted_credentials",
    "encrypted_webhook_secret",
    "api_key",
    "token",
    "access_token",
    "refresh_token",
    "tax_number",
    "vendor_tax_no",
    "card_last_four",
    "account_iban",
    "iban",
}


def _to_float(value: Any) -> float:
    if value is None:
        return 0.0
    if isinstance(value, Decimal):
        return float(value)
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def _period_from_dt(value: date | datetime | str | None) -> str | None:
    if value is None:
        return None
    if isinstance(value, datetime | date):
        return f"{value.year:04d}-{value.month:02d}"
    text = str(value)
    return text[:7] if len(text) >= 7 else None


def _redact(value: Any, *, key: str | None = None) -> Any:
    """Credentials, tam IBAN, kart bilgisi ve secret değerlerini dışarıda bırak."""
    key_l = (key or "").lower()
    if key_l in SENSITIVE_KEYS:
        return "[REDACTED]"
    if isinstance(value, dict):
        return {k: _redact(v, key=str(k)) for k, v in value.items() if str(k).lower() not in SENSITIVE_KEYS}
    if isinstance(value, list):
        return [_redact(v) for v in value]
    return value


class TenantAnalysisContext(BaseModel):
    model_config = ConfigDict(extra="forbid")

    tenant_id: str
    period: str | None = None
    tenant_profile: dict[str, Any] = Field(default_factory=dict)
    invoices: list[InvoiceData] = Field(default_factory=list)
    bank_transactions: list[BankTransactionOut] = Field(default_factory=list)
    pos_transactions: list[PosTransactionOut] = Field(default_factory=list)
    tax_calendar_items: list[TaxCalendarItemOut] = Field(default_factory=list)
    past_analyses: list[AnalysisResult] = Field(default_factory=list)
    selected_document_ids: list[str] = Field(default_factory=list)

    def selected_or_all_invoices(self) -> list[InvoiceData]:
        return self.invoices

    def monthly_totals(self) -> list[dict[str, Any]]:
        monthly: dict[str, dict[str, float]] = defaultdict(
            lambda: {
                "invoice_income": 0.0,
                "invoice_expense": 0.0,
                "bank_credit": 0.0,
                "bank_debit": 0.0,
                "pos_success_sales": 0.0,
                "pos_failed": 0.0,
            }
        )
        for inv in self.invoices:
            bucket = monthly[inv.date.strftime("%Y-%m")]
            if inv.category == "gelir":
                bucket["invoice_income"] += inv.total_amount
            else:
                bucket["invoice_expense"] += inv.total_amount
        for tx in self.bank_transactions:
            period = _period_from_dt(tx.transacted_at)
            if not period:
                continue
            key = "bank_credit" if tx.direction == "credit" else "bank_debit"
            monthly[period][key] += _to_float(tx.amount)
        for tx in self.pos_transactions:
            period = _period_from_dt(tx.transacted_at)
            if not period:
                continue
            if tx.status == "success" and tx.txn_type == "sale":
                monthly[period]["pos_success_sales"] += _to_float(tx.amount)
            elif tx.status == "failed":
                monthly[period]["pos_failed"] += _to_float(tx.amount)
        return [{"period": p, **vals} for p, vals in sorted(monthly.items())]

    def summary_dict(self) -> dict[str, Any]:
        income_total = sum(i.total_amount for i in self.invoices if i.category == "gelir")
        expense_total = sum(i.total_amount for i in self.invoices if i.category != "gelir")
        bank_credit = sum(_to_float(t.amount) for t in self.bank_transactions if t.direction == "credit")
        bank_debit = sum(_to_float(t.amount) for t in self.bank_transactions if t.direction == "debit")
        pos_success = [
            t for t in self.pos_transactions if t.status == "success" and t.txn_type == "sale"
        ]
        pos_failed = [t for t in self.pos_transactions if t.status == "failed"]
        tax_pending = [
            t for t in self.tax_calendar_items if t.status in ("pending", "overdue")
        ]
        vendors = Counter(i.vendor_name for i in self.invoices if i.category != "gelir")
        customers = Counter(i.vendor_name for i in self.invoices if i.category == "gelir")
        return _redact({
            "tenant_profile": self.tenant_profile,
            "period": self.period,
            "invoice_count": len(self.invoices),
            "invoice_income_total": round(income_total, 2),
            "invoice_expense_total": round(expense_total, 2),
            "invoice_net_total": round(income_total - expense_total, 2),
            "bank_credit_total": round(bank_credit, 2),
            "bank_debit_total": round(bank_debit, 2),
            "bank_net_total": round(bank_credit - bank_debit, 2),
            "pos_success_sales_total": round(sum(_to_float(t.amount) for t in pos_success), 2),
            "pos_failed_count": len(pos_failed),
            "tax_pending_count": len(tax_pending),
            "tax_pending_total": round(sum(_to_float(t.amount) for t in tax_pending), 2),
            "top_expense_vendors": vendors.most_common(5),
            "top_income_customers": customers.most_common(5),
            "monthly": self.monthly_totals(),
            "past_analysis_count": len(self.past_analyses),
        })

    def summary_text(self) -> str:
        s = self.summary_dict()
        profile = s.get("tenant_profile") or {}
        lines = [
            "Tenant finans bağlamı:",
            f"Sektör: {profile.get('sector', 'bilinmiyor')}; şirket tipi: {profile.get('company_type', 'bilinmiyor')}.",
            (
                f"Fatura toplamları: gelir {s['invoice_income_total']:.2f} TRY, "
                f"gider {s['invoice_expense_total']:.2f} TRY, net {s['invoice_net_total']:.2f} TRY."
            ),
            (
                f"Banka toplamları: gelen {s['bank_credit_total']:.2f} TRY, "
                f"giden {s['bank_debit_total']:.2f} TRY, net {s['bank_net_total']:.2f} TRY."
            ),
            (
                f"POS başarılı satış {s['pos_success_sales_total']:.2f} TRY; "
                f"başarısız POS işlem sayısı {s['pos_failed_count']}."
            ),
            (
                f"Bekleyen/gecikmiş vergi kalemi {s['tax_pending_count']}; "
                f"bilinen tutar toplamı {s['tax_pending_total']:.2f} TRY."
            ),
        ]
        if s["top_expense_vendors"]:
            lines.append(f"En yoğun gider tarafları: {s['top_expense_vendors']}.")
        if s["monthly"]:
            lines.append(f"Aylık özet: {s['monthly'][-6:]}.")
        if self.past_analyses:
            last = self.past_analyses[0]
            lines.append(
                f"Son analiz: status={last.status}, risk={last.risk_label}, açıklama={last.risk_explanation}."
            )
        return "\n".join(lines)

    def rag_chunks(self) -> list[dict[str, Any]]:
        chunks: list[dict[str, Any]] = []
        created_at = datetime.utcnow().isoformat()
        for row in self.monthly_totals():
            period = row["period"]
            chunks.append({
                "id": f"{self.tenant_id}:monthly:{period}",
                "text": (
                    f"{period} aylık finans özeti. Fatura geliri {row['invoice_income']:.2f} TRY, "
                    f"fatura gideri {row['invoice_expense']:.2f} TRY, banka gelen {row['bank_credit']:.2f} TRY, "
                    f"banka giden {row['bank_debit']:.2f} TRY, POS başarılı satış {row['pos_success_sales']:.2f} TRY, "
                    f"başarısız POS tutarı {row['pos_failed']:.2f} TRY."
                ),
                "metadata": {
                    "tenant_id": self.tenant_id,
                    "source_type": "monthly_summary",
                    "source_id": period,
                    "period": period,
                    "created_at": created_at,
                    "scope": "private",
                },
            })
        for item in self.tax_calendar_items[:50]:
            chunks.append({
                "id": f"{self.tenant_id}:tax:{item.id}",
                "text": (
                    f"Vergi takvimi kalemi: {item.title}. Tür {item.tax_type}, vade {item.due_date}, "
                    f"durum {item.status}, tutar {_to_float(item.amount):.2f} TRY, dönem {item.period or 'belirsiz'}."
                ),
                "metadata": {
                    "tenant_id": self.tenant_id,
                    "source_type": "tax_calendar_item",
                    "source_id": item.id,
                    "period": item.period,
                    "created_at": created_at,
                    "scope": "private",
                },
            })
        for analysis in self.past_analyses[:10]:
            chunks.append({
                "id": f"{self.tenant_id}:analysis:{analysis.job_id}",
                "text": (
                    f"Geçmiş analiz {analysis.job_id}: risk {analysis.risk_label}, "
                    f"açıklama {analysis.risk_explanation}, vergi önerisi sayısı "
                    f"{len(analysis.tax_recommendations)}, KOSGEB önerisi sayısı {len(analysis.kosgeb_suggestions)}."
                ),
                "metadata": {
                    "tenant_id": self.tenant_id,
                    "source_type": "analysis",
                    "source_id": analysis.job_id,
                    "period": self.period,
                    "created_at": created_at,
                    "scope": "private",
                },
            })
        summary = self.summary_dict()
        chunks.append({
            "id": f"{self.tenant_id}:profile:summary",
            "text": self.summary_text(),
            "metadata": {
                "tenant_id": self.tenant_id,
                "source_type": "tenant_financial_summary",
                "source_id": self.tenant_id,
                "period": self.period,
                "created_at": created_at,
                "scope": "private",
                "invoice_count": summary["invoice_count"],
            },
        })
        return chunks


class TenantDataService(Protocol):
    async def build_context(
        self,
        *,
        tenant_id: str,
        period: str | None = None,
        document_ids: list[str] | None = None,
        tenant_profile: dict[str, Any] | None = None,
        include_all_tenant_data: bool = True,
    ) -> TenantAnalysisContext: ...


class SupabaseTenantDataService:
    def __init__(self, client) -> None:
        self._db = client

    async def build_context(
        self,
        *,
        tenant_id: str,
        period: str | None = None,
        document_ids: list[str] | None = None,
        tenant_profile: dict[str, Any] | None = None,
        include_all_tenant_data: bool = True,
    ) -> TenantAnalysisContext:
        profile = tenant_profile or self._load_tenant_profile(tenant_id)
        invoice_ids = None if include_all_tenant_data else document_ids
        invoices = self._load_invoices(tenant_id=tenant_id, period=period, document_ids=invoice_ids)
        bank = self._load_bank_transactions(tenant_id=tenant_id, period=period)
        pos = self._load_pos_transactions(tenant_id=tenant_id, period=period)
        taxes = self._load_tax_calendar(tenant_id=tenant_id, period=period)
        analyses = self._load_past_analyses(tenant_id=tenant_id, limit=5)
        return TenantAnalysisContext(
            tenant_id=tenant_id,
            period=period,
            tenant_profile=_redact(profile),
            invoices=invoices,
            bank_transactions=bank,
            pos_transactions=pos,
            tax_calendar_items=taxes,
            past_analyses=analyses,
            selected_document_ids=document_ids or [],
        )

    def _load_tenant_profile(self, tenant_id: str) -> dict[str, Any]:
        res = (
            self._db.table("tenants")
            .select("id,slug,display_name,sector,company_type,is_active,created_at")
            .eq("id", tenant_id)
            .limit(1)
            .execute()
        )
        return (res.data or [{}])[0]

    def _load_invoices(
        self, *, tenant_id: str, period: str | None, document_ids: list[str] | None
    ) -> list[InvoiceData]:
        q = (
            self._db.table("documents")
            .select("id,parsed_data,period,created_at")
            .eq("tenant_id", tenant_id)
            .eq("doc_type", "invoice")
        )
        if document_ids:
            q = q.in_("id", document_ids)
        res = q.order("created_at", desc=True).limit(500).execute()
        out: list[InvoiceData] = []
        for row in res.data or []:
            if row.get("parsed_data"):
                out.append(InvoiceData.model_validate(row["parsed_data"]))
        return out

    def _load_bank_transactions(self, *, tenant_id: str, period: str | None) -> list[BankTransactionOut]:
        q = self._db.table("bank_transactions").select("*").eq("tenant_id", tenant_id)
        if period:
            q = q.gte("transacted_at", f"{period}-01T00:00:00+00:00")
        res = q.order("transacted_at", desc=True).limit(500).execute()
        return [BankTransactionOut.model_validate(r) for r in (res.data or [])]

    def _load_pos_transactions(self, *, tenant_id: str, period: str | None) -> list[PosTransactionOut]:
        q = self._db.table("pos_transactions").select("*").eq("tenant_id", tenant_id)
        if period:
            q = q.gte("transacted_at", f"{period}-01T00:00:00+00:00")
        res = q.order("transacted_at", desc=True).limit(500).execute()
        return [PosTransactionOut.model_validate(r) for r in (res.data or [])]

    def _load_tax_calendar(self, *, tenant_id: str, period: str | None) -> list[TaxCalendarItemOut]:
        q = self._db.table("tax_calendar_items").select("*").eq("tenant_id", tenant_id)
        if period:
            q = q.eq("period", period)
        res = q.order("due_date").limit(200).execute()
        return [TaxCalendarItemOut.model_validate(r) for r in (res.data or [])]

    def _load_past_analyses(self, *, tenant_id: str, limit: int) -> list[AnalysisResult]:
        res = (
            self._db.table("analyses")
            .select("result,created_at")
            .eq("tenant_id", tenant_id)
            .eq("status", "completed")
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        out: list[AnalysisResult] = []
        for row in res.data or []:
            if row.get("result"):
                out.append(AnalysisResult.model_validate(row["result"]))
        return out


_singleton: SupabaseTenantDataService | None = None


def get_tenant_data_service() -> TenantDataService:
    global _singleton
    if _singleton is None:
        from supabase_client import get_service_client

        _singleton = SupabaseTenantDataService(get_service_client())
    return _singleton


def _reset_for_tests() -> None:
    global _singleton
    _singleton = None

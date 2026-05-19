"""Risk değerlendirme — sabit eşikler, Türkçe açıklama."""
from __future__ import annotations

from schemas.invoice import InvoiceData
from services.tenant_context import TenantAnalysisContext


THRESH_INCOME_DROP_YELLOW = 0.20
THRESH_INCOME_DROP_RED = 0.40
THRESH_EXPENSE_RISE_YELLOW = 0.30
THRESH_EXPENSE_RISE_RED = 0.50
_RANK = {"green": 0, "yellow": 1, "red": 2}


def _escalate(current: str, new: str) -> str:
    return new if _RANK[new] > _RANK[current] else current


def _priority_for_label(label: str) -> str:
    return {"green": "low", "yellow": "medium", "red": "high"}[label]


def _time_horizon_for_label(label: str, anomalies: list[str]) -> str:
    urgent_markers = ("gecikmiş", "negatif nakit akışı", "kritik", "olağandışı")
    if label == "red" or any(marker in item.lower() for marker in urgent_markers for item in anomalies):
        return "immediate"
    if label == "yellow":
        return "this_week"
    return "this_month"


def _derive_actions(anomalies: list[str], *, label: str) -> list[dict[str, str]]:
    priority = _priority_for_label(label)
    due_hint = {
        "high": "Bugün",
        "medium": "Bu hafta",
        "low": "Bu ay",
    }[priority]
    actions: list[dict[str, str]] = []
    seen_titles: set[str] = set()

    def push(title: str, detail: str, source_agent: str = "risk") -> None:
        if title in seen_titles or len(actions) >= 3:
            return
        seen_titles.add(title)
        actions.append(
            {
                "title": title,
                "detail": detail,
                "priority": priority,
                "due_hint": due_hint,
                "source_agent": source_agent,
            }
        )

    lowered = [item.lower() for item in anomalies]
    if any("gelirde" in item for item in lowered):
        push(
            "Gelir daralmasını teyit edin",
            "Son ay satış düşüşünü müşteri, kanal ve ürün bazında ayırıp kayıp kaynağını netleştirin.",
        )
    if any("gider" in item for item in lowered):
        push(
            "Artan gider kalemlerini sıkıştırın",
            "Son dönem gider artışını tedarikçi ve kategori bazında gözden geçirip ertelenebilir kalemleri durdurun.",
        )
    if any("negatif nakit akışı" in item for item in lowered):
        push(
            "Nakit tamponu oluşturun",
            "Önümüzdeki iki dönemin çıkışlarını tahsilat planı ve ödeme ertelemesiyle yeniden dengeleyin.",
        )
    if any("vergi takvimi" in item or "bekleyen vergi" in item for item in lowered):
        push(
            "Vergi takvimini kapatın",
            "Bekleyen ve gecikmiş vergi kalemleri için ödeme sırasını netleştirip cezalı kalemleri öne alın.",
            source_agent="tax_calendar",
        )
    if any("başarısız işlem" in item for item in lowered):
        push(
            "POS hata nedenlerini temizleyin",
            "Başarısız POS işlemlerini banka/POS sağlayıcısı bazında inceleyip tahsilat kaybını azaltın.",
            source_agent="collections_agent",
        )
    if not actions:
        push(
            "Nakit disiplinini koruyun",
            "Bu ay gelir, gider ve vergi çıkışlarını haftalık kontrol ederek mevcut tamponu koruyun.",
        )
    return actions


class RiskAgent:
    async def assess(
        self,
        invoices: list[InvoiceData],
        forecast: list[dict],
        *,
        tenant_context: TenantAnalysisContext | None = None,
    ) -> dict:
        anomalies: list[str] = []
        label = "green"

        # 1. Trend Analizi: Son ayı önceki ayların ortalamasıyla kıyasla
        by_month: dict[str, dict[str, float]] = {}
        for inv in invoices:
            k = inv.date.strftime("%Y-%m")
            b = by_month.setdefault(k, {"income": 0.0, "expense": 0.0})
            if inv.category == "gelir":
                b["income"] += inv.total_amount
            else:
                b["expense"] += inv.total_amount

        keys = sorted(by_month.keys())
        if len(keys) >= 2:
            prev_keys = keys[:-1]
            last_key = keys[-1]
            
            # Ortalama baz puanı (Baseline)
            avg_prev_inc = sum(by_month[k]["income"] for k in prev_keys) / len(prev_keys)
            avg_prev_exp = sum(by_month[k]["expense"] for k in prev_keys) / len(prev_keys)
            
            last_inc = by_month[last_key]["income"]
            last_exp = by_month[last_key]["expense"]

            # Gelir düşüşü kontrolü
            if avg_prev_inc > 0:
                inc_drop = max(0, (avg_prev_inc - last_inc) / avg_prev_inc)
                if inc_drop > THRESH_INCOME_DROP_RED:
                    anomalies.append(f"Gelirde geçmiş ortalamaya göre %{int(inc_drop*100)} oranında kritik düşüş.")
                    label = _escalate(label, "red")
                elif inc_drop > THRESH_INCOME_DROP_YELLOW:
                    anomalies.append(f"Gelirde %{int(inc_drop*100)} oranında daralma gözlemlendi.")
                    label = _escalate(label, "yellow")

            # Gider artışı kontrolü
            if avg_prev_exp > 0:
                exp_rise = max(0, (last_exp - avg_prev_exp) / avg_prev_exp)
                if exp_rise > THRESH_EXPENSE_RISE_RED:
                    anomalies.append(f"Giderlerde %{int(exp_rise*100)} oranında olağandışı artış.")
                    label = _escalate(label, "red")
                elif exp_rise > THRESH_EXPENSE_RISE_YELLOW:
                    anomalies.append(f"Gider kalemlerinde %{int(exp_rise*100)} artış riski.")
                    label = _escalate(label, "yellow")

            # Gider/Gelir Oranı (Operasyonel Verimlilik)
            if last_inc > 0 and (last_exp / last_inc) > 0.9:
                anomalies.append("Giderlerin gelire oranı %90'ın üzerine çıktı; operasyonel verimlilik düşük.")
                label = _escalate(label, "yellow")

        # 2. Tahmini Nakit Akışı Kontrolü
        consecutive_neg = 0
        for row in forecast:
            consecutive_neg = consecutive_neg + 1 if row["net"] < 0 else 0
            if consecutive_neg >= 2:
                anomalies.append("Önümüzdeki dönemde 2 ay üst üste negatif nakit akışı riski.")
                label = _escalate(label, "red")
                break

        if tenant_context is not None:
            monthly = tenant_context.monthly_totals()
            if monthly:
                last = monthly[-1]
                if (last["bank_credit"] - last["bank_debit"]) < 0:
                    anomalies.append("Son dönemde banka nakit hareketleri net negatif.")
                    label = _escalate(label, "yellow")
            failed_pos = [t for t in tenant_context.pos_transactions if t.status == "failed"]
            if len(failed_pos) >= 3:
                anomalies.append(f"POS tarafında {len(failed_pos)} başarısız işlem var; tahsilat kaybı riski oluşabilir.")
                label = _escalate(label, "yellow")
            overdue_tax = [t for t in tenant_context.tax_calendar_items if t.status == "overdue"]
            if overdue_tax:
                anomalies.append(f"{len(overdue_tax)} vergi takvimi kalemi gecikmiş görünüyor.")
                label = _escalate(label, "red")
            upcoming_tax = [t for t in tenant_context.tax_calendar_items if t.status == "pending"]
            if upcoming_tax:
                anomalies.append(f"{len(upcoming_tax)} bekleyen vergi/SGK takvim kalemi takip edilmeli.")
                label = _escalate(label, "yellow")

        score = {"green": 5, "yellow": 3, "red": 1}[label]
        
        # Profesyonel özet oluşturma
        if not anomalies:
            explanation = "Mali yapınız sağlıklı görünüyor. Belirgin bir risk faktörü tespit edilmedi."
        else:
            explanation = "Finansal sağlığınız için şu noktalara dikkat etmelisiniz: " + " ".join(anomalies)

        drivers = anomalies[:3]
        priority = _priority_for_label(label)
        time_horizon = _time_horizon_for_label(label, anomalies)
        actions = _derive_actions(anomalies, label=label)

        return {
            "risk_score": score,
            "risk_label": label,
            "explanation": explanation,
            "anomalies": anomalies,
            "risk_key_drivers": drivers,
            "risk_recommended_actions": actions,
            "risk_priority": priority,
            "risk_time_horizon": time_horizon,
        }

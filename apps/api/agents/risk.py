"""Risk değerlendirme — sabit eşikler, Türkçe açıklama."""
from schemas.invoice import InvoiceData
from services.tenant_context import TenantAnalysisContext


THRESH_INCOME_DROP_YELLOW = 0.20
THRESH_INCOME_DROP_RED = 0.40
THRESH_EXPENSE_RISE_YELLOW = 0.30
THRESH_EXPENSE_RISE_RED = 0.50
_RANK = {"green": 0, "yellow": 1, "red": 2}


def _escalate(current: str, new: str) -> str:
    return new if _RANK[new] > _RANK[current] else current


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
            avg_prev_inc = sum(by_month[k]["income"] for k in prev_keys) / len(prev_keys) or 1
            avg_prev_exp = sum(by_month[k]["expense"] for k in prev_keys) / len(prev_keys) or 1
            
            last_inc = by_month[last_key]["income"]
            last_exp = by_month[last_key]["expense"]

            # Gelir düşüşü kontrolü
            inc_drop = max(0, (avg_prev_inc - last_inc) / avg_prev_inc)
            if inc_drop > THRESH_INCOME_DROP_RED:
                anomalies.append(f"Gelirde geçmiş ortalamaya göre %{int(inc_drop*100)} oranında kritik düşüş.")
                label = _escalate(label, "red")
            elif inc_drop > THRESH_INCOME_DROP_YELLOW:
                anomalies.append(f"Gelirde %{int(inc_drop*100)} oranında daralma gözlemlendi.")
                label = _escalate(label, "yellow")

            # Gider artışı kontrolü
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

        return {
            "risk_score": score,
            "risk_label": label,
            "explanation": explanation,
            "anomalies": anomalies,
        }

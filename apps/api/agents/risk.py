"""Risk değerlendirme — sabit eşikler, Türkçe açıklama."""
from schemas.invoice import InvoiceData


THRESH_INCOME_DROP_YELLOW = 0.20
THRESH_INCOME_DROP_RED = 0.40
THRESH_EXPENSE_RISE_YELLOW = 0.30
THRESH_EXPENSE_RISE_RED = 0.50
_RANK = {"green": 0, "yellow": 1, "red": 2}


def _escalate(current: str, new: str) -> str:
    return new if _RANK[new] > _RANK[current] else current


class RiskAgent:
    async def assess(self, invoices: list[InvoiceData], forecast: list[dict]) -> dict:
        anomalies: list[str] = []
        label = "green"

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
            first_inc = by_month[keys[0]]["income"] or 1
            last_inc = by_month[keys[-1]]["income"]
            inc_drop = max(0, (first_inc - last_inc) / first_inc)
            if inc_drop > THRESH_INCOME_DROP_RED:
                anomalies.append(f"Gelir %{int(inc_drop*100)} düştü.")
                label = _escalate(label, "red")
            elif inc_drop > THRESH_INCOME_DROP_YELLOW:
                anomalies.append(f"Gelir %{int(inc_drop*100)} düştü.")
                label = _escalate(label, "yellow")

            first_exp = by_month[keys[0]]["expense"] or 1
            last_exp = by_month[keys[-1]]["expense"]
            exp_rise = max(0, (last_exp - first_exp) / first_exp)
            if exp_rise > THRESH_EXPENSE_RISE_RED:
                anomalies.append(f"Gider %{int(exp_rise*100)} arttı.")
                label = _escalate(label, "red")
            elif exp_rise > THRESH_EXPENSE_RISE_YELLOW:
                anomalies.append(f"Gider %{int(exp_rise*100)} arttı.")
                label = _escalate(label, "yellow")

        consecutive_neg = 0
        for row in forecast:
            consecutive_neg = consecutive_neg + 1 if row["net"] < 0 else 0
            if consecutive_neg >= 2:
                anomalies.append("İki ay üst üste negatif nakit akışı bekleniyor.")
                label = _escalate(label, "red")
                break

        score = {"green": 5, "yellow": 3, "red": 1}[label]
        explanation = (
            "Mali tablo dengeli, ciddi bir uyarı tespit edilmedi."
            if not anomalies else "Dikkat edilmesi gereken sinyaller: " + " ".join(anomalies)
        )
        return {
            "risk_score": score, "risk_label": label,
            "explanation": explanation, "anomalies": anomalies,
        }

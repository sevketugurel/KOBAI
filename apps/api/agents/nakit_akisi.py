"""Nakit akışı ajanı — 3 dönem hareketli ortalama + KDV/SGK takvimi."""
from datetime import date
from statistics import mean
from schemas.invoice import InvoiceData


SGK_RATE = 0.225
KDV_QUARTER_MONTHS = {3, 6, 9, 12}
SEASONAL_LOOKBACK = 6
SEASONAL_FORECAST_HORIZON = 3
SEASONAL_DAMPING = 0.35
SEASONAL_MIN_FACTOR = 0.9
SEASONAL_MAX_FACTOR = 1.1


def _group_by_month(invoices: list[InvoiceData]) -> dict[str, dict[str, float]]:
    by_month: dict[str, dict[str, float]] = {}
    for inv in invoices:
        key = inv.date.strftime("%Y-%m")
        bucket = by_month.setdefault(key, {"income": 0.0, "expense": 0.0, "kdv_collected": 0.0, "kdv_paid": 0.0})
        if inv.category == "gelir":
            bucket["income"] += inv.total_amount
            bucket["kdv_collected"] += inv.kdv_amount
        else:
            bucket["expense"] += inv.total_amount
            bucket["kdv_paid"] += inv.kdv_amount
    return by_month


def _clamp(value: float, lower: float, upper: float) -> float:
    return max(lower, min(upper, value))


def _seasonal_factors(
    series: list[float],
    *,
    base_window: int = 3,
    lookback: int = SEASONAL_LOOKBACK,
    forecast_periods: int = SEASONAL_FORECAST_HORIZON,
) -> list[float]:
    if not series:
        return [1.0] * forecast_periods

    recent = series[-base_window:]
    base = mean(recent) if recent else 0.0
    if base <= 0:
        return [1.0] * forecast_periods

    history = series[-lookback:]
    pattern = history[-min(len(history), forecast_periods):]
    if not pattern:
        return [1.0] * forecast_periods

    factors: list[float] = []
    for idx in range(forecast_periods):
        raw_ratio = pattern[idx % len(pattern)] / base
        damped = 1.0 + (raw_ratio - 1.0) * SEASONAL_DAMPING
        factors.append(round(_clamp(damped, SEASONAL_MIN_FACTOR, SEASONAL_MAX_FACTOR), 4))
    return factors


class NakitAkisiAgent:
    async def forecast(
        self,
        invoices: list[InvoiceData],
        *,
        start_year: int | None = None,
        start_month: int | None = None,
    ) -> list[dict]:
        if not invoices:
            return []
        by_month = _group_by_month(invoices)
        sorted_keys = sorted(by_month.keys())
        last = date.fromisoformat(sorted_keys[-1] + "-01")
        if start_year is None:
            start_year = last.year + (1 if last.month == 12 else 0)
        if start_month is None:
            start_month = 1 if last.month == 12 else last.month + 1

        recent_incomes = [by_month[k]["income"] for k in sorted_keys[-3:]]
        recent_expenses = [by_month[k]["expense"] for k in sorted_keys[-3:]]
        avg_income = mean(recent_incomes) if recent_incomes else 0
        avg_expense = mean(recent_expenses) if recent_expenses else 0
        income_series = [by_month[k]["income"] for k in sorted_keys]
        expense_series = [by_month[k]["expense"] for k in sorted_keys]
        income_factors = _seasonal_factors(income_series)
        expense_factors = _seasonal_factors(expense_series)

        kdv_balance_accumulator = 0.0
        cumulative = 0.0
        rows: list[dict] = []
        for i in range(3):
            month = ((start_month - 1 + i) % 12) + 1
            year = start_year + (start_month - 1 + i) // 12
            adjusted_income = round(avg_income * income_factors[i], 2)
            adjusted_expense = round(avg_expense * expense_factors[i], 2)
            kdv_balance_accumulator += (adjusted_income / 1.2 * 0.2) - (adjusted_expense / 1.2 * 0.2)
            kdv_payment = max(kdv_balance_accumulator, 0.0) if month in KDV_QUARTER_MONTHS else 0.0
            if month in KDV_QUARTER_MONTHS:
                kdv_balance_accumulator = 0.0
            sgk_payment = round(adjusted_expense * SGK_RATE * 0.1, 2)
            net = adjusted_income - adjusted_expense - kdv_payment - sgk_payment
            cumulative += net
            rows.append({
                "month": f"{year:04d}-{month:02d}",
                "income": adjusted_income,
                "expense": adjusted_expense,
                "net": round(net, 2),
                "kdv_payment": round(kdv_payment, 2),
                "sgk_payment": sgk_payment,
                "cumulative": round(cumulative, 2),
            })
        return rows

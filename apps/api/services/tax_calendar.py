"""12-aylık vergi takvimi seed kuralları.

Türkiye vergi takvimi (KOBİ MVP). Kurallar kabaca:

KDV (aylık)        — her ayın 28'inde önceki ay için
Muhtasar           — şahıs: 3 aylık (Şubat/Mayıs/Ağustos/Kasım 26'sı)
                     ltd_sti/as: aylık ayın 26'sı
Geçici Vergi       — 3 aylık (17 Şubat / 17 Mayıs / 17 Ağustos / 17 Kasım)
SGK (işveren)      — aylık ayın 23'ü
Gelir Vergisi      — yıllık 31 Mart (şahıs)
Kurumlar Vergisi   — yıllık 30 Nisan (ltd_sti / as)

Kurallar yıllara göre değişebilir; bu modül sabit yaklaşık tarihleri seed eder.
Doğru tarihleri Gelir İdaresi yayınladıkça config-driven hale getirilebilir.
"""

from __future__ import annotations

import calendar
from dataclasses import dataclass
from datetime import date

from schemas.tax import TaxCalendarItemCreate, TaxType

CompanyType = str  # "sahis_sirketi" | "ltd_sti" | "as"


def _safe_day(year: int, month: int, day: int) -> date:
    """Ay sonu güvenli: 31 Şubat → 28/29 Şubat."""
    last = calendar.monthrange(year, month)[1]
    return date(year, month, min(day, last))


def _add_month(d: date) -> date:
    if d.month == 12:
        return d.replace(year=d.year + 1, month=1)
    return _safe_day(d.year, d.month + 1, d.day)


def _period_label(year: int, month: int) -> str:
    return f"{year:04d}-{month:02d}"


@dataclass(frozen=True)
class _Spec:
    tax_type: TaxType
    title_tr: str


def _kdv_items(start: date) -> list[TaxCalendarItemCreate]:
    """KDV: her ay 28'i, önceki ay için. start = ilk takip ayı (önceki ay)."""
    items: list[TaxCalendarItemCreate] = []
    cur = start
    for _ in range(12):
        due = _safe_day(cur.year, cur.month, 28)
        # Beyan edilen dönem = önceki ay
        prev = cur.replace(day=1)
        if prev.month == 1:
            prev = prev.replace(year=prev.year - 1, month=12)
        else:
            prev = prev.replace(month=prev.month - 1)
        items.append(TaxCalendarItemCreate(
            title=f"{prev.strftime('%Y-%m')} KDV Beyanı",
            description="Önceki ay KDV beyannamesi son gün",
            tax_type="kdv",
            due_date=due,
            period=_period_label(prev.year, prev.month),
        ))
        cur = _add_month(cur)
    return items


def _muhtasar_items(start: date, *, monthly: bool) -> list[TaxCalendarItemCreate]:
    """Muhtasar: aylık (ltd/as) veya 3 aylık (şahıs)."""
    items: list[TaxCalendarItemCreate] = []
    cur = start
    months = 12
    for i in range(months):
        if monthly or cur.month in (2, 5, 8, 11):
            due = _safe_day(cur.year, cur.month, 26)
            items.append(TaxCalendarItemCreate(
                title=f"{cur.strftime('%Y-%m')} Muhtasar Beyanı",
                description=("Aylık muhtasar" if monthly else "Üç aylık muhtasar"),
                tax_type="muhtasar",
                due_date=due,
                period=_period_label(cur.year, cur.month),
            ))
        cur = _add_month(cur)
    return items


def _gecici_vergi_items(start: date) -> list[TaxCalendarItemCreate]:
    """3 aylık geçici vergi: 17 Şubat / 17 Mayıs / 17 Ağustos / 17 Kasım."""
    items: list[TaxCalendarItemCreate] = []
    months = [(2, 17), (5, 17), (8, 17), (11, 17)]
    year = start.year
    for _ in range(2):  # 2 yıl × 4 = 8 kalem, 12 ay penceresine fazlasıyla yeter
        for m, d in months:
            due = _safe_day(year, m, d)
            if due < start:
                continue
            items.append(TaxCalendarItemCreate(
                title=f"{year} Q{((m - 1) // 3) + 1} Geçici Vergi",
                description="Üç aylık geçici vergi beyannamesi",
                tax_type="gecici_vergi",
                due_date=due,
                period=f"{year}-Q{((m - 1) // 3) + 1}",
            ))
        year += 1
    return items[:6]  # MVP: 12 aya 6 dönem yeter


def _sgk_items(start: date) -> list[TaxCalendarItemCreate]:
    """SGK işveren primi: her ayın 23'ünde."""
    items: list[TaxCalendarItemCreate] = []
    cur = start
    for _ in range(12):
        due = _safe_day(cur.year, cur.month, 23)
        prev = cur.replace(day=1)
        if prev.month == 1:
            prev = prev.replace(year=prev.year - 1, month=12)
        else:
            prev = prev.replace(month=prev.month - 1)
        items.append(TaxCalendarItemCreate(
            title=f"{prev.strftime('%Y-%m')} SGK Primi",
            description="İşveren SGK primi son ödeme",
            tax_type="sgk",
            due_date=due,
            period=_period_label(prev.year, prev.month),
        ))
        cur = _add_month(cur)
    return items


def _annual_items(start: date, *, company_type: CompanyType) -> list[TaxCalendarItemCreate]:
    """Yıllık vergi: şahıs = 31 Mart Gelir Vergisi; ltd/as = 30 Nisan Kurumlar."""
    items: list[TaxCalendarItemCreate] = []
    for year in (start.year, start.year + 1):
        if company_type == "sahis_sirketi":
            due = _safe_day(year, 3, 31)
            if due >= start:
                items.append(TaxCalendarItemCreate(
                    title=f"{year - 1} Gelir Vergisi Beyannamesi",
                    description="Yıllık gelir vergisi son gün",
                    tax_type="gelir_vergisi",
                    due_date=due,
                    period=f"{year - 1}",
                ))
        else:  # ltd_sti, as
            due = _safe_day(year, 4, 30)
            if due >= start:
                items.append(TaxCalendarItemCreate(
                    title=f"{year - 1} Kurumlar Vergisi Beyannamesi",
                    description="Yıllık kurumlar vergisi son gün",
                    tax_type="kurumlar_vergisi",
                    due_date=due,
                    period=f"{year - 1}",
                ))
    return items[:2]


def build_initial_calendar(
    *, company_type: CompanyType, today: date | None = None,
) -> list[TaxCalendarItemCreate]:
    """Tenant kayıt anında çağrılır → 12 aylık takvim listesi.

    `today` parametresi test için inject edilir; default = sistem bugünü.
    """
    today = today or date.today()
    # KDV/SGK takip başlangıcı: bu ay (önceki ay beyan edilecek)
    start_month = today.replace(day=1)
    monthly_muhtasar = company_type in ("ltd_sti", "as")

    items: list[TaxCalendarItemCreate] = []
    items.extend(_kdv_items(start_month))
    items.extend(_muhtasar_items(start_month, monthly=monthly_muhtasar))
    items.extend(_gecici_vergi_items(today))
    items.extend(_sgk_items(start_month))
    items.extend(_annual_items(today, company_type=company_type))
    # Bugünden önce kalan kalemleri at
    return [i for i in items if i.due_date >= today]

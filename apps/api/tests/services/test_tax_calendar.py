"""Vergi takvimi seed kuralları (Faz 4)."""

from __future__ import annotations

from datetime import date

import pytest

from services.tax_calendar import build_initial_calendar


def _types(items) -> set[str]:
    return {i.tax_type for i in items}


def test_seed_returns_non_empty_for_sahis() -> None:
    items = build_initial_calendar(company_type="sahis_sirketi", today=date(2026, 5, 13))
    assert items
    # Şahıs: KDV + Muhtasar (3 aylık) + Geçici + SGK + Gelir Vergisi
    assert _types(items) >= {"kdv", "muhtasar", "gecici_vergi", "sgk", "gelir_vergisi"}
    assert "kurumlar_vergisi" not in _types(items)


def test_seed_returns_kurumlar_for_ltd() -> None:
    items = build_initial_calendar(company_type="ltd_sti", today=date(2026, 5, 13))
    types_ = _types(items)
    assert "kurumlar_vergisi" in types_
    assert "gelir_vergisi" not in types_


def test_seed_muhtasar_monthly_vs_quarterly() -> None:
    today = date(2026, 1, 1)
    sahis = build_initial_calendar(company_type="sahis_sirketi", today=today)
    ltd = build_initial_calendar(company_type="ltd_sti", today=today)

    sahis_muhtasar = [i for i in sahis if i.tax_type == "muhtasar"]
    ltd_muhtasar = [i for i in ltd if i.tax_type == "muhtasar"]
    # Şahıs: 12 aylık dilimde 4 muhtasar (Şubat/Mayıs/Ağustos/Kasım)
    assert 3 <= len(sahis_muhtasar) <= 4
    # Ltd: aylık → 12 muhtasar
    assert len(ltd_muhtasar) >= 11


def test_seed_all_dates_in_future() -> None:
    today = date(2026, 5, 13)
    items = build_initial_calendar(company_type="sahis_sirketi", today=today)
    assert all(i.due_date >= today for i in items)


def test_seed_kdv_monthly_count() -> None:
    items = build_initial_calendar(company_type="sahis_sirketi", today=date(2026, 1, 15))
    kdv = [i for i in items if i.tax_type == "kdv"]
    # 12 ay penceresinde 12 KDV beyanı
    assert len(kdv) == 12
    # KDV her zaman ayın 28'inde
    assert all(i.due_date.day == 28 for i in kdv)


def test_seed_period_format() -> None:
    items = build_initial_calendar(company_type="sahis_sirketi", today=date(2026, 5, 13))
    kdv = [i for i in items if i.tax_type == "kdv"]
    # period "YYYY-MM" formatında olmalı
    assert all(i.period and len(i.period) == 7 and i.period[4] == "-" for i in kdv)


def test_year_end_rollover() -> None:
    """Ocak ayında start → KDV'nin önceki dönemi geçen yıl Aralık olmalı."""
    items = build_initial_calendar(company_type="sahis_sirketi", today=date(2026, 1, 5))
    kdv = sorted([i for i in items if i.tax_type == "kdv"], key=lambda i: i.due_date)
    assert kdv[0].period == "2025-12"

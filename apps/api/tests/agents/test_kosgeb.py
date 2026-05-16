from typing import get_args

import pytest

from agents.kosgeb import suggest_kosgeb
from schemas.tenant import Sector

_SECTOR_VALUES: list[str] = list(get_args(Sector))


def test_suggests_gida_grant_for_gida_sector():
    out = suggest_kosgeb(sector="Gıda & İçecek", company_type="Şahıs Şirketi")
    titles = [s["title"] for s in out]
    assert any("KOBİGEL" in t or "Gıda" in t for t in titles)


def test_returns_list():
    assert isinstance(suggest_kosgeb(sector="Hizmet", company_type="Limited Şirketi"), list)


@pytest.mark.parametrize("sector", _SECTOR_VALUES)
def test_every_enum_sector_has_at_least_one_suggestion(sector: str) -> None:
    # Sector enum string'leri (gida_perakende, imalat, hizmet, …) doğrudan
    # _RULES.sector ile eşleşmez; normalization olmazsa boş liste döner.
    out = suggest_kosgeb(sector=sector, company_type="Şahıs Şirketi")
    assert len(out) >= 1, f"sector={sector} için KOSGEB önerisi boş"


def test_gida_perakende_maps_to_gida_rule():
    out = suggest_kosgeb(sector="gida_perakende", company_type="Şahıs Şirketi")
    titles = [s["title"] for s in out]
    assert any("Gıda" in t for t in titles)

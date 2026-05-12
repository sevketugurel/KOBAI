from agents.kosgeb import suggest_kosgeb


def test_suggests_gida_grant_for_gida_sector():
    out = suggest_kosgeb(sector="Gıda & İçecek", company_type="Şahıs Şirketi")
    titles = [s["title"] for s in out]
    assert any("KOBİGEL" in t or "Gıda" in t for t in titles)


def test_returns_list():
    assert isinstance(suggest_kosgeb(sector="Hizmet", company_type="Limited Şirketi"), list)

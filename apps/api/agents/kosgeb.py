"""KOSGEB destek önerileri — sektör/şirket tipine göre statik kural seti."""

_RULES = [
    {"sector": "Gıda & İçecek", "title": "KOSGEB KOBİGEL — Gıda İmalatı Destek Programı",
     "detail": "Gıda işletmeleri için makine modernizasyonu desteği.", "url": "https://www.kosgeb.gov.tr"},
    {"sector": "Perakende", "title": "KOSGEB Girişimcilik Destek Programı",
     "detail": "Yeni açılan perakende işletmeleri için hibe + faizsiz kredi.", "url": "https://www.kosgeb.gov.tr"},
    {"sector": "Hizmet", "title": "KOSGEB AR-GE ve İnovasyon Desteği",
     "detail": "Dijital dönüşüm projeleri için %75'e varan destek.", "url": "https://www.kosgeb.gov.tr"},
    {"sector": "İmalat", "title": "KOSGEB Stratejik Ürün Destek Programı",
     "detail": "İmalat sanayinde yerli üretim teşviki.", "url": "https://www.kosgeb.gov.tr"},
]


def suggest_kosgeb(*, sector: str, company_type: str) -> list[dict]:
    return [{"title": r["title"], "detail": r["detail"], "url": r["url"]} for r in _RULES if r["sector"] == sector]

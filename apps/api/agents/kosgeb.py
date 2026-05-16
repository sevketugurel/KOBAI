"""KOSGEB destek önerileri — sektör/şirket tipi ve tenant sinyallerine göre."""

from services.tenant_context import TenantAnalysisContext

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

# schemas.tenant.Sector enum string → _RULES.sector label.
# Why: enum is snake_case for DB, rules are Title Case Turkish — without normalization
# `r["sector"] == sector` never matches and KOSGEB suggestions stay empty.
_SECTOR_TO_KOSGEB: dict[str, str] = {
    "gida_perakende": "Gıda & İçecek",
    "perakende": "Perakende",
    "hizmet": "Hizmet",
    "imalat": "İmalat",
    "insaat": "İmalat",
    "tarim": "Gıda & İçecek",
    "diger": "Hizmet",
}


def suggest_kosgeb(
    *,
    sector: str,
    company_type: str,
    tenant_context: TenantAnalysisContext | None = None,
) -> list[dict]:
    sector = _SECTOR_TO_KOSGEB.get(sector, sector)
    summary = tenant_context.summary_dict() if tenant_context is not None else {}
    scale_note = ""
    if summary:
        revenue = float(summary.get("invoice_income_total", 0)) + float(summary.get("pos_success_sales_total", 0))
        bank_net = float(summary.get("bank_net_total", 0))
        scale_note = (
            f" Dönem sinyali: gelir/POS ölçeği yaklaşık {revenue:,.0f} TL, "
            f"banka net akışı {bank_net:,.0f} TL."
        )
    return [
        {
            "title": r["title"],
            "detail": f"{r['detail']}{scale_note}",
            "url": r["url"],
        }
        for r in _RULES
        if r["sector"] == sector
    ]

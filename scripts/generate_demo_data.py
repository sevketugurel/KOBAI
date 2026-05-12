"""Ahmet Usta Fırını — 6 aylık demo fatura seti.

JSON + ReportLab ile basit PDF olarak data/demo/ahmet_usta_firini/ altına yazar.
Kasım ayında negatif nakit akışı yapılır (Ramazan öncesi stok yüklemesi).
"""
import json
from pathlib import Path
from io import BytesIO

from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4

OUT = Path(__file__).resolve().parents[1] / "data" / "demo" / "ahmet_usta_firini"
OUT.mkdir(parents=True, exist_ok=True)

MONTHS = [(2025, 6), (2025, 7), (2025, 8), (2025, 9), (2025, 10), (2025, 11)]


def build_month(year: int, month: int) -> list[dict]:
    is_summer = month in (6, 7, 8)
    is_winter = month in (11, 12, 1, 2)
    drinks = 12000 * (1.20 if is_summer else 1.0)
    bread = 35000 * (0.85 if month == 11 else 1.0)
    heating = 8000 * (1.15 if is_winter else 0.3)
    flour_purchase = 25000 * (2.0 if month == 11 else 1.0)
    rows = [
        {"invoice_id": f"sale-{year}{month:02d}-drinks", "vendor_name": "Ahmet Usta Fırını",
         "vendor_tax_no": "1234567890", "date": f"{year}-{month:02d}-15", "due_date": None,
         "items": [{"description":"İçecek satışları","quantity":1,"unit_price": drinks/1.2,"total": drinks/1.2,"kdv_rate":20}],
         "subtotal": drinks/1.2, "kdv_amount": drinks - drinks/1.2, "total_amount": drinks,
         "currency":"TRY","category":"gelir","raw_text":None},
        {"invoice_id": f"sale-{year}{month:02d}-bread", "vendor_name": "Ahmet Usta Fırını",
         "vendor_tax_no": "1234567890", "date": f"{year}-{month:02d}-20", "due_date": None,
         "items":[{"description":"Ekmek satışları","quantity":1,"unit_price":bread/1.01,"total":bread/1.01,"kdv_rate":1}],
         "subtotal": bread/1.01, "kdv_amount": bread - bread/1.01, "total_amount": bread,
         "currency":"TRY","category":"gelir","raw_text":None},
        {"invoice_id": f"buy-{year}{month:02d}-flour", "vendor_name": "Un Tedarikçisi A.Ş.",
         "vendor_tax_no": "9876543210", "date": f"{year}-{month:02d}-05", "due_date": None,
         "items":[{"description":"Un alımı","quantity":1,"unit_price":flour_purchase/1.2,"total":flour_purchase/1.2,"kdv_rate":20}],
         "subtotal": flour_purchase/1.2, "kdv_amount": flour_purchase - flour_purchase/1.2, "total_amount": flour_purchase,
         "currency":"TRY","category":"gider","raw_text":None},
        {"invoice_id": f"buy-{year}{month:02d}-heating", "vendor_name": "Doğalgaz Dağıtım",
         "vendor_tax_no": "1112223334", "date": f"{year}-{month:02d}-10", "due_date": None,
         "items":[{"description":"Doğalgaz","quantity":1,"unit_price":heating/1.2,"total":heating/1.2,"kdv_rate":20}],
         "subtotal": heating/1.2, "kdv_amount": heating - heating/1.2, "total_amount": heating,
         "currency":"TRY","category":"gider","raw_text":None},
    ]
    return rows


def render_pdf(inv: dict) -> bytes:
    buf = BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    c.setFont("Helvetica-Bold", 16)
    c.drawString(50, 800, "FATURA")
    c.setFont("Helvetica", 10)
    c.drawString(50, 770, f"Satici: {inv['vendor_name']}")
    c.drawString(50, 755, f"VKN: {inv['vendor_tax_no']}")
    c.drawString(50, 740, f"Tarih: {inv['date']}")
    y = 700
    for it in inv["items"]:
        c.drawString(50, y, f"{it['description']} x{it['quantity']} = {it['total']:.2f} TL (KDV %{it['kdv_rate']})")
        y -= 15
    c.drawString(50, y - 20, f"Ara toplam: {inv['subtotal']:.2f} TL")
    c.drawString(50, y - 35, f"KDV: {inv['kdv_amount']:.2f} TL")
    c.drawString(50, y - 50, f"Genel toplam: {inv['total_amount']:.2f} TL")
    c.showPage()
    c.save()
    return buf.getvalue()


def main() -> None:
    all_invoices: list[dict] = []
    for year, month in MONTHS:
        for inv in build_month(year, month):
            all_invoices.append(inv)
            pdf_bytes = render_pdf(inv)
            (OUT / f"{inv['invoice_id']}.pdf").write_bytes(pdf_bytes)
    (OUT / "invoices.json").write_text(json.dumps(all_invoices, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Üretildi: {len(all_invoices)} fatura → {OUT}")


if __name__ == "__main__":
    main()

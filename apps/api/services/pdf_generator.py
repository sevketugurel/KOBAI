"""ReportLab — AnalysisResult → bytes PDF (Türkçe destekli)."""
import io
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak

from schemas.analysis import AnalysisResult

try:
    pdfmetrics.registerFont(TTFont("DejaVuSans", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"))
    FONT = "DejaVuSans"
except Exception:
    FONT = "Helvetica"


def _styles() -> dict:
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle("title", parent=base["Title"], fontName=FONT, fontSize=22),
        "h1": ParagraphStyle("h1", parent=base["Heading1"], fontName=FONT, fontSize=14),
        "body": ParagraphStyle("body", parent=base["BodyText"], fontName=FONT, fontSize=10),
    }


def _footer(canvas, doc) -> None:
    canvas.saveState()
    canvas.setFont(FONT, 8)
    canvas.drawRightString(20 * cm, 1.5 * cm, f"Sayfa {doc.page}")
    canvas.restoreState()


def build_analysis_pdf(analysis: AnalysisResult, *, company_name: str = "KOBİ") -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, title=f"{company_name} Analiz Raporu")
    s = _styles()
    story = []
    story += [Paragraph(f"{company_name}", s["title"]),
              Paragraph(analysis.created_at.strftime("%d.%m.%Y"), s["body"]),
              PageBreak()]
    story += [Paragraph("Yönetici Özeti", s["h1"])]
    kpi = [["Risk", analysis.risk_label.upper(), str(analysis.risk_score) + "/5"]]
    story += [Table(kpi, style=TableStyle([("FONTNAME", (0, 0), (-1, -1), FONT)])), Spacer(1, 12)]
    story += [Paragraph("Nakit Akışı Tahmini", s["h1"])]
    rows = [["Ay", "Gelir", "Gider", "Net"]] + [
        [r["month"], f"{r['income']:.0f}", f"{r['expense']:.0f}", f"{r['net']:.0f}"]
        for r in analysis.cash_flow_forecast
    ]
    story += [Table(rows, style=TableStyle([("FONTNAME", (0, 0), (-1, -1), FONT), ("GRID", (0, 0), (-1, -1), 0.25, (0, 0, 0))])), Spacer(1, 12)]
    story += [Paragraph("Vergi Önerileri", s["h1"])]
    for rec in analysis.tax_recommendations:
        story += [Paragraph(f"• {rec.get('recommendation', '')} <i>({rec.get('article', '')})</i>", s["body"])]
    story += [Spacer(1, 8), Paragraph("Risk Uyarıları", s["h1"]),
              Paragraph(analysis.risk_explanation, s["body"])]
    story += [Spacer(1, 8), Paragraph("KOSGEB Önerileri", s["h1"])]
    for k in analysis.kosgeb_suggestions:
        story += [Paragraph(f"• {k.get('title', '')} — {k.get('detail', '')}", s["body"])]

    doc.build(story, onFirstPage=_footer, onLaterPages=_footer)
    return buf.getvalue()

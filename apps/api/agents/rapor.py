"""Rapor ajanı — pdf_generator'a delege eder."""
from schemas.analysis import AnalysisResult
from services.pdf_generator import build_analysis_pdf


class RaporAgent:
    async def generate_pdf(self, analysis: AnalysisResult, *, company_name: str = "KOBİ") -> bytes:
        return build_analysis_pdf(analysis, company_name=company_name)

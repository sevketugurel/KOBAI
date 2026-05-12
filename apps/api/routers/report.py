"""GET /report/{job_id} — analiz tamamlanmışsa PDF indirir."""
from fastapi import APIRouter, HTTPException
from fastapi.responses import Response

from services.job_queue import queue
from agents.rapor import RaporAgent

router = APIRouter(tags=["report"])
_agent = RaporAgent()


@router.get("/report/{job_id}")
async def download_report(job_id: str) -> Response:
    try:
        job = await queue.get_job(job_id)
    except KeyError:
        raise HTTPException(status_code=404, detail="job yok")
    if job.status != "completed":
        raise HTTPException(status_code=409, detail=f"job henüz tamamlanmadı: {job.status}")
    pdf = await _agent.generate_pdf(job, company_name="KOBİ")
    return Response(
        content=pdf, media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="rapor-{job_id}.pdf"'},
    )

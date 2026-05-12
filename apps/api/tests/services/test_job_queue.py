"""In-memory job queue testleri."""
import pytest
from services.job_queue import JobQueue


@pytest.mark.asyncio
async def test_create_and_get_job():
    q = JobQueue()
    job_id = await q.create_job()
    job = await q.get_job(job_id)
    assert job.status == "pending"


@pytest.mark.asyncio
async def test_update_job_status():
    q = JobQueue()
    job_id = await q.create_job()
    await q.update_status(job_id, "processing")
    job = await q.get_job(job_id)
    assert job.status == "processing"


@pytest.mark.asyncio
async def test_get_unknown_raises():
    q = JobQueue()
    with pytest.raises(KeyError):
        await q.get_job("yok")

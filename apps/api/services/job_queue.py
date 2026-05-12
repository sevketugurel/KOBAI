"""In-memory job state — single replica MVP."""
import asyncio
import uuid
from datetime import datetime
from schemas.analysis import AnalysisResult


class JobQueue:
    def __init__(self) -> None:
        self._jobs: dict[str, AnalysisResult] = {}
        self._lock = asyncio.Lock()

    async def create_job(self) -> str:
        job_id = str(uuid.uuid4())
        async with self._lock:
            self._jobs[job_id] = AnalysisResult(
                job_id=job_id, status="pending", risk_score=1, risk_label="green",
                risk_explanation="Henüz analiz başlamadı.", created_at=datetime.utcnow(),
            )
        return job_id

    async def get_job(self, job_id: str) -> AnalysisResult:
        async with self._lock:
            if job_id not in self._jobs:
                raise KeyError(job_id)
            return self._jobs[job_id]

    async def update_status(self, job_id: str, status: str) -> None:
        async with self._lock:
            self._jobs[job_id] = self._jobs[job_id].model_copy(update={"status": status})

    async def set_result(self, job_id: str, result: AnalysisResult) -> None:
        async with self._lock:
            self._jobs[job_id] = result


queue = JobQueue()  # module-level singleton


from schemas.invoice import InvoiceData


class InvoiceStore:
    def __init__(self) -> None:
        self._d: dict[str, InvoiceData] = {}
        self._lock = asyncio.Lock()

    async def put(self, inv: InvoiceData) -> None:
        async with self._lock:
            self._d[inv.invoice_id] = inv

    async def get_many(self, ids: list[str]) -> list[InvoiceData]:
        async with self._lock:
            return [self._d[i] for i in ids if i in self._d]


invoices = InvoiceStore()

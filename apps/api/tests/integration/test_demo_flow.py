"""Faz 4 e2e: demo/load → poll → approve → PDF — tek tenant, fake repo + stubbed pipeline.

`@pytest.mark.integration` ile işaretli; varsayılan pytest run dışında tutulur.
Çalıştırmak için: `pytest -m integration tests/integration/test_demo_flow.py`.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

from main import app
from middleware.tenant import AuthPrincipal, require_auth
from repositories.job_repo import JobNotFound, get_job_repo
from repositories.tenant_repo import MembershipOut, TenantOut, get_tenant_repo
from routers.v2 import analyze as v2_analyze
from schemas.analysis import AgentStep, AnalysisResult


pytestmark = pytest.mark.integration


USER_ID = str(uuid.uuid4())
TENANT_ID = str(uuid.uuid4())


class _FakeJobRepo:
    def __init__(self) -> None:
        self.invoices: dict[str, dict] = {}
        self.jobs: dict[str, dict] = {}

    async def save_invoice(self, *, tenant_id, file_name, file_url, invoice, period=None):
        did = str(uuid.uuid4())
        self.invoices[did] = {"tenant_id": tenant_id, "invoice": invoice}
        return did

    async def get_invoices(self, *, tenant_id, document_ids):
        return [
            rec["invoice"]
            for did in document_ids
            if (rec := self.invoices.get(did)) and rec["tenant_id"] == tenant_id
        ]

    async def create_job(self, *, tenant_id, period, initial):
        self.jobs[initial.job_id] = {"tenant_id": tenant_id, "result": initial}
        return initial.job_id

    async def update_job_status(self, *, tenant_id, job_id, status):
        if (rec := self.jobs.get(job_id)) and rec["tenant_id"] == tenant_id:
            rec["result"] = rec["result"].model_copy(update={"status": status})

    async def set_job_result(self, *, tenant_id, job_id, result):
        if (rec := self.jobs.get(job_id)) and rec["tenant_id"] == tenant_id:
            rec["result"] = result

    async def get_job(self, *, tenant_id, job_id):
        rec = self.jobs.get(job_id)
        if not rec or rec["tenant_id"] != tenant_id:
            raise JobNotFound(job_id)
        return rec["result"]


class _FakeTenantRepo:
    def __init__(self) -> None:
        self._tenant = TenantOut(
            id=TENANT_ID, slug="kuzey-market", display_name="Kuzey Market",
            sector="gida_perakende", company_type="sahis_sirketi",
            tax_number=None, is_active=True,
            created_at=datetime.now(timezone.utc),
        )
        self._membership = MembershipOut(
            id=str(uuid.uuid4()), tenant_id=TENANT_ID, user_id=USER_ID,
            role="owner", created_at=datetime.now(timezone.utc),
        )

    async def get_by_slug(self, slug):
        return self._tenant if slug == "kuzey-market" else None

    async def get_membership(self, *, tenant_id, user_id):
        if tenant_id == TENANT_ID and user_id == USER_ID:
            return self._membership
        return None

    async def create_tenant_with_owner(self, *a, **k): ...
    async def update(self, *a, **k): ...
    async def list_for_user(self, *a, **k): return []
    async def list_members(self, *a, **k): return []


@pytest.fixture
def client(monkeypatch):
    job_repo = _FakeJobRepo()
    tenant_repo = _FakeTenantRepo()

    # Pipeline'ı stub'la — gerçek Gemini/ChromaDB'ye dokunma.
    async def fake_run(*, invoices, company_type, sector, period, job_id,
                       auto_approve=True, tenant_id=None, **_kw):
        return AnalysisResult(
            job_id=job_id, status="completed", invoices=invoices,
            cash_flow_forecast=[
                {"month": "2026-05", "income": 100000, "expense": 70000, "net": 30000},
            ],
            risk_score=3, risk_label="yellow", risk_explanation="stub",
            tax_recommendations=[{
                "recommendation": "KDV beyanı zamanında yap.",
                "source": "KDV", "article": "Md 41", "confidence": 4.2,
                "scope": "global", "action": "review",
            }],
            kosgeb_suggestions=[{
                "title": "KOSGEB KOBİGEL — Gıda İmalatı",
                "detail": "stub", "url": "https://www.kosgeb.gov.tr",
            }],
            agent_trace=[AgentStep(
                agent_name="nakit_akisi", action="forecast", status="completed",
                input={}, output={"summary": "stub"}, duration_ms=10, confidence=4.0,
            )],
            created_at=datetime.utcnow(), completed_at=datetime.utcnow(),
        )

    monkeypatch.setattr(v2_analyze, "run_pipeline", fake_run)

    app.dependency_overrides[require_auth] = lambda: AuthPrincipal(user_id=USER_ID, email="x@y")
    app.dependency_overrides[get_job_repo] = lambda: job_repo
    app.dependency_overrides[get_tenant_repo] = lambda: tenant_repo
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_demo_load_completes_and_pdf_gated_by_approve(client: TestClient) -> None:
    health = client.get("/health").json()
    assert health["status"] == "ok"

    loaded = client.post("/v2/kuzey-market/demo/load")
    assert loaded.status_code == 202, loaded.text
    payload = loaded.json()
    job_id = payload["job_id"]
    assert payload["invoice_count"] == 24
    assert len(payload["document_ids"]) == 24

    # BackgroundTasks senkron çalışır → pipeline tamamlanmış olmalı.
    got = client.get(f"/v2/kuzey-market/analyze/{job_id}").json()
    assert got["status"] == "completed"
    assert len(got["kosgeb_suggestions"]) >= 1
    assert any(rec.get("source") for rec in got["tax_recommendations"])

    # Approve şart — öncesinde rapor 403.
    blocked = client.get(f"/v2/kuzey-market/analyze/{job_id}/report")
    assert blocked.status_code == 403

    ok = client.post(f"/v2/kuzey-market/analyze/{job_id}/approve")
    assert ok.status_code == 200
    assert ok.json()["approved"] is True

    pdf = client.get(f"/v2/kuzey-market/analyze/{job_id}/report")
    assert pdf.status_code == 200
    assert pdf.headers["content-type"] == "application/pdf"
    assert pdf.content.startswith(b"%PDF")
    assert len(pdf.content) > 1024


def test_demo_load_rejects_non_demo_slug(client: TestClient, monkeypatch) -> None:
    # require_auth zaten override edilmiş; ama farklı slug için tenant repo None döndürmeli.
    # _FakeTenantRepo yalnız kuzey-market biliyor.
    r = client.post("/v2/baska-tenant/demo/load")
    assert r.status_code in (403, 404)


# ── Gerçek pipeline e2e — yalnız RAG/Gemini stub'lı ─────────────────────────


@pytest.fixture
def client_real_pipeline(monkeypatch):
    """run_pipeline stub'sız çalışır; sadece MevzuatRagAgent (Chroma/Gemini)
    stub'lanır. nakit_akisi, risk, kosgeb gerçekten koşar.
    """
    job_repo = _FakeJobRepo()
    tenant_repo = _FakeTenantRepo()

    from agents import orchestrator
    from unittest.mock import AsyncMock, MagicMock

    fake_rag = MagicMock()
    fake_rag.analyze = AsyncMock(return_value=[{
        "recommendation": "KDV beyanını ayın 26'sından önce hazırlayın.",
        "source": "KDV", "article": "KDV Md. 41", "confidence": 4.3,
        "scope": "global", "action": "review",
    }])
    monkeypatch.setattr(orchestrator, "MevzuatRagAgent", lambda **_kw: fake_rag)

    app.dependency_overrides[require_auth] = lambda: AuthPrincipal(user_id=USER_ID, email="x@y")
    app.dependency_overrides[get_job_repo] = lambda: job_repo
    app.dependency_overrides[get_tenant_repo] = lambda: tenant_repo
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_real_pipeline_demo_load_completes_with_eight_trace_steps(client_real_pipeline) -> None:
    """24 demo faturasıyla gerçek nakit/risk/kosgeb çalışır; 4 ajan × 2 adım = 8 trace."""
    loaded = client_real_pipeline.post("/v2/kuzey-market/demo/load")
    assert loaded.status_code == 202, loaded.text
    job_id = loaded.json()["job_id"]

    got = client_real_pipeline.get(f"/v2/kuzey-market/analyze/{job_id}").json()
    assert got["status"] == "completed", got.get("error")

    assert len(got["cash_flow_forecast"]) == 3
    assert got["risk_label"] in {"green", "yellow", "red"}
    assert got["risk_score"] in {1, 3, 5}
    assert len(got["kosgeb_suggestions"]) >= 1
    assert len(got["tax_recommendations"]) >= 1

    # 4 ajan × (running + completed) = 8 adım — partial-failure olmadığında.
    statuses = [s["status"] for s in got["agent_trace"]]
    assert statuses.count("running") == 4
    assert statuses.count("completed") == 4
    assert "failed" not in statuses

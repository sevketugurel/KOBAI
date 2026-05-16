"""v2 analyze router — fatura upload + pipeline + tenant izolasyonu."""

from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from unittest.mock import AsyncMock

import pytest
from fastapi.testclient import TestClient

from main import app
from middleware.tenant import AuthPrincipal, require_auth
from repositories.job_repo import JobNotFound, get_job_repo
from repositories.tenant_repo import MembershipOut, TenantOut, get_tenant_repo
from routers.v2 import analyze as v2_analyze
from schemas.analysis import AnalysisResult
from schemas.invoice import InvoiceData, InvoiceItem


# ── Fakes ─────────────────────────────────────────────────────────────


class FakeJobRepo:
    def __init__(self) -> None:
        self.invoices: dict[str, dict] = {}  # document_id → {tenant_id, invoice}
        self.jobs: dict[str, dict] = {}      # job_id → {tenant_id, result}

    async def save_invoice(self, *, tenant_id, file_name, file_url, invoice, period=None):
        did = str(uuid.uuid4())
        self.invoices[did] = {"tenant_id": tenant_id, "invoice": invoice}
        return did

    async def get_invoices(self, *, tenant_id, document_ids):
        out = []
        for did in document_ids:
            rec = self.invoices.get(did)
            if rec and rec["tenant_id"] == tenant_id:
                out.append(rec["invoice"])
        return out

    async def create_job(self, *, tenant_id, period, initial):
        self.jobs[initial.job_id] = {"tenant_id": tenant_id, "result": initial, "period": period}
        return initial.job_id

    async def update_job_status(self, *, tenant_id, job_id, status):
        rec = self.jobs.get(job_id)
        if rec and rec["tenant_id"] == tenant_id:
            rec["result"] = rec["result"].model_copy(update={"status": status})

    async def set_job_result(self, *, tenant_id, job_id, result):
        rec = self.jobs.get(job_id)
        if rec and rec["tenant_id"] == tenant_id:
            rec["result"] = result

    async def get_job(self, *, tenant_id, job_id):
        rec = self.jobs.get(job_id)
        if not rec or rec["tenant_id"] != tenant_id:
            raise JobNotFound(job_id)
        return rec["result"]


class FakeTenantRepoMin:
    def __init__(self, tenants, members):
        self._tenants = tenants
        self._members = members

    async def get_by_slug(self, slug):
        for t in self._tenants.values():
            if t.slug == slug:
                return t
        return None

    async def get_membership(self, *, tenant_id, user_id):
        for m in self._members:
            if m.tenant_id == tenant_id and m.user_id == user_id:
                return m
        return None

    async def create_tenant_with_owner(self, *a, **k): ...
    async def update(self, *a, **k): ...
    async def list_for_user(self, *a, **k): return []
    async def list_members(self, *a, **k): return []


# ── Fixtures ──────────────────────────────────────────────────────────


USER_A = str(uuid.uuid4())
USER_B = str(uuid.uuid4())
TENANT_A = str(uuid.uuid4())
TENANT_B = str(uuid.uuid4())


def _tenant(tid, slug):
    return TenantOut(
        id=tid, slug=slug, display_name=slug, sector="hizmet",
        company_type="sahis_sirketi", tax_number=None, is_active=True,
        created_at=datetime.now(timezone.utc),
    )


def _member(tid, uid):
    return MembershipOut(
        id=str(uuid.uuid4()), tenant_id=tid, user_id=uid, role="owner",
        created_at=datetime.now(timezone.utc),
    )


def _sample_invoice(idx: int = 1) -> InvoiceData:
    item = InvoiceItem(description="kalem", quantity=1, unit_price=1000, total=1000, kdv_rate=20)
    return InvoiceData(
        invoice_id=f"inv-{idx}", vendor_name="Tedarikçi", vendor_tax_no="NOT_MENTIONED",
        date=date(2026, 4, 15), due_date=None, items=[item],
        subtotal=1000, kdv_amount=200, total_amount=1200, currency="TRY",
        category="gider", raw_text=None,
    )


@pytest.fixture
def job_repo() -> FakeJobRepo:
    return FakeJobRepo()


@pytest.fixture
def tenant_repo() -> FakeTenantRepoMin:
    return FakeTenantRepoMin(
        tenants={TENANT_A: _tenant(TENANT_A, "acme-co"),
                 TENANT_B: _tenant(TENANT_B, "zeta-co")},
        members=[_member(TENANT_A, USER_A), _member(TENANT_B, USER_B)],
    )


@pytest.fixture
def mock_gemini(monkeypatch):
    fake = AsyncMock()
    fake.parse_invoice_pdf = AsyncMock(return_value=_sample_invoice())
    monkeypatch.setattr(v2_analyze, "_gemini", fake)
    return fake


@pytest.fixture
def mock_pipeline(monkeypatch):
    """run_pipeline'ı stub'la — orchestrator/Gemini'ye gerçekten gitmesin."""
    async def fake_run(*, invoices, company_type, sector, period, job_id, auto_approve, tenant_id):
        return AnalysisResult(
            job_id=job_id, status="completed", invoices=invoices,
            risk_score=2, risk_label="yellow", risk_explanation="stub",
            created_at=datetime.utcnow(), completed_at=datetime.utcnow(),
        )
    monkeypatch.setattr(v2_analyze, "run_pipeline", fake_run)
    return fake_run


@pytest.fixture
def client_for(job_repo, tenant_repo, mock_gemini):
    def _make(user_id: str) -> TestClient:
        app.dependency_overrides[require_auth] = lambda: AuthPrincipal(user_id=user_id, email="x@y")
        app.dependency_overrides[get_job_repo] = lambda: job_repo
        app.dependency_overrides[get_tenant_repo] = lambda: tenant_repo
        return TestClient(app)
    yield _make
    app.dependency_overrides.clear()


# ── Testler ───────────────────────────────────────────────────────────


def _pdf_file():
    return {"file": ("fatura.pdf", b"%PDF-1.4 fake", "application/pdf")}


def test_upload_invoice_happy_path(client_for, job_repo: FakeJobRepo) -> None:
    r = client_for(USER_A).post("/v2/acme-co/invoices", files=_pdf_file())
    assert r.status_code == 201, r.text
    body = r.json()
    assert "document_id" in body
    assert body["invoice"]["vendor_name"] == "Tedarikçi"
    assert len(job_repo.invoices) == 1
    # tenant izolasyonu — invoice TENANT_A altında kayıtlı
    rec = next(iter(job_repo.invoices.values()))
    assert rec["tenant_id"] == TENANT_A


def test_upload_non_pdf_rejected(client_for) -> None:
    r = client_for(USER_A).post(
        "/v2/acme-co/invoices",
        files={"file": ("x.txt", b"hello", "text/plain")},
    )
    assert r.status_code == 400


def test_analyze_starts_job_and_completes(client_for, job_repo, mock_pipeline) -> None:
    c = client_for(USER_A)
    up = c.post("/v2/acme-co/invoices", files=_pdf_file())
    document_id = up.json()["document_id"]
    r = c.post("/v2/acme-co/analyze", json={"document_ids": [document_id], "period": "2026-04"})
    assert r.status_code == 202, r.text
    job_id = r.json()["job_id"]
    # BackgroundTasks TestClient'ta senkron çalışır → tamamlanmış olmalı
    g = c.get(f"/v2/acme-co/analyze/{job_id}")
    assert g.status_code == 200
    body = g.json()
    assert body["status"] == "completed"
    assert body["risk_label"] == "yellow"


def test_analysis_report_returns_tenant_scoped_pdf(client_for, job_repo, mock_pipeline) -> None:
    c = client_for(USER_A)
    up = c.post("/v2/acme-co/invoices", files=_pdf_file())
    document_id = up.json()["document_id"]
    started = c.post("/v2/acme-co/analyze", json={"document_ids": [document_id], "period": "2026-04"})
    assert started.status_code == 202, started.text
    job_id = started.json()["job_id"]

    report = c.get(f"/v2/acme-co/analyze/{job_id}/report")
    assert report.status_code == 200, report.text
    assert report.headers["content-type"] == "application/pdf"
    assert report.content.startswith(b"%PDF")

    forbidden = client_for(USER_B).get(f"/v2/acme-co/analyze/{job_id}/report")
    assert forbidden.status_code == 403


def test_analyze_with_empty_doc_ids_starts_and_fails_without_tenant_data(client_for) -> None:
    r = client_for(USER_A).post("/v2/acme-co/analyze", json={"document_ids": []})
    assert r.status_code == 202
    job_id = r.json()["job_id"]
    g = client_for(USER_A).get(f"/v2/acme-co/analyze/{job_id}")
    assert g.status_code == 200
    body = g.json()
    assert body["status"] == "failed"
    assert body["error"] == "Analiz için tenant verisi bulunamadı."


def test_analyze_with_foreign_doc_ids_fails(client_for, job_repo, mock_pipeline) -> None:
    """B'nin fatura ID'si A için 'bulunamaz' → job failed (tenant izolasyonu)."""
    # B yükler
    up_b = client_for(USER_B).post("/v2/zeta-co/invoices", files=_pdf_file())
    foreign_id = up_b.json()["document_id"]
    # A bu ID ile analyze etmeye çalışır
    r = client_for(USER_A).post("/v2/acme-co/analyze", json={"document_ids": [foreign_id]})
    assert r.status_code == 202
    job_id = r.json()["job_id"]
    g = client_for(USER_A).get(f"/v2/acme-co/analyze/{job_id}")
    assert g.status_code == 200
    body = g.json()
    assert body["status"] == "failed"
    assert "fatura bulunamadı" in (body.get("error") or "")


def test_get_unknown_job_returns_404(client_for) -> None:
    r = client_for(USER_A).get(f"/v2/acme-co/analyze/{uuid.uuid4()}")
    assert r.status_code == 404


def test_cross_tenant_analyze_forbidden(client_for) -> None:
    r = client_for(USER_B).post("/v2/acme-co/analyze", json={"document_ids": [str(uuid.uuid4())]})
    assert r.status_code == 403

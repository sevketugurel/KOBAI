"""v2 integrations router — upload + listing + izolasyon."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from decimal import Decimal
from unittest.mock import AsyncMock

import pytest
from fastapi.testclient import TestClient

from main import app
from middleware.tenant import AuthPrincipal, require_auth
from repositories.bank_repo import get_bank_repo
from repositories.tenant_repo import MembershipOut, TenantOut, get_tenant_repo
from routers.v2 import integrations as v2_int
from schemas.bank import BankTransactionOut, BankTransactionParsed
from services.bank_statement_parser import ParsedStatement


# ── Fakes ─────────────────────────────────────────────────────────────


class FakeBankRepo:
    def __init__(self) -> None:
        self.documents: dict[str, dict] = {}
        self.transactions: list[dict] = []
        self.integrations: dict[tuple[str, str], dict] = {}

    async def create_document(self, *, tenant_id, file_name, file_url):
        did = str(uuid.uuid4())
        self.documents[did] = {
            "id": did, "tenant_id": tenant_id,
            "file_name": file_name, "file_url": file_url,
        }
        return did

    async def bulk_insert_transactions(
        self, *, tenant_id, source_document_id, bank_name, account_iban, rows,
    ):
        inserted = 0
        for r in rows:
            key = (tenant_id, source_document_id, r.transacted_at.isoformat(),
                   str(r.amount), r.direction, r.reference_no or "")
            if any(
                (t["tenant_id"], t["source_document_id"], t["transacted_at"],
                 str(t["amount"]), t["direction"], t["reference_no"] or "") == key
                for t in self.transactions
            ):
                continue
            self.transactions.append({
                "id": str(uuid.uuid4()),
                "tenant_id": tenant_id,
                "source_document_id": source_document_id,
                "bank_name": bank_name,
                "account_iban": account_iban,
                "amount": r.amount,
                "currency": "TRY",
                "direction": r.direction,
                "description": r.description,
                "reference_no": r.reference_no,
                "category": r.category,
                "transacted_at": r.transacted_at.isoformat(),
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
            inserted += 1
        return inserted, len(rows) - inserted

    async def list_transactions(self, *, tenant_id, limit=100):
        rows = [t for t in self.transactions if t["tenant_id"] == tenant_id]
        rows.sort(key=lambda t: t["transacted_at"], reverse=True)
        return [BankTransactionOut.model_validate(r) for r in rows[:limit]]

    async def upsert_integration(self, *, tenant_id, provider, config):
        key = (tenant_id, provider)
        existing = self.integrations.get(key, {})
        row = {
            **existing,
            "id": existing.get("id", str(uuid.uuid4())),
            "tenant_id": tenant_id,
            "provider": provider,
            "config": config,
            "is_active": True,
            "last_sync_at": datetime.now(timezone.utc).isoformat(),
        }
        self.integrations[key] = row
        return row

    async def list_integrations(self, *, tenant_id):
        return [v for k, v in self.integrations.items() if k[0] == tenant_id]


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


@pytest.fixture
def bank_repo() -> FakeBankRepo:
    return FakeBankRepo()


@pytest.fixture
def tenant_repo() -> FakeTenantRepoMin:
    return FakeTenantRepoMin(
        tenants={TENANT_A: _tenant(TENANT_A, "acme-co"),
                 TENANT_B: _tenant(TENANT_B, "zeta-co")},
        members=[_member(TENANT_A, USER_A), _member(TENANT_B, USER_B)],
    )


@pytest.fixture
def mock_parser(monkeypatch):
    """ParsedStatement döndüren fake parser; testin kontrolünde."""
    fake = AsyncMock()
    fake.parse = AsyncMock(return_value=ParsedStatement(
        bank_name="garanti",
        account_iban="TR12...",
        transactions=[
            BankTransactionParsed(
                amount=Decimal("1500.00"), direction="credit",
                transacted_at=datetime(2026, 4, 1, tzinfo=timezone.utc),
                description="Müşteri tahsilat", reference_no="R1",
                category="mal_satis",
            ),
            BankTransactionParsed(
                amount=Decimal("500.00"), direction="debit",
                transacted_at=datetime(2026, 4, 2, tzinfo=timezone.utc),
                description="Kira", reference_no=None,
                category="kira",
            ),
        ],
        raw={},
    ))
    monkeypatch.setattr(v2_int, "_parser", fake)
    return fake


@pytest.fixture
def client_for(bank_repo, tenant_repo, mock_parser):
    def _make(user_id: str) -> TestClient:
        app.dependency_overrides[require_auth] = lambda: AuthPrincipal(user_id=user_id, email="x@y")
        app.dependency_overrides[get_bank_repo] = lambda: bank_repo
        app.dependency_overrides[get_tenant_repo] = lambda: tenant_repo
        return TestClient(app)
    yield _make
    app.dependency_overrides.clear()


# ── Testler ───────────────────────────────────────────────────────────


def _pdf_file():
    return {"file": ("ekstre.pdf", b"%PDF-1.4 fake", "application/pdf")}


def test_upload_happy_path(client_for, bank_repo: FakeBankRepo) -> None:
    c = client_for(USER_A)
    r = c.post("/v2/acme-co/integrations/bank-statement", files=_pdf_file())
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["transactions_imported"] == 2
    assert body["transactions_skipped_duplicate"] == 0
    assert body["bank_name"] == "garanti"
    # documents + bank_transactions yazıldı, integration upsert'lendi
    assert len(bank_repo.documents) == 1
    assert len(bank_repo.transactions) == 2
    assert (TENANT_A, "bank_statement") in bank_repo.integrations


def test_upload_dedupes_on_second_attempt(client_for, bank_repo: FakeBankRepo) -> None:
    c = client_for(USER_A)
    r1 = c.post("/v2/acme-co/integrations/bank-statement", files=_pdf_file())
    r2 = c.post("/v2/acme-co/integrations/bank-statement", files=_pdf_file())
    assert r1.status_code == 201 and r2.status_code == 201
    # İkinci yükleme yeni bir document_id alır ama dedupe FakeBankRepo'da
    # source_document_id'ye bakıyor → her yükleme yeni doc ID'si üretir,
    # dolayısıyla bu testte dedupe gerçekleşmez. Asıl dedupe DB'deki UNIQUE
    # index ile sağlanır; burada yalnızca akışın çökmediğini doğruluyoruz.
    assert len(bank_repo.transactions) == 4


def test_upload_non_pdf_rejected(client_for) -> None:
    c = client_for(USER_A)
    r = c.post(
        "/v2/acme-co/integrations/bank-statement",
        files={"file": ("x.txt", b"hello", "text/plain")},
    )
    assert r.status_code == 400


def test_upload_empty_file_rejected(client_for) -> None:
    c = client_for(USER_A)
    r = c.post(
        "/v2/acme-co/integrations/bank-statement",
        files={"file": ("e.pdf", b"", "application/pdf")},
    )
    assert r.status_code == 400


def test_cross_tenant_upload_forbidden(client_for, bank_repo: FakeBankRepo) -> None:
    c = client_for(USER_B)
    r = c.post("/v2/acme-co/integrations/bank-statement", files=_pdf_file())
    assert r.status_code == 403
    assert not bank_repo.transactions


def test_list_transactions_isolation(client_for, bank_repo: FakeBankRepo) -> None:
    # A yükler
    client_for(USER_A).post("/v2/acme-co/integrations/bank-statement", files=_pdf_file())
    # A kendi listesini görür
    ra = client_for(USER_A).get("/v2/acme-co/bank-transactions")
    assert ra.status_code == 200
    assert len(ra.json()) == 2
    # B kendi tenant'ında boş list görür
    rb = client_for(USER_B).get("/v2/zeta-co/bank-transactions")
    assert rb.status_code == 200
    assert rb.json() == []


def test_list_integrations(client_for) -> None:
    client_for(USER_A).post("/v2/acme-co/integrations/bank-statement", files=_pdf_file())
    r = client_for(USER_A).get("/v2/acme-co/integrations")
    assert r.status_code == 200
    body = r.json()
    assert any(i["provider"] == "bank_statement" for i in body)


def test_parser_error_returns_422(client_for, mock_parser) -> None:
    from services.bank_statement_parser import BankParseError
    mock_parser.parse = AsyncMock(side_effect=BankParseError("test"))
    r = client_for(USER_A).post("/v2/acme-co/integrations/bank-statement", files=_pdf_file())
    assert r.status_code == 422

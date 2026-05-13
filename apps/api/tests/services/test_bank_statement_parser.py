"""bank_statement_parser unit'ları — Gemini mock'lanır."""

from __future__ import annotations

import json
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock

import pytest

from services.bank_statement_parser import (
    BankParseError,
    BankStatementParser,
    _coerce_decimal,
    categorize,
)


# ── kategorize ────────────────────────────────────────────────────────


@pytest.mark.parametrize(
    "desc, direction, expected",
    [
        ("KDV ödemesi", "debit", "vergi"),
        ("SGK primi", "debit", "sgk"),
        ("Personel maaş ödemesi", "debit", "personel"),
        ("Kira ödemesi", "debit", "kira"),
        ("Hammadde alımı", "debit", "hammadde"),
        ("Müşteri tahsilat", "credit", "mal_satis"),
        ("Hizmet ödemesi", "credit", "hizmet_satis"),
        ("Hizmet ödemesi", "debit", None),  # mal/hizmet sadece credit
        (None, "debit", None),
        ("", "debit", None),
        ("Bilinmeyen", "debit", None),
    ],
)
def test_categorize(desc: str | None, direction: str, expected) -> None:
    assert categorize(desc, direction=direction) == expected


# ── tutar normalizasyonu ──────────────────────────────────────────────


@pytest.mark.parametrize(
    "raw, expected",
    [
        ("1234.56", "1234.56"),
        ("1.234,56", "1234.56"),       # TR
        ("1,234.56", "1234.56"),       # US
        ("1234,56", "1234.56"),
        (1000, "1000.00"),
        (Decimal("99.99"), "99.99"),
    ],
)
def test_coerce_decimal(raw, expected: str) -> None:
    assert _coerce_decimal(raw) == Decimal(expected)


def test_coerce_decimal_invalid() -> None:
    with pytest.raises(BankParseError):
        _coerce_decimal("abc")


# ── parser ────────────────────────────────────────────────────────────


def _fake_gemini_response(payload: dict):
    resp = MagicMock()
    resp.text = json.dumps(payload)
    return resp


@pytest.fixture
def parser() -> BankStatementParser:
    model = MagicMock()
    model.generate_content_async = AsyncMock()
    return BankStatementParser(model=model)


@pytest.mark.asyncio
async def test_parse_happy_path(parser: BankStatementParser) -> None:
    parser._model.generate_content_async.return_value = _fake_gemini_response({
        "bank_name": "garanti",
        "account_iban": "TR330006100519786457841326",
        "transactions": [
            {"amount": "1500.00", "direction": "credit",
             "transacted_at": "2026-04-01T00:00:00",
             "description": "Müşteri tahsilat", "reference_no": "R1"},
            {"amount": "12.500,75", "direction": "debit",
             "transacted_at": "2026-04-02T00:00:00",
             "description": "Personel maaş", "reference_no": None},
        ],
    })
    out = await parser.parse(b"%PDF-fake")
    assert out.bank_name == "garanti"
    assert out.account_iban == "TR330006100519786457841326"
    assert len(out.transactions) == 2
    t0, t1 = out.transactions
    assert t0.amount == Decimal("1500.00") and t0.direction == "credit"
    assert t0.category == "mal_satis"  # description'dan tahsilat → mal_satis
    assert t1.amount == Decimal("12500.75") and t1.direction == "debit"
    assert t1.category == "personel"


@pytest.mark.asyncio
async def test_parse_invalid_row_skipped(parser: BankStatementParser) -> None:
    parser._model.generate_content_async.return_value = _fake_gemini_response({
        "bank_name": "diger",
        "transactions": [
            {"amount": "100.00", "direction": "credit",
             "transacted_at": "2026-04-01T00:00:00", "description": "ok"},
            {"amount": "kötü", "direction": "credit",
             "transacted_at": "2026-04-02T00:00:00", "description": "bad"},
            {"direction": "credit"},  # eksik alanlar
        ],
    })
    out = await parser.parse(b"%PDF-fake")
    assert len(out.transactions) == 1
    assert out.transactions[0].amount == Decimal("100.00")


@pytest.mark.asyncio
async def test_parse_empty_response(parser: BankStatementParser) -> None:
    resp = MagicMock()
    resp.text = ""
    parser._model.generate_content_async.return_value = resp
    with pytest.raises(BankParseError):
        await parser.parse(b"%PDF-fake")


@pytest.mark.asyncio
async def test_parse_invalid_json(parser: BankStatementParser) -> None:
    resp = MagicMock()
    resp.text = "not json {"
    parser._model.generate_content_async.return_value = resp
    with pytest.raises(BankParseError):
        await parser.parse(b"%PDF-fake")

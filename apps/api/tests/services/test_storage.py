"""SupabaseStorage wrapper — path düzeni, upload + signed URL davranışı."""

from __future__ import annotations

from datetime import datetime
from unittest.mock import MagicMock

import pytest

from services.storage import (
    StorageError,
    SupabaseStorage,
    build_object_path,
)


def test_build_object_path_includes_tenant_and_doctype_and_month() -> None:
    p = build_object_path(
        tenant_id="t1", doc_type="invoice", file_name="Fatura 2026.pdf",
        now=datetime(2026, 4, 15),
    )
    assert p.startswith("t1/invoice/2026-04/")
    assert p.endswith("-Fatura_2026.pdf")  # unsafe chars sanitize


def test_build_object_path_sanitizes_unsafe_filename() -> None:
    p = build_object_path(
        tenant_id="t1", doc_type="invoice", file_name="../etc/pa ss\twd.pdf",
        now=datetime(2026, 4, 1),
    )
    assert ".." not in p.split("/")[-1]  # path traversal yok
    assert " " not in p
    assert "\t" not in p


def _fake_client():
    """Supabase client'ın storage.from_(bucket) erişim zincirini taklit et."""
    client = MagicMock()
    bucket_handle = MagicMock()
    bucket_handle.upload = MagicMock(return_value={"path": "ok"})
    bucket_handle.create_signed_url = MagicMock(
        return_value={"signedURL": "https://example.invalid/signed?token=x"}
    )
    client.storage.from_ = MagicMock(return_value=bucket_handle)
    return client, bucket_handle


@pytest.mark.asyncio
async def test_upload_pdf_returns_supabase_url(monkeypatch) -> None:
    pytest.importorskip("pytest_asyncio", reason="asyncio plugin required")
    client, bucket_handle = _fake_client()
    s = SupabaseStorage(client, bucket="test-bucket")
    url = await s.upload_pdf(
        tenant_id="t1", doc_type="invoice", file_name="a.pdf", data=b"%PDF",
    )
    assert url.startswith("supabase://test-bucket/t1/invoice/")
    bucket_handle.upload.assert_called_once()
    args, _ = bucket_handle.upload.call_args
    assert args[0].startswith("t1/invoice/")
    assert args[1] == b"%PDF"


@pytest.mark.asyncio
async def test_signed_url_strips_supabase_prefix() -> None:
    pytest.importorskip("pytest_asyncio", reason="asyncio plugin required")
    client, bucket_handle = _fake_client()
    s = SupabaseStorage(client, bucket="test-bucket")
    url = await s.signed_url(
        path="supabase://test-bucket/t1/invoice/2026-04/abc-a.pdf",
        expires_in=120,
    )
    assert url == "https://example.invalid/signed?token=x"
    bucket_handle.create_signed_url.assert_called_once_with(
        "t1/invoice/2026-04/abc-a.pdf", 120,
    )


@pytest.mark.asyncio
async def test_upload_pdf_wraps_sdk_error() -> None:
    pytest.importorskip("pytest_asyncio", reason="asyncio plugin required")
    client, bucket_handle = _fake_client()
    bucket_handle.upload = MagicMock(side_effect=RuntimeError("403 forbidden"))
    s = SupabaseStorage(client, bucket="test-bucket")
    with pytest.raises(StorageError):
        await s.upload_pdf(tenant_id="t1", doc_type="invoice", file_name="a.pdf", data=b"")

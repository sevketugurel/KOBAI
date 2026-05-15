"""Supabase Storage wrapper — tenant-scoped PDF yükleme + signed URL.

Path düzeni::

    {tenant_id}/{doc_type}/{yyyy-mm}/{uuid}-{safe_filename}

Tenant izolasyonu path prefix'i ile sağlanır. Service-role client RLS'i bypass
eder; gerçek izolasyon yine repository katmanındaki explicit tenant_id filter
+ storage path prefix'i kontrolü ile yapılır.

Bucket (varsayılan: `tenant-documents`) önceden Supabase tarafında oluşturulmuş
olmalı (private, public=false). Yoksa 404 alırsınız.
"""

from __future__ import annotations

import logging
import re
import uuid
from datetime import datetime
from typing import Any, Protocol

from config import settings

log = logging.getLogger(__name__)

_SAFE_NAME_RE = re.compile(r"[^A-Za-z0-9._-]+")


def _safe_filename(name: str) -> str:
    """Dosya adını URL-güvenli hale getirir; uzunluk sınırı 80.

    `..` segmentlerini kollar (path traversal defense-in-depth); Supabase
    path separator '/' olduğundan dosya adında '..' fonksiyonel zarar
    vermez ama yine de temizliyoruz.
    """
    base = name.strip() or "file.pdf"
    cleaned = _SAFE_NAME_RE.sub("_", base)
    # Birden fazla noktayı tek noktaya indir ve baştaki noktayı at.
    while ".." in cleaned:
        cleaned = cleaned.replace("..", "_")
    cleaned = cleaned.lstrip(".") or "file.pdf"
    return cleaned[:80]


def build_object_path(
    *, tenant_id: str, doc_type: str, file_name: str, now: datetime | None = None,
) -> str:
    now = now or datetime.utcnow()
    return f"{tenant_id}/{doc_type}/{now:%Y-%m}/{uuid.uuid4()}-{_safe_filename(file_name)}"


class StorageError(RuntimeError):
    pass


class StorageService(Protocol):
    async def upload_pdf(
        self, *, tenant_id: str, doc_type: str, file_name: str, data: bytes,
    ) -> str: ...

    async def signed_url(self, *, path: str, expires_in: int | None = None) -> str: ...


class SupabaseStorage:
    """Supabase Storage SDK üzerinden bytes yükler ve signed URL üretir.

    SDK senkron çağrı yapar; FastAPI request loop'unu bloklamamak için
    `asyncio.to_thread` ile sarıyoruz.
    """

    def __init__(self, client, bucket: str | None = None) -> None:
        self._client = client
        self._bucket = bucket or settings.storage_bucket

    @property
    def bucket(self) -> str:
        return self._bucket

    async def upload_pdf(
        self, *, tenant_id: str, doc_type: str, file_name: str, data: bytes,
    ) -> str:
        import asyncio

        path = build_object_path(tenant_id=tenant_id, doc_type=doc_type, file_name=file_name)
        try:
            await asyncio.to_thread(
                self._client.storage.from_(self._bucket).upload,
                path,
                data,
                {"content-type": "application/pdf", "x-upsert": "false"},
            )
        except Exception as e:  # noqa: BLE001
            log.exception("storage upload failed tenant=%s path=%s", tenant_id, path)
            raise StorageError(f"yükleme başarısız: {e}") from e
        # file_url formatı: supabase://bucket/path — DB'de bu şekilde saklanır.
        return f"supabase://{self._bucket}/{path}"

    async def signed_url(self, *, path: str, expires_in: int | None = None) -> str:
        import asyncio

        # path "supabase://bucket/..." olabilir; normalize et.
        object_path = path
        prefix = f"supabase://{self._bucket}/"
        if object_path.startswith(prefix):
            object_path = object_path[len(prefix):]
        ttl = expires_in or settings.storage_signed_url_ttl
        try:
            res: Any = await asyncio.to_thread(
                self._client.storage.from_(self._bucket).create_signed_url,
                object_path,
                ttl,
            )
        except Exception as e:  # noqa: BLE001
            raise StorageError(f"signed URL üretilemedi: {e}") from e
        # SDK eski sürümlerde "signedURL", yenide "signedUrl" döndürebilir.
        url = (res or {}).get("signedURL") or (res or {}).get("signedUrl")
        if not url:
            raise StorageError(f"signed URL yanıtı beklenmedik: {res!r}")
        return url


_singleton: SupabaseStorage | None = None


def get_storage_service() -> StorageService:
    global _singleton
    if _singleton is None:
        from supabase_client import get_service_client
        _singleton = SupabaseStorage(get_service_client())
    return _singleton


def _reset_for_tests() -> None:
    global _singleton
    _singleton = None

"""Tenant-private RAG indexleme servisi."""

from __future__ import annotations

import logging

from rag.collections import tenant_docs_collection
from rag.indexer import RagIndexer
from services.tenant_context import TenantAnalysisContext, get_tenant_data_service

log = logging.getLogger(__name__)


class TenantRagIndexer:
    def __init__(self, indexer_factory=None) -> None:
        self._indexer_factory = indexer_factory or (
            lambda tenant_id: RagIndexer(collection_name=tenant_docs_collection(tenant_id))
        )

    async def index_context(self, context: TenantAnalysisContext) -> int:
        indexer = self._indexer_factory(context.tenant_id)
        total = 0
        for chunk in context.rag_chunks():
            metadata = dict(chunk["metadata"])
            metadata.setdefault("scope", "private")
            metadata.setdefault("tenant_id", context.tenant_id)
            total += await indexer.upsert_document(
                text=chunk["text"],
                metadata=metadata,
                document_id=chunk["id"],
            )
        log.info("tenant RAG index güncellendi tenant=%s chunks=%d", context.tenant_id, total)
        return total


_singleton: TenantRagIndexer | None = None


def get_tenant_rag_indexer() -> TenantRagIndexer:
    global _singleton
    if _singleton is None:
        _singleton = TenantRagIndexer()
    return _singleton


async def refresh_tenant_rag(
    *,
    tenant_id: str,
    period: str | None = None,
    tenant_profile: dict | None = None,
) -> int:
    context = await get_tenant_data_service().build_context(
        tenant_id=tenant_id,
        period=period,
        tenant_profile=tenant_profile,
    )
    return await get_tenant_rag_indexer().index_context(context)


def _reset_for_tests() -> None:
    global _singleton
    _singleton = None

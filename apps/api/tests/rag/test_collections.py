"""rag/collections.py isim sözleşmesi."""

import pytest

from rag.collections import global_mevzuat_collection, tenant_docs_collection


def test_global_uses_settings_default() -> None:
    # config default'u "kobi_mevzuat"
    assert global_mevzuat_collection() == "kobi_mevzuat"


def test_tenant_collection_strips_dashes() -> None:
    tid = "11111111-2222-3333-4444-555555555555"
    name = tenant_docs_collection(tid)
    assert name == "tenant_11111111222233334444555555555555_docs"
    # Chroma kuralı: 3-63 char, baş/son alfanumerik
    assert 3 <= len(name) <= 63
    assert name[0].isalnum() and name[-1].isalnum()


def test_tenant_collection_distinct_per_tenant() -> None:
    a = tenant_docs_collection("aaaa-1111")
    b = tenant_docs_collection("bbbb-2222")
    assert a != b


def test_empty_tenant_id_rejected() -> None:
    with pytest.raises(ValueError):
        tenant_docs_collection("")

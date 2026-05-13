"""ChromaDB koleksiyon isim sözleşmesi — v2 tenant-aware.

Mevcut tek-koleksiyon "kobi_mevzuat" GLOBAL olarak yorumlanır:
herkesin sorgulayabileceği KDV/GVK/SGK mevzuatı vb. burada index'lenir.

Tenant'a özel belgeler (örn. kendi sözleşmeleri, özel notlar) her tenant
için ayrı koleksiyona yazılır: `tenant_<tenant_id>_docs`.

Kural: query path'i her zaman ÖNCE tenant koleksiyonunu (varsa) +
GLOBAL koleksiyonu paralel sorgulayıp sonuçları skor-birleştirir.
"""

from __future__ import annotations

from config import settings


def global_mevzuat_collection() -> str:
    """Tüm tenant'ların paylaştığı genel mevzuat koleksiyonu."""
    return settings.chroma_collection


def tenant_docs_collection(tenant_id: str) -> str:
    """Tek tenant'a özel belge koleksiyonu.

    ChromaDB ad kuralı `^[a-z0-9][a-z0-9._-]{1,61}[a-z0-9]$`; UUID'lerdeki
    tireleri kaldırıyoruz ki başlangıç/bitiş karakter kuralına uyalım.
    """
    if not tenant_id:
        raise ValueError("tenant_id boş olamaz")
    safe = tenant_id.replace("-", "").lower()
    return f"tenant_{safe}_docs"

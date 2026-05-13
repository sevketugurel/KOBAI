"""data/rag/ klasöründeki belgeleri ChromaDB'ye yükler.

Kullanım: cd kobi-advisor && python scripts/seed_rag.py
"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "apps" / "api"))

from rag.citations import extract_article_nos  # noqa: E402
from rag.indexer import RagIndexer  # noqa: E402


async def main() -> None:
    indexer = RagIndexer()
    rag_dir = Path(__file__).resolve().parents[1] / "apps" / "api" / "data" / "rag"
    if not rag_dir.exists():
        print(f"Dizin yok: {rag_dir}")
        return
    files = sorted(rag_dir.glob("*.txt"))
    if not files:
        print(f"Belge bulunamadı: {rag_dir}")
        return
    for path in files:
        text = path.read_text(encoding="utf-8")
        article_nos = extract_article_nos(text)
        meta = {
            "source": path.name,
            "law_name": path.stem.split("_")[0].upper(),
            "article_no": ", ".join(article_nos) if article_nos else None,
            "date": "2026-01-01",
        }
        n = await indexer.index_document(text, meta)
        article_info = f" — Md. {meta['article_no']}" if meta["article_no"] else ""
        print(f"Yüklendi: {path.name} — {n} chunk{article_info}")


if __name__ == "__main__":
    asyncio.run(main())

"""Chunking saf-mantığını test eder."""
from rag.indexer import chunk_text


def test_chunk_text_respects_size_and_overlap():
    text = "kelime " * 600
    chunks = chunk_text(text, chunk_size=500, overlap=50)
    assert len(chunks) >= 2


def test_chunk_text_single_chunk_when_small():
    text = "kısa metin"
    assert chunk_text(text, chunk_size=500, overlap=50) == ["kısa metin"]


def test_chunk_text_empty_returns_empty():
    assert chunk_text("", chunk_size=500, overlap=50) == []

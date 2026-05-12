"""Settings yüklemeyi doğrular."""
import pytest


def test_settings_reads_env(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "k")
    monkeypatch.setenv("CHROMA_COLLECTION", "kobi_mevzuat")
    monkeypatch.setenv("GEMINI_VISION_MODEL", "gemini-2.5-flash")
    monkeypatch.setenv("GEMINI_EMBED_MODEL", "gemini-embedding-2")
    monkeypatch.setenv("GEMINI_EMBED_DIM", "1536")
    from config import Settings
    s = Settings()
    assert s.gemini_api_key == "k"
    assert s.chroma_collection == "kobi_mevzuat"
    assert s.gemini_vision_model == "gemini-2.5-flash"
    assert s.gemini_embed_dim == 1536
    assert s.max_pdf_size_mb == 10


def test_settings_rejects_forbidden_models(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "k")
    monkeypatch.setenv("GEMINI_VISION_MODEL", "gemini-1.5-flash")
    from config import Settings
    with pytest.raises(ValueError, match="yasak"):
        Settings()

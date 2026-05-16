"""Citation extraction and formatting helpers."""

from rag.citations import build_source_citation, extract_article_nos


def test_extract_article_nos_returns_unique_values_in_order():
    text = "Madde 28 oranları açıklar. Madde 41 beyan süresini belirtir. Md. 28 tekrar eder."

    assert extract_article_nos(text) == ["28", "41"]


def test_build_source_citation_formats_multi_article_metadata():
    metadata = {"law_name": "KDV", "article_no": "28, 41"}

    assert build_source_citation(metadata) == "KDV Md. 28, 41"


def test_build_source_citation_falls_back_to_non_blank_string():
    assert build_source_citation({}) == "Kaynak belirtilmedi"


def test_extract_article_nos_supports_new_rag_documents():
    text = (
        "Madde 94 stopajı açıklar. Madde 48 basit usul hadlerini belirler. "
        "Madde 29 indirim hakkını düzenler. Madde 32 oranları açıklar. "
        "Madde 81 SGK işveren indirimlerini düzenler. Md. 94 tekrar eder."
    )

    assert extract_article_nos(text) == ["94", "48", "29", "32", "81"]

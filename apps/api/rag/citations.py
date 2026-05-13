"""Citation extraction and formatting helpers for legal RAG."""

from __future__ import annotations

import re
from typing import Any

_ARTICLE_RE = re.compile(r"\b(?:madde|md\.?)\s*(\d+[A-Za-z]?)\b", re.IGNORECASE)
_WHITESPACE_RE = re.compile(r"\s+")


def normalize_article_no(article_no: Any) -> str | None:
    """Return a cleaned article number string or None."""
    if article_no is None:
        return None
    value = _WHITESPACE_RE.sub(" ", str(article_no)).strip()
    if not value:
        return None
    value = re.sub(r"^(?:madde|md\.?)\s*", "", value, flags=re.IGNORECASE)
    return value.strip() or None


def extract_article_nos(text: str) -> list[str]:
    """Extract unique article numbers in first-seen order."""
    seen: set[str] = set()
    articles: list[str] = []
    for match in _ARTICLE_RE.finditer(text):
        article_no = normalize_article_no(match.group(1))
        if article_no and article_no not in seen:
            seen.add(article_no)
            articles.append(article_no)
    return articles


def build_source_citation(metadata: dict[str, Any] | None) -> str:
    """Build a deterministic, human-readable citation string."""
    meta = metadata or {}
    law_name = _WHITESPACE_RE.sub(" ", str(meta.get("law_name") or "")).strip()
    article_no = normalize_article_no(meta.get("article_no"))

    if law_name and article_no:
        return f"{law_name} Md. {article_no}"
    if law_name:
        return law_name
    if article_no:
        return f"Md. {article_no}"
    return "Kaynak belirtilmedi"

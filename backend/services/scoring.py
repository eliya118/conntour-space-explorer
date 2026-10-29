import re
from typing import Sequence, TypeVar

from models import Source

STOPWORDS = frozenset({"a", "an", "the", "of", "images", "image", "photo", "photos"})
_TOKEN = re.compile(r"[a-z0-9]+")

T = TypeVar("T")
TITLE_WEIGHT = 3
KEYWORD_WEIGHT = 2
DESCRIPTION_WEIGHT = 1
MAX_WEIGHT = TITLE_WEIGHT


def tokenize(text: str) -> list[str]:
    """Lowercase words with stopwords removed, first occurrence kept."""
    seen: set[str] = set()
    tokens: list[str] = []
    for token in _TOKEN.findall(text.lower()):
        if token in STOPWORDS or token in seen:
            continue
        seen.add(token)
        tokens.append(token)
    return tokens


def score_source(
    query_tokens: Sequence[str],
    *,
    title: str,
    keywords: Sequence[str],
    description: str,
) -> float:
    """Keyword-overlap confidence in 0..1. A full title match of every token is 1."""
    if not query_tokens:
        return 0.0

    title_tokens = set(tokenize(title))
    keyword_tokens: set[str] = set()
    for keyword in keywords:
        keyword_tokens.update(tokenize(keyword))
    description_tokens = set(tokenize(description or ""))

    earned = 0
    for token in query_tokens:
        if token in title_tokens:
            earned += TITLE_WEIGHT
        elif token in keyword_tokens:
            earned += KEYWORD_WEIGHT
        elif token in description_tokens:
            earned += DESCRIPTION_WEIGHT

    confidence = earned / (len(query_tokens) * MAX_WEIGHT)
    return max(0.0, min(1.0, confidence))


def similar_query(source: Source) -> str:
    """Tokens for similar-image search come from the image title and keywords."""
    return " ".join([source.name, *source.keywords])


def search_sources(
    sources: Sequence[Source],
    query: str,
    *,
    exclude_id: int | None = None,
) -> list[tuple[Source, float]]:
    """Score sources, drop misses, and sort by confidence then name."""
    tokens = tokenize(query)
    if not tokens:
        return []

    scored: list[tuple[Source, float]] = []
    for source in sources:
        if exclude_id is not None and source.id == exclude_id:
            continue
        confidence = score_source(
            tokens,
            title=source.name,
            keywords=source.keywords,
            description=source.description,
        )
        if confidence > 0:
            scored.append((source, confidence))

    scored.sort(key=lambda item: (-item[1], item[0].name.lower()))
    return scored


def slice_page(items: Sequence[T], limit: int, offset: int) -> tuple[list[T], int]:
    """Return one page. limit must be 1..100 and offset must be >= 0."""
    if limit < 1 or limit > 100:
        raise ValueError("limit out of bounds")
    if offset < 0:
        raise ValueError("offset out of bounds")
    return list(items[offset : offset + limit]), len(items)


def field_tokens(
    name: str,
    keywords: Sequence[str],
    description: str,
) -> tuple[list[str], list[str], list[str]]:
    """Token lists stored for SQL membership. The sets match score_source."""
    keyword_tokens: list[str] = []
    seen: set[str] = set()
    for keyword in keywords:
        for token in tokenize(keyword):
            if token not in seen:
                seen.add(token)
                keyword_tokens.append(token)
    return tokenize(name), keyword_tokens, tokenize(description or "")

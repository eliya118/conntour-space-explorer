from dataclasses import dataclass
from datetime import date

from fastapi import HTTPException, Query


@dataclass(frozen=True)
class SourceFilters:
    """Optional browse filters. Blank values are treated as unset."""

    date_from: date | None = None
    date_to: date | None = None
    center: str | None = None
    keywords: tuple[str, ...] = ()
    keyword_match: str = "or"


def _keyword_values(values: list[str] | None) -> tuple[str, ...]:
    names: list[str] = []
    seen: set[str] = set()
    for value in values or []:
        name = value.strip()
        if not name or name in seen:
            continue
        if len(name) > 300:
            raise HTTPException(status_code=400, detail="keyword is too long")
        seen.add(name)
        names.append(name)
    if len(names) > 20:
        raise HTTPException(status_code=400, detail="Select at most 20 keywords")
    return tuple(names)


def get_source_filters(
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    center: str | None = Query(None, max_length=50),
    keyword: list[str] | None = Query(None),
    keyword_match: str = Query("or"),
) -> SourceFilters:
    center_value = center.strip() if center else ""
    match = keyword_match.strip().lower()
    if match not in {"and", "or"}:
        raise HTTPException(status_code=400, detail="keyword_match must be and or or")
    if date_from is not None and date_to is not None and date_from > date_to:
        raise HTTPException(status_code=400, detail="date_from must not be after date_to")
    return SourceFilters(
        date_from=date_from,
        date_to=date_to,
        center=center_value or None,
        keywords=_keyword_values(keyword),
        keyword_match=match,
    )

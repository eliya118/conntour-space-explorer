from dataclasses import dataclass
from datetime import date

from fastapi import HTTPException, Query


@dataclass(frozen=True)
class SourceFilters:
    """Optional browse filters. Blank values are treated as unset."""

    date_from: date | None = None
    date_to: date | None = None
    center: str | None = None
    keyword: str | None = None


def get_source_filters(
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    center: str | None = Query(None, max_length=50),
    keyword: str | None = Query(None, max_length=300),
) -> SourceFilters:
    center_value = center.strip() if center else ""
    keyword_value = keyword.strip() if keyword else ""
    if date_from is not None and date_to is not None and date_from > date_to:
        raise HTTPException(status_code=400, detail="date_from must not be after date_to")
    return SourceFilters(
        date_from=date_from,
        date_to=date_to,
        center=center_value or None,
        keyword=keyword_value or None,
    )

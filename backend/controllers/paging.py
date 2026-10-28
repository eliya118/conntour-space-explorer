from dataclasses import dataclass

from fastapi import Query


@dataclass
class PageParams:
    """Shared list paging. Limit defaults to 24 and cannot exceed 100."""

    limit: int = Query(24, ge=1, le=100)
    offset: int = Query(0, ge=0)

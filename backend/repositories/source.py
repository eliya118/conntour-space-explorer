from collections import Counter
from collections.abc import Sequence
from datetime import date, timedelta
from typing import List

from sqlalchemy import and_, cast, func, or_, select
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import SourceModel
from models import Source, SourceFacets
from repositories.base import Repository


class SourceRepository(Repository[Source]):
    """
    PostgreSQL repository implementation for Source entities.

    Implements the generic Repository interface with PostgreSQL
    as the backing data store using SQLAlchemy async.
    """

    def __init__(self, session: AsyncSession):
        self._session = session

    async def get_all(self) -> List[Source]:
        """Retrieve all sources from the database."""
        result = await self._session.execute(select(SourceModel).order_by(SourceModel.id))
        return [Source.model_validate(row) for row in result.scalars().all()]

    async def get_page(
        self,
        limit: int,
        offset: int,
        *,
        date_from: date | None = None,
        date_to: date | None = None,
        center: str | None = None,
        keyword: Sequence[str] | None = None,
        keyword_match: str = "or",
    ) -> tuple[list[Source], int]:
        """Return one page of sources ordered by id, plus the filtered total."""
        conditions = _source_conditions(date_from, date_to, center, keyword, keyword_match)
        count_stmt = select(func.count()).select_from(SourceModel)
        page_stmt = select(SourceModel).order_by(SourceModel.id)
        if conditions:
            count_stmt = count_stmt.where(*conditions)
            page_stmt = page_stmt.where(*conditions)
        total = await self._session.scalar(count_stmt)
        result = await self._session.execute(page_stmt.offset(offset).limit(limit))
        items = [Source.model_validate(row) for row in result.scalars().all()]
        return items, int(total or 0)

    async def get_facets(self) -> SourceFacets:
        """Centers, keywords, and date bounds from the full catalog."""
        center_rows = await self._session.scalars(
            select(SourceModel.center).where(SourceModel.center != "").distinct().order_by(SourceModel.center)
        )
        keyword_rows = await self._session.scalars(select(SourceModel.keywords))
        counts: Counter[str] = Counter()
        for value in keyword_rows.all():
            if not isinstance(value, list):
                continue
            seen: set[str] = set()
            for item in value:
                name = str(item).strip()
                if name and name not in seen:
                    seen.add(name)
                    counts[name] += 1
        bounds = await self._session.execute(
            select(func.min(SourceModel.launch_date), func.max(SourceModel.launch_date)).where(
                SourceModel.launch_date != ""
            )
        )
        earliest, latest = bounds.one()
        keywords = [
            name for name, _count in sorted(counts.items(), key=lambda item: (-item[1], item[0].lower()))
        ]
        return SourceFacets(
            centers=list(center_rows.all()),
            keywords=keywords,
            date_min=_calendar_day(earliest),
            date_max=_calendar_day(latest),
        )

    async def get_by_id(self, source_id: int) -> Source | None:
        row = await self._session.get(SourceModel, source_id)
        if row is None:
            return None
        return Source.model_validate(row)


def _calendar_day(value: object) -> str | None:
    text = str(value or "")
    if len(text) < 10:
        return None
    return text[:10]


def _source_conditions(
    date_from: date | None,
    date_to: date | None,
    center: str | None,
    keyword: Sequence[str] | None,
    keyword_match: str,
) -> list:
    conditions = []
    if center:
        conditions.append(SourceModel.center == center)
    if date_from is not None:
        conditions.append(SourceModel.launch_date >= date_from.isoformat())
    if date_to is not None:
        conditions.append(SourceModel.launch_date < (date_to + timedelta(days=1)).isoformat())
    names = [name for name in (keyword or []) if name]
    if names:
        clauses = [cast(SourceModel.keywords, JSONB).contains([name]) for name in names]
        combine = and_ if keyword_match == "and" else or_
        conditions.append(combine(*clauses))
    return conditions

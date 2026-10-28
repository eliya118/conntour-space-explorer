from typing import List

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import SourceModel
from models import Source
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

    async def get_page(self, limit: int, offset: int) -> tuple[list[Source], int]:
        """Return one stable page of sources ordered by id, plus the total count."""
        total = await self._session.scalar(select(func.count()).select_from(SourceModel))
        result = await self._session.execute(
            select(SourceModel).order_by(SourceModel.id).offset(offset).limit(limit)
        )
        items = [Source.model_validate(row) for row in result.scalars().all()]
        return items, int(total or 0)

    async def get_by_id(self, source_id: int) -> Source | None:
        row = await self._session.get(SourceModel, source_id)
        if row is None:
            return None
        return Source.model_validate(row)

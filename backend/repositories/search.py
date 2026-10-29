from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import SearchModel
from models import SearchSummary


class SearchRepository:
    """Stores the query and creation time for each search."""

    def __init__(self, session: AsyncSession):
        self._session = session

    async def create(self, query: str) -> SearchModel:
        search = SearchModel(query=query, created_at=datetime.now(timezone.utc))
        self._session.add(search)
        await self._session.commit()
        return search

    async def list_searches(self, limit: int, offset: int) -> tuple[list[SearchSummary], int]:
        total = await self._session.scalar(select(func.count()).select_from(SearchModel))
        result = await self._session.scalars(
            select(SearchModel)
            .order_by(SearchModel.created_at.desc(), SearchModel.id.desc())
            .offset(offset)
            .limit(limit)
        )
        items = [
            SearchSummary(id=search.id, query=search.query, created_at=search.created_at)
            for search in result.all()
        ]
        return items, int(total or 0)

    async def get(self, search_id: int) -> SearchModel | None:
        return await self._session.get(SearchModel, search_id)

    async def delete(self, search_id: int) -> bool:
        search = await self._session.get(SearchModel, search_id)
        if search is None:
            return False
        await self._session.delete(search)
        await self._session.commit()
        return True

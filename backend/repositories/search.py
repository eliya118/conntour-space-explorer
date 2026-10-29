from datetime import datetime, timezone

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import SearchModel, SearchResultModel, SourceModel
from models import ScoredSource, SearchSummary, Source


class SearchRepository:
    """Stores searches and their scored results. source_id is not a foreign key."""

    def __init__(self, session: AsyncSession):
        self._session = session

    async def create(
        self,
        query: str,
        ranked: list[tuple[Source, float]],
        limit: int,
        offset: int,
    ) -> tuple[SearchModel, list[ScoredSource], int]:
        search = SearchModel(query=query, created_at=datetime.now(timezone.utc))
        self._session.add(search)
        await self._session.flush()

        self._session.add_all(
            [
                SearchResultModel(
                    search_id=search.id,
                    source_id=source.id,
                    confidence=confidence,
                    position=position,
                )
                for position, (source, confidence) in enumerate(ranked)
            ]
        )
        await self._session.commit()

        page = [
            ScoredSource(source=source, confidence=confidence)
            for source, confidence in ranked[offset : offset + limit]
        ]
        return search, page, len(ranked)

    async def list_searches(self, limit: int, offset: int) -> tuple[list[SearchSummary], int]:
        total = await self._session.scalar(select(func.count()).select_from(SearchModel))
        result_count = (
            select(func.count(SearchResultModel.id))
            .select_from(SearchResultModel)
            .join(SourceModel, SourceModel.id == SearchResultModel.source_id)
            .where(SearchResultModel.search_id == SearchModel.id)
            .correlate(SearchModel)
            .scalar_subquery()
        )
        result = await self._session.execute(
            select(SearchModel, result_count.label("result_count"))
            .order_by(SearchModel.created_at.desc(), SearchModel.id.desc())
            .offset(offset)
            .limit(limit)
        )
        items = [
            SearchSummary(
                id=search.id,
                query=search.query,
                created_at=search.created_at,
                result_count=int(count or 0),
            )
            for search, count in result.all()
        ]
        return items, int(total or 0)

    async def get(self, search_id: int) -> SearchModel | None:
        return await self._session.get(SearchModel, search_id)

    async def get_results(
        self, search_id: int, limit: int, offset: int
    ) -> tuple[list[ScoredSource], int]:
        total = await self._session.scalar(
            select(func.count())
            .select_from(SearchResultModel)
            .join(SourceModel, SourceModel.id == SearchResultModel.source_id)
            .where(SearchResultModel.search_id == search_id)
        )
        result = await self._session.execute(
            select(SearchResultModel, SourceModel)
            .join(SourceModel, SourceModel.id == SearchResultModel.source_id)
            .where(SearchResultModel.search_id == search_id)
            .order_by(SearchResultModel.position)
            .offset(offset)
            .limit(limit)
        )
        items = [
            ScoredSource(source=Source.model_validate(source), confidence=row.confidence)
            for row, source in result.all()
        ]
        return items, int(total or 0)

    async def delete(self, search_id: int) -> bool:
        search = await self._session.get(SearchModel, search_id)
        if search is None:
            return False
        await self._session.execute(
            delete(SearchResultModel).where(SearchResultModel.search_id == search_id)
        )
        await self._session.delete(search)
        await self._session.commit()
        return True

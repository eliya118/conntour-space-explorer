from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from controllers.paging import PageParams
from db import get_db
from models import Page, ScoredSource, Source
from repositories.source import SourceRepository
from services.scoring import search_sources, similar_query, slice_page

router = APIRouter(prefix="/api/sources", tags=["sources"])


def get_repository(session: AsyncSession = Depends(get_db)) -> SourceRepository:
    """Dependency injection for the source repository."""
    return SourceRepository(session)


@router.get("", response_model=Page[Source])
async def get_sources(
    page: PageParams = Depends(),
    repository: SourceRepository = Depends(get_repository),
) -> Page[Source]:
    """Get one page of NASA image sources."""
    items, total = await repository.get_page(page.limit, page.offset)
    return Page(items=items, total=total, limit=page.limit, offset=page.offset)


@router.get("/{source_id}/similar", response_model=Page[ScoredSource])
async def get_similar_sources(
    source_id: int,
    page: PageParams = Depends(),
    repository: SourceRepository = Depends(get_repository),
) -> Page[ScoredSource]:
    """Images that share keywords or title words with this one. Not saved to history."""
    source = await repository.get_by_id(source_id)
    if source is None:
        raise HTTPException(status_code=404, detail="Source not found")

    ranked = search_sources(
        await repository.get_all(),
        similar_query(source),
        exclude_id=source.id,
    )
    items, total = slice_page(ranked, page.limit, page.offset)
    return Page(
        items=[ScoredSource(source=item, confidence=confidence) for item, confidence in items],
        total=total,
        limit=page.limit,
        offset=page.offset,
    )

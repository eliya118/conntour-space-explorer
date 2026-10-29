from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from controllers.filters import SourceFilters, get_source_filters
from controllers.paging import PageParams
from db import get_db
from models import Page, ScoredSource, Source, SourceFacets
from repositories.source import SourceRepository
from services.scoring import similar_query, tokenize

router = APIRouter(prefix="/api/sources", tags=["sources"])


def get_repository(session: AsyncSession = Depends(get_db)) -> SourceRepository:
    """Dependency injection for the source repository."""
    return SourceRepository(session)


@router.get("", response_model=Page[Source])
async def get_sources(
    page: PageParams = Depends(),
    filters: SourceFilters = Depends(get_source_filters),
    repository: SourceRepository = Depends(get_repository),
) -> Page[Source]:
    """Get one page of NASA image sources."""
    items, total = await repository.get_page(
        page.limit,
        page.offset,
        date_from=filters.date_from,
        date_to=filters.date_to,
        center=filters.center,
        keyword=filters.keywords,
        keyword_match=filters.keyword_match,
    )
    return Page(items=items, total=total, limit=page.limit, offset=page.offset)


@router.get("/facets", response_model=SourceFacets)
async def get_source_facets(
    repository: SourceRepository = Depends(get_repository),
) -> SourceFacets:
    """Centers and year bounds for the browse filters."""
    return await repository.get_facets()


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

    items, total = await repository.search_page(
        tokenize(similar_query(source)),
        page.limit,
        page.offset,
        exclude_id=source.id,
    )
    return Page(items=items, total=total, limit=page.limit, offset=page.offset)

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.ext.asyncio import AsyncSession

from controllers.paging import PageParams
from db import get_db
from models import Page, SearchRequest, SearchResults, SearchSummary
from repositories.search import SearchRepository
from repositories.source import SourceRepository
from services.scoring import tokenize

router = APIRouter(prefix="/api/searches", tags=["searches"])


def get_search_repository(session: AsyncSession = Depends(get_db)) -> SearchRepository:
    return SearchRepository(session)


def get_source_repository(session: AsyncSession = Depends(get_db)) -> SourceRepository:
    return SourceRepository(session)


@router.post("", response_model=SearchResults, status_code=201)
async def create_search(
    body: SearchRequest,
    page: PageParams = Depends(),
    searches: SearchRepository = Depends(get_search_repository),
    sources: SourceRepository = Depends(get_source_repository),
) -> SearchResults:
    """Store the query, score the current catalog in the database, and return one page."""
    tokens = tokenize(body.query)
    if not tokens:
        raise HTTPException(status_code=400, detail="Query has no searchable terms")

    search = await searches.create(body.query)
    items, total = await sources.search_page(tokens, page.limit, page.offset)
    return SearchResults(
        id=search.id,
        query=search.query,
        created_at=search.created_at,
        items=items,
        total=total,
        limit=page.limit,
        offset=page.offset,
    )


@router.get("", response_model=Page[SearchSummary])
async def list_searches(
    page: PageParams = Depends(),
    searches: SearchRepository = Depends(get_search_repository),
) -> Page[SearchSummary]:
    """History page, newest first."""
    items, total = await searches.list_searches(page.limit, page.offset)
    return Page(items=items, total=total, limit=page.limit, offset=page.offset)


@router.get("/{search_id}", response_model=SearchResults)
async def get_search(
    search_id: int,
    page: PageParams = Depends(),
    searches: SearchRepository = Depends(get_search_repository),
    sources: SourceRepository = Depends(get_source_repository),
) -> SearchResults:
    """Rerun a saved query against the current catalog. Does not insert a history row."""
    search = await searches.get(search_id)
    if search is None:
        raise HTTPException(status_code=404, detail="Search not found")
    items, total = await sources.search_page(tokenize(search.query), page.limit, page.offset)
    return SearchResults(
        id=search.id,
        query=search.query,
        created_at=search.created_at,
        items=items,
        total=total,
        limit=page.limit,
        offset=page.offset,
    )


@router.delete("/{search_id}", status_code=204)
async def delete_search(
    search_id: int,
    searches: SearchRepository = Depends(get_search_repository),
) -> Response:
    deleted = await searches.delete(search_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Search not found")
    return Response(status_code=204)

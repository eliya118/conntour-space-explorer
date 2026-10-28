from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession

from db import get_db
from models import Page, SearchRequest, SearchResults, SearchSummary
from repositories.search import SearchRepository
from repositories.source import SourceRepository
from services.scoring import search_sources, tokenize

router = APIRouter(prefix="/api/searches", tags=["searches"])


def get_search_repository(session: AsyncSession = Depends(get_db)) -> SearchRepository:
    return SearchRepository(session)


def get_source_repository(session: AsyncSession = Depends(get_db)) -> SourceRepository:
    return SourceRepository(session)


@router.post("", response_model=SearchResults, status_code=201)
async def create_search(
    body: SearchRequest,
    searches: SearchRepository = Depends(get_search_repository),
    sources: SourceRepository = Depends(get_source_repository),
    limit: int = Query(24, ge=1, le=100),
    offset: int = Query(0, ge=0),
) -> SearchResults:
    """Score every image, store the search, and return the first page of matches."""
    if not tokenize(body.query):
        raise HTTPException(status_code=400, detail="Query has no searchable terms")

    ranked = search_sources(await sources.get_all(), body.query)
    search, items, total = await searches.create(body.query, ranked, limit, offset)
    return SearchResults(
        id=search.id,
        query=search.query,
        created_at=search.created_at,
        items=items,
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("", response_model=Page[SearchSummary])
async def list_searches(
    limit: int = Query(24, ge=1, le=100),
    offset: int = Query(0, ge=0),
    searches: SearchRepository = Depends(get_search_repository),
) -> Page[SearchSummary]:
    """History page, newest first."""
    items, total = await searches.list_searches(limit, offset)
    return Page(items=items, total=total, limit=limit, offset=offset)


@router.get("/{search_id}", response_model=SearchResults)
async def get_search(
    search_id: int,
    limit: int = Query(24, ge=1, le=100),
    offset: int = Query(0, ge=0),
    searches: SearchRepository = Depends(get_search_repository),
) -> SearchResults:
    """One page of a saved search, using stored scores."""
    search = await searches.get(search_id)
    if search is None:
        raise HTTPException(status_code=404, detail="Search not found")
    items, total = await searches.get_results(search_id, limit, offset)
    return SearchResults(
        id=search.id,
        query=search.query,
        created_at=search.created_at,
        items=items,
        total=total,
        limit=limit,
        offset=offset,
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

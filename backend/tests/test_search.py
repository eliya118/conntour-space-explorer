from datetime import datetime, timezone
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from controllers.paging import PageParams
from controllers.search import create_search, delete_search
from controllers.source import get_similar_sources
from models import ScoredSource, SearchRequest, Source


def _page() -> PageParams:
    return PageParams(limit=24, offset=0)


class _RejectingSearches:
    async def create(self, *args, **kwargs):
        raise AssertionError("this query must not be saved")


class _RejectingSources:
    async def get_all(self):
        raise AssertionError("the catalog must not be loaded")


@pytest.mark.asyncio
async def test_stopword_query_is_rejected_before_it_is_saved():
    with pytest.raises(HTTPException) as exc:
        await create_search(
            SearchRequest(query="the images"),
            _page(),
            _RejectingSearches(),
            _RejectingSources(),
        )
    assert exc.value.status_code == 400
    assert exc.value.detail == "Query has no searchable terms"


@pytest.mark.asyncio
async def test_similar_images_for_a_missing_source_are_not_found():
    class Repository(_RejectingSources):
        async def get_by_id(self, source_id):
            assert source_id == 404
            return None

    with pytest.raises(HTTPException) as exc:
        await get_similar_sources(404, _page(), Repository())
    assert exc.value.status_code == 404
    assert exc.value.detail == "Source not found"


@pytest.mark.asyncio
async def test_deleting_a_missing_search_is_not_found():
    class Searches:
        async def delete(self, search_id):
            assert search_id == 3
            return False

    with pytest.raises(HTTPException) as exc:
        await delete_search(3, Searches())
    assert exc.value.status_code == 404
    assert exc.value.detail == "Search not found"


@pytest.mark.asyncio
async def test_a_search_stores_only_matches_and_returns_the_requested_page():
    catalog = [
        Source(
            id=1,
            name="Engine test",
            type="image",
            launch_date="2018-06-25T00:00:00Z",
            description="",
            status="Active",
            keywords=["Shuttle"],
        ),
        Source(
            id=2,
            name="Mars Rover",
            type="image",
            launch_date="2018-06-25T00:00:00Z",
            description="",
            status="Active",
            keywords=["Mars"],
        ),
    ]

    class Sources:
        async def get_all(self):
            return catalog

    class Searches:
        def __init__(self):
            self.ranked = None

        async def create(self, query, ranked, limit, offset):
            self.ranked = ranked
            page = ranked[offset : offset + limit]
            stored = SimpleNamespace(
                id=7,
                query=query,
                created_at=datetime(2018, 6, 25, tzinfo=timezone.utc),
            )
            return (
                stored,
                [ScoredSource(source=source, confidence=confidence) for source, confidence in page],
                len(ranked),
            )

    searches = Searches()
    result = await create_search(
        SearchRequest(query="mars rover"),
        PageParams(limit=1, offset=0),
        searches,
        Sources(),
    )

    assert [source.name for source, _confidence in searches.ranked] == ["Mars Rover"]
    assert result.total == 1
    assert result.limit == 1
    assert [item.source.name for item in result.items] == ["Mars Rover"]
    assert result.items[0].confidence == 1.0

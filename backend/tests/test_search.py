from datetime import datetime, timezone
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from controllers.paging import PageParams
from controllers.search import create_search, delete_search, get_search
from controllers.source import get_similar_sources
from models import ScoredSource, SearchRequest, Source
from services.scoring import similar_query, tokenize


def _page() -> PageParams:
    return PageParams(limit=24, offset=0)


def _source(**overrides) -> Source:
    data = {
        "id": 2,
        "name": "Mars Rover",
        "type": "image",
        "launch_date": "2018-06-25T00:00:00Z",
        "description": "",
        "status": "Active",
        "keywords": ["Mars"],
    }
    data.update(overrides)
    return Source(**data)


class _RejectingSearches:
    async def create(self, *args, **kwargs):
        raise AssertionError("this query must not be saved")


class _RejectingSources:
    async def search_page(self, *args, **kwargs):
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
async def test_similar_images_exclude_the_source_and_keep_the_requested_page():
    source = _source(id=8, name="Gale Crater", keywords=["Mars"])

    class Repository:
        async def get_by_id(self, source_id):
            assert source_id == source.id
            return source

        async def search_page(self, tokens, limit, offset, exclude_id=None):
            assert tokens == tokenize(similar_query(source))
            assert exclude_id == source.id
            assert limit == 2
            assert offset == 2
            related = _source(id=9, name="Mars Rover")
            return [ScoredSource(source=related, confidence=2 / 3)], 5

    page = await get_similar_sources(source.id, PageParams(limit=2, offset=2), Repository())
    assert page.total == 5
    assert page.limit == 2
    assert page.offset == 2
    assert [item.source.id for item in page.items] == [9]


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
async def test_a_search_saves_the_query_and_returns_the_database_page():
    class Sources:
        def __init__(self):
            self.tokens = None

        async def search_page(self, tokens, limit, offset, exclude_id=None):
            self.tokens = tokens
            assert limit == 1
            assert offset == 0
            assert exclude_id is None
            return [ScoredSource(source=_source(), confidence=1.0)], 4

    class Searches:
        def __init__(self):
            self.query = None

        async def create(self, query):
            self.query = query
            return SimpleNamespace(
                id=7,
                query=query,
                created_at=datetime(2018, 6, 25, tzinfo=timezone.utc),
            )

    sources = Sources()
    searches = Searches()
    result = await create_search(
        SearchRequest(query="mars rover"),
        PageParams(limit=1, offset=0),
        searches,
        sources,
    )

    assert searches.query == "mars rover"
    assert sources.tokens == ["mars", "rover"]
    assert result.id == 7
    assert result.total == 4
    assert result.limit == 1
    assert [item.source.name for item in result.items] == ["Mars Rover"]
    assert result.items[0].confidence == 1.0


@pytest.mark.asyncio
async def test_reopening_a_search_reruns_the_query_and_does_not_insert():
    class Searches:
        async def get(self, search_id):
            assert search_id == 7
            return SimpleNamespace(
                id=7,
                query="images of mars",
                created_at=datetime(2018, 6, 25, tzinfo=timezone.utc),
            )

        async def create(self, *args, **kwargs):
            raise AssertionError("reopen must not insert")

    class Sources:
        async def search_page(self, tokens, limit, offset, exclude_id=None):
            assert tokens == ["mars"]
            assert limit == 1
            assert offset == 2
            assert exclude_id is None
            return [ScoredSource(source=_source(), confidence=1.0)], 3

    result = await get_search(7, PageParams(limit=1, offset=2), Searches(), Sources())
    assert result.query == "images of mars"
    assert result.total == 3
    assert result.offset == 2
    assert result.limit == 1
    assert [item.source.name for item in result.items] == ["Mars Rover"]

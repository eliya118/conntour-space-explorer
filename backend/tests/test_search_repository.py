import pytest
from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine

from controllers.paging import PageParams
from controllers.search import create_search
from db.models import SourceModel
from db.session import DATABASE_URL
from models import SearchRequest
from repositories.search import SearchRepository
from repositories.source import SourceRepository
from services.scoring import field_tokens, search_sources, similar_query, tokenize


@pytest.fixture
async def db_session():
    engine = create_async_engine(DATABASE_URL)
    async with engine.connect() as connection:
        transaction = await connection.begin()
        session = AsyncSession(
            bind=connection,
            expire_on_commit=False,
            join_transaction_mode="create_savepoint",
        )
        try:
            yield session
        finally:
            await session.close()
            await transaction.rollback()
    await engine.dispose()


def _source_row(**overrides) -> SourceModel:
    data = {
        "name": "Untitled",
        "type": "image",
        "launch_date": "2018-06-25T00:00:00Z",
        "center": "",
        "description": "",
        "image_url": None,
        "status": "Active",
        "keywords": [],
        "nasa_id": "TEST",
    }
    data.update(overrides)
    title_tokens, keyword_tokens, description_tokens = field_tokens(
        data["name"],
        data["keywords"],
        data["description"],
    )
    data["title_tokens"] = title_tokens
    data["keyword_tokens"] = keyword_tokens
    data["description_tokens"] = description_tokens
    return SourceModel(**data)


async def _ranked(sources: SourceRepository, query: str, *, exclude_id: int | None = None):
    catalog = await sources.get_all()
    expected = search_sources(catalog, query, exclude_id=exclude_id)
    limit = max(len(expected), 1)
    items, total = await sources.search_page(
        tokenize(query),
        limit,
        0,
        exclude_id=exclude_id,
    )
    return expected, items, total


def _assert_same_ranking(expected, items, total) -> None:
    assert total == len(expected)
    assert [item.source.id for item in items] == [source.id for source, _confidence in expected]
    assert [item.confidence for item in items] == [confidence for _source, confidence in expected]


@pytest.mark.asyncio
async def test_sql_ranking_matches_python_for_filters_order_and_pages(db_session):
    db_session.add_all(
        [
            _source_row(id=90001, name="Tie Break", keywords=["tiebreaker"]),
            _source_row(id=90002, name="tie break", keywords=["tiebreaker"]),
            _source_row(
                id=90003,
                name="Multifield",
                keywords=["Multifield"],
                description="Multifield again",
            ),
            _source_row(id=90004, name="Untitled card", keywords=["keywordonly"]),
            _source_row(id=90005, name="Untitled note", description="descriptiononly loop"),
            _source_row(id=90006, name="Nothing here", keywords=["shuttle"]),
        ]
    )
    await db_session.flush()
    sources = SourceRepository(db_session)

    for query in ("mars", "mars mars", "images of mars"):
        expected, items, total = await _ranked(sources, query)
        _assert_same_ranking(expected, items, total)

    mars, mars_items, _mars_total = await _ranked(sources, "mars")
    duplicate, duplicate_items, _duplicate_total = await _ranked(sources, "mars mars")
    assert [item.source.id for item in mars_items] == [item.source.id for item in duplicate_items]
    assert [item.confidence for item in mars_items] == [
        item.confidence for item in duplicate_items
    ]
    assert [source.id for source, _confidence in mars] == [
        item.source.id for item in duplicate_items
    ]

    multifield = next(item for item in (await _ranked(sources, "multifield"))[1] if item.source.id == 90003)
    assert multifield.confidence == 1.0
    keyword_only = next(item for item in (await _ranked(sources, "keywordonly"))[1] if item.source.id == 90004)
    assert keyword_only.confidence == 2 / 3
    description_only = next(
        item for item in (await _ranked(sources, "descriptiononly"))[1] if item.source.id == 90005
    )
    assert description_only.confidence == 1 / 3
    _expected, missed, missed_total = await _ranked(sources, "keywordonly")
    assert 90006 not in [item.source.id for item in missed]
    assert missed_total == len(_expected)

    ties, tie_items, tie_total = await _ranked(sources, "tiebreaker")
    _assert_same_ranking(ties, tie_items, tie_total)
    assert [item.source.id for item in tie_items] == [90001, 90002]

    expected, _items, total = await _ranked(sources, "mars")
    page, page_total = await sources.search_page(tokenize("mars"), 2, 2)
    assert page_total == total == len(expected)
    assert [item.source.id for item in page] == [source.id for source, _confidence in expected[2:4]]
    assert [item.confidence for item in page] == [confidence for _source, confidence in expected[2:4]]

    catalog = await sources.get_all()
    origin = next(source for source in catalog if source.id == 90003)
    expected, items, total = await _ranked(sources, similar_query(origin), exclude_id=origin.id)
    _assert_same_ranking(expected, items, total)
    assert origin.id not in [item.source.id for item in items]


@pytest.mark.asyncio
async def test_history_stores_the_query_and_reopen_does_not_insert(db_session):
    columns = await db_session.execute(
        text(
            """
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'searches'
            ORDER BY column_name
            """
        )
    )
    assert [row[0] for row in columns] == ["created_at", "id", "query"]
    assert (await db_session.scalar(text("SELECT to_regclass('public.search_results')"))) is None

    searches = SearchRepository(db_session)
    before = await db_session.scalar(text("SELECT COUNT(*) FROM searches"))
    with pytest.raises(HTTPException) as exc:
        await create_search(
            SearchRequest(query="the images"),
            PageParams(limit=24, offset=0),
            searches,
            SourceRepository(db_session),
        )
    assert exc.value.status_code == 400
    assert await db_session.scalar(text("SELECT COUNT(*) FROM searches")) == before

    created = await searches.create("mars rover")
    assert created.query == "mars rover"
    assert created.created_at is not None
    assert await db_session.scalar(text("SELECT COUNT(*) FROM searches")) == before + 1

    stored = await searches.get(created.id)
    items, total = await SourceRepository(db_session).search_page(tokenize(stored.query), 2, 0)
    assert await db_session.scalar(text("SELECT COUNT(*) FROM searches")) == before + 1
    assert total >= len(items)
    assert len(items) <= 2

    assert await searches.delete(created.id) is True
    assert await searches.get(created.id) is None
    assert await db_session.scalar(text("SELECT COUNT(*) FROM searches")) == before

from datetime import date

import pytest
from fastapi import HTTPException
from sqlalchemy.dialects import postgresql

from controllers.filters import get_source_filters
from controllers.paging import PageParams
from controllers.source import get_sources
from repositories.source import _source_conditions


def _filters(**overrides):
    params = {
        "date_from": None,
        "date_to": None,
        "center": None,
        "keyword": None,
        "keyword_match": "or",
    }
    params.update(overrides)
    return get_source_filters(**params)


def _sql(clause) -> str:
    return str(
        clause.compile(
            dialect=postgresql.dialect(),
            compile_kwargs={"literal_binds": True},
        )
    )


def test_filters_drop_blanks_and_duplicate_keywords_and_normalize_match():
    filters = _filters(
        center="  JPL  ",
        keyword=[" Mars ", "Mars", "", "  "],
        keyword_match=" AND ",
    )
    assert filters.center == "JPL"
    assert filters.keywords == ("Mars",)
    assert filters.keyword_match == "and"


def test_blank_center_is_unset_and_twenty_keywords_are_kept_in_order():
    names = [f"k{index}" for index in range(20)]
    filters = _filters(center="   ", keyword=names)
    assert filters.center is None
    assert filters.keywords == tuple(names)


def test_same_day_range_is_accepted():
    day = date(2020, 1, 15)
    filters = _filters(date_from=day, date_to=day)
    assert (filters.date_from, filters.date_to) == (day, day)


@pytest.mark.parametrize(
    ("kwargs", "detail"),
    [
        ({"keyword_match": "xor"}, "keyword_match must be and or or"),
        (
            {"date_from": date(2020, 2, 1), "date_to": date(2020, 1, 1)},
            "date_from must not be after date_to",
        ),
        ({"keyword": ["x" * 301]}, "keyword is too long"),
        ({"keyword": [f"k{index}" for index in range(21)]}, "Select at most 20 keywords"),
    ],
)
def test_invalid_browse_filters_are_rejected(kwargs, detail):
    with pytest.raises(HTTPException) as exc:
        _filters(**kwargs)
    assert exc.value.status_code == 400
    assert exc.value.detail == detail


def test_same_day_window_includes_that_calendar_day():
    day = date(2020, 1, 31)
    sql = " ".join(_sql(clause) for clause in _source_conditions(day, day, None, None, "or"))
    assert ">= '2020-01-31'" in sql
    assert "< '2020-02-01'" in sql


def _compiled(clause):
    return clause.compile(dialect=postgresql.dialect())


def test_keywords_combine_with_and_or_or():
    required = _compiled(_source_conditions(None, None, None, ("Mars", "NASA"), "and")[0])
    optional = _compiled(_source_conditions(None, None, None, ("Mars", "NASA"), "or")[0])
    assert " AND " in str(required)
    assert " OR " in str(optional) and " AND " not in str(optional)
    assert list(required.params.values()) == [["Mars"], ["NASA"]]
    assert "@>" in str(required)


def test_center_filter_is_an_exact_match_and_blank_filters_add_nothing():
    sql = _sql(_source_conditions(None, None, "JPL", None, "or")[0])
    assert "= 'JPL'" in sql
    assert _source_conditions(None, None, None, (), "or") == []


class _RecordingRepository:
    def __init__(self):
        self.call = None

    async def get_page(self, limit, offset, **kwargs):
        self.call = (limit, offset, kwargs)
        return [], 0


@pytest.mark.asyncio
async def test_browse_forwards_normalized_filters_with_the_requested_page():
    filters = _filters(
        date_from=date(2018, 1, 1),
        date_to=date(2018, 12, 31),
        center=" JPL ",
        keyword=["Mars", " Mars ", "NASA"],
        keyword_match=" Or ",
    )
    repository = _RecordingRepository()

    page = await get_sources(PageParams(limit=24, offset=48), filters, repository)

    assert (page.limit, page.offset, page.total, page.items) == (24, 48, 0, [])
    assert repository.call == (
        24,
        48,
        {
            "date_from": date(2018, 1, 1),
            "date_to": date(2018, 12, 31),
            "center": "JPL",
            "keyword": ("Mars", "NASA"),
            "keyword_match": "or",
        },
    )

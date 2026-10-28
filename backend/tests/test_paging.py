import pytest

from services.scoring import slice_page


def test_first_page_respects_limit_and_reports_total():
    items = list(range(30))
    page, total = slice_page(items, limit=24, offset=0)
    assert page == list(range(24))
    assert total == 30


def test_later_page_returns_the_remainder():
    page, total = slice_page(list(range(30)), limit=24, offset=24)
    assert page == list(range(24, 30))
    assert total == 30


def test_offset_past_the_end_is_an_empty_page():
    page, total = slice_page(list(range(30)), limit=24, offset=100)
    assert page == []
    assert total == 30


def test_offset_equal_to_total_is_an_empty_page():
    page, total = slice_page(list(range(30)), limit=24, offset=30)
    assert page == []
    assert total == 30


@pytest.mark.parametrize(
    ("limit", "offset"),
    [(0, 0), (101, 0), (24, -1)],
)
def test_page_bounds_reject_limit_and_offset_outside_the_contract(limit: int, offset: int):
    with pytest.raises(ValueError):
        slice_page([1, 2, 3], limit=limit, offset=offset)

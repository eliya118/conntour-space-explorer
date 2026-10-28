from models import Source
from services.scoring import score_source, search_sources, similar_query, tokenize


def _source(**overrides) -> Source:
    data = {
        "id": 1,
        "name": "Untitled",
        "type": "image",
        "launch_date": "2018-06-25T00:00:00Z",
        "description": "",
        "image_url": None,
        "status": "Active",
        "keywords": [],
        "nasa_id": "TEST",
    }
    data.update(overrides)
    return Source(**data)


def test_title_match_scores_one():
    confidence = score_source(
        tokenize("images of Mars rovers"),
        title="Mars Rovers",
        keywords=[],
        description="",
    )
    assert confidence == 1.0


def test_keyword_only_match_uses_keyword_weight():
    confidence = score_source(
        tokenize("solar flares"),
        title="Untitled",
        keywords=["Solar flares"],
        description="",
    )
    assert confidence == 2 / 3


def test_description_only_match_uses_description_weight():
    confidence = score_source(
        tokenize("plasma"),
        title="Untitled",
        keywords=[],
        description="A plasma loop over the limb",
    )
    assert confidence == 1 / 3


def test_title_match_is_capped_when_the_token_is_also_elsewhere():
    confidence = score_source(
        tokenize("mars"),
        title="Mars",
        keywords=["Mars"],
        description="Mars again",
    )
    assert confidence == 1.0


def test_stopwords_leave_no_searchable_terms():
    assert tokenize("images of the photo") == []
    assert search_sources([_source(name="Mars")], "the images") == []


def test_zero_scores_are_dropped_and_results_sort_by_confidence_then_name():
    sources = [
        _source(id=1, name="Zulu", keywords=["Mars"]),
        _source(id=2, name="Alpha", keywords=[], description="nothing"),
        _source(id=3, name="Mars Rover", keywords=["Mars"]),
        _source(id=4, name="beta crater", keywords=["Mars"]),
    ]
    ranked = search_sources(sources, "mars")
    assert [source.name for source, _ in ranked] == ["Mars Rover", "beta crater", "Zulu"]
    assert ranked[0][1] == 1.0
    assert ranked[1][1] == 2 / 3


def test_similar_query_excludes_the_source_and_drops_unrelated_images():
    origin = _source(id=1, name="Gale Crater", keywords=["2001 Mars Odyssey", "Mars"])
    related = _source(id=2, name="Mars Rover", keywords=["Mars"])
    unrelated = _source(id=3, name="Engine test", keywords=["Shuttle"])
    ranked = search_sources(
        [origin, related, unrelated],
        similar_query(origin),
        exclude_id=origin.id,
    )
    assert [source.id for source, _ in ranked] == [2]
    assert ranked[0][1] > 0

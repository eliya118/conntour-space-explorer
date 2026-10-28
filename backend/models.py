from datetime import datetime
from typing import Generic, Optional, TypeVar

from pydantic import BaseModel, ConfigDict, Field, field_validator

T = TypeVar("T")


class Source(BaseModel):
    """Domain model for NASA image sources."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    type: str
    launch_date: str
    center: str = ""
    description: str = ""
    image_url: Optional[str] = None
    status: str
    keywords: list[str] = Field(default_factory=list)
    nasa_id: Optional[str] = None

    @field_validator("keywords", mode="before")
    @classmethod
    def coerce_keywords(cls, value: object) -> list[str]:
        if not value:
            return []
        if isinstance(value, str):
            return [value]
        return [str(item) for item in value]


class SourceFacets(BaseModel):
    """Centers, keywords, and date bounds for the browse filters."""

    centers: list[str]
    keywords: list[str]
    date_min: Optional[str] = None
    date_max: Optional[str] = None


class Page(BaseModel, Generic[T]):
    """One page of a list endpoint."""

    items: list[T]
    total: int
    limit: int
    offset: int


class ScoredSource(BaseModel):
    """An image plus the confidence that it matches a query."""

    source: Source
    confidence: float


class SearchRequest(BaseModel):
    query: str = Field(min_length=1, max_length=500)


class SearchSummary(BaseModel):
    id: int
    query: str
    created_at: datetime
    result_count: int


class SearchResults(BaseModel):
    """A saved search and one page of its stored matches."""

    id: int
    query: str
    created_at: datetime
    items: list[ScoredSource]
    total: int
    limit: int
    offset: int

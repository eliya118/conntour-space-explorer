from sqlalchemy import JSON, Column, DateTime, Float, Index, Integer, String, Text
from sqlalchemy.orm import declarative_base

Base = declarative_base()


class SourceModel(Base):
    """SQLAlchemy model for sources table."""

    __tablename__ = "sources"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(Text, nullable=False)
    type = Column(String(100), nullable=False)
    launch_date = Column(String(100), nullable=False)
    center = Column(String(50), nullable=False, default="")
    description = Column(Text, nullable=True)
    image_url = Column(Text, nullable=True)
    status = Column(String(50), nullable=False, default="Active")
    keywords = Column(JSON, nullable=False)
    nasa_id = Column(String(200), nullable=True)


class SearchModel(Base):
    """A saved user search. No foreign key to sources, so reseeding images keeps history."""

    __tablename__ = "searches"

    id = Column(Integer, primary_key=True, index=True)
    query = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, index=True)


class SearchResultModel(Base):
    """One stored match. source_id is not a foreign key so image reseeds do not delete history."""

    __tablename__ = "search_results"
    __table_args__ = (Index("ix_search_results_search_position", "search_id", "position"),)

    id = Column(Integer, primary_key=True, index=True)
    search_id = Column(Integer, nullable=False, index=True)
    source_id = Column(Integer, nullable=False, index=True)
    confidence = Column(Float, nullable=False)
    position = Column(Integer, nullable=False)

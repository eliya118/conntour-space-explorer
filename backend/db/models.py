from sqlalchemy import JSON, Column, DateTime, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import declarative_base

Base = declarative_base()


class SourceModel(Base):
    """SQLAlchemy model for sources table."""

    __tablename__ = "sources"
    __table_args__ = (
        Index("ix_sources_title_tokens", "title_tokens", postgresql_using="gin"),
        Index("ix_sources_keyword_tokens", "keyword_tokens", postgresql_using="gin"),
        Index("ix_sources_description_tokens", "description_tokens", postgresql_using="gin"),
    )

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
    title_tokens = Column(ARRAY(Text), nullable=False)
    keyword_tokens = Column(ARRAY(Text), nullable=False)
    description_tokens = Column(ARRAY(Text), nullable=False)


class SearchModel(Base):
    """A saved user search. Only the query and time are stored, so reseeding images keeps history."""

    __tablename__ = "searches"

    id = Column(Integer, primary_key=True, index=True)
    query = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, index=True)

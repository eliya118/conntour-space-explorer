"""Store search queries only and rank sources from token arrays.

search_results holds derived scores. Dropping it keeps searches.query and
searches.created_at, which are the history that must survive.

Revision ID: 0001_search_query_only
Revises:
Create Date: 2026-10-29
"""

import json

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

from services.scoring import field_tokens

revision = "0001_search_query_only"
down_revision = None
branch_labels = None
depends_on = None

_TOKEN_COLUMNS = ("title_tokens", "keyword_tokens", "description_tokens")
_GIN_INDEXES = (
    ("ix_sources_title_tokens", "title_tokens"),
    ("ix_sources_keyword_tokens", "keyword_tokens"),
    ("ix_sources_description_tokens", "description_tokens"),
)


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if not inspector.has_table("sources"):
        _create_sources()
    else:
        _add_token_columns(bind)
    if not inspector.has_table("searches"):
        _create_searches()
    if inspector.has_table("search_results"):
        op.drop_table("search_results")


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if not inspector.has_table("search_results"):
        op.create_table(
            "search_results",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("search_id", sa.Integer(), nullable=False),
            sa.Column("source_id", sa.Integer(), nullable=False),
            sa.Column("confidence", sa.Float(), nullable=False),
            sa.Column("position", sa.Integer(), nullable=False),
        )
        op.create_index("ix_search_results_id", "search_results", ["id"])
        op.create_index("ix_search_results_search_id", "search_results", ["search_id"])
        op.create_index("ix_search_results_source_id", "search_results", ["source_id"])
        op.create_index(
            "ix_search_results_search_position",
            "search_results",
            ["search_id", "position"],
        )
    if inspector.has_table("sources"):
        indexes = {index["name"] for index in inspector.get_indexes("sources")}
        for index_name, _column_name in _GIN_INDEXES:
            if index_name in indexes:
                op.drop_index(index_name, table_name="sources")
        columns = {column["name"] for column in inspector.get_columns("sources")}
        for column_name in _TOKEN_COLUMNS:
            if column_name in columns:
                op.drop_column("sources", column_name)


def _create_sources() -> None:
    op.create_table(
        "sources",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("type", sa.String(length=100), nullable=False),
        sa.Column("launch_date", sa.String(length=100), nullable=False),
        sa.Column("center", sa.String(length=50), nullable=False, server_default=""),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("image_url", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="Active"),
        sa.Column("keywords", sa.JSON(), nullable=False),
        sa.Column("nasa_id", sa.String(length=200), nullable=True),
        sa.Column("title_tokens", postgresql.ARRAY(sa.Text()), nullable=False),
        sa.Column("keyword_tokens", postgresql.ARRAY(sa.Text()), nullable=False),
        sa.Column("description_tokens", postgresql.ARRAY(sa.Text()), nullable=False),
    )
    op.create_index("ix_sources_id", "sources", ["id"])
    for index_name, column_name in _GIN_INDEXES:
        op.create_index(index_name, "sources", [column_name], postgresql_using="gin")


def _create_searches() -> None:
    op.create_table(
        "searches",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("query", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_searches_id", "searches", ["id"])
    op.create_index("ix_searches_created_at", "searches", ["created_at"])


def _add_token_columns(bind) -> None:
    inspector = sa.inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("sources")}
    for column_name in _TOKEN_COLUMNS:
        if column_name not in columns:
            op.add_column(
                "sources",
                sa.Column(column_name, postgresql.ARRAY(sa.Text()), nullable=True),
            )
    _backfill_token_columns(bind)
    for column_name in _TOKEN_COLUMNS:
        op.alter_column("sources", column_name, nullable=False)
    indexes = {index["name"] for index in inspector.get_indexes("sources")}
    for index_name, column_name in _GIN_INDEXES:
        if index_name not in indexes:
            op.create_index(index_name, "sources", [column_name], postgresql_using="gin")


def _backfill_token_columns(bind) -> None:
    rows = bind.execute(
        sa.text(
            """
            SELECT id, name, description, keywords
            FROM sources
            WHERE title_tokens IS NULL
               OR keyword_tokens IS NULL
               OR description_tokens IS NULL
            """
        )
    ).mappings()
    payload = []
    for row in rows:
        title_tokens, keyword_tokens, description_tokens = field_tokens(
            row["name"] or "",
            _keywords(row["keywords"]),
            row["description"] or "",
        )
        payload.append(
            {
                "id": row["id"],
                "title_tokens": title_tokens,
                "keyword_tokens": keyword_tokens,
                "description_tokens": description_tokens,
            }
        )
    if not payload:
        return
    statement = sa.text(
        """
        UPDATE sources
        SET title_tokens = :title_tokens,
            keyword_tokens = :keyword_tokens,
            description_tokens = :description_tokens
        WHERE id = :id
        """
    ).bindparams(
        sa.bindparam("title_tokens", type_=postgresql.ARRAY(sa.Text())),
        sa.bindparam("keyword_tokens", type_=postgresql.ARRAY(sa.Text())),
        sa.bindparam("description_tokens", type_=postgresql.ARRAY(sa.Text())),
    )
    bind.execute(statement, payload)


def _keywords(value: object) -> list[str]:
    if not value:
        return []
    if isinstance(value, str):
        stripped = value.strip()
        if stripped.startswith("["):
            parsed = json.loads(stripped)
            return [str(item) for item in parsed]
        return [stripped]
    return [str(item) for item in value]

#!/usr/bin/env python
"""
Database seeding script.
Reads mock_data.json and populates the PostgreSQL database.
"""

import asyncio
import json
import os
import sys

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db.models import SourceModel
from db.session import AsyncSessionLocal, engine
from services.scoring import field_tokens


def _recreate_sources(connection) -> None:
    """Drop and recreate only the sources table so search history survives a reseed."""
    SourceModel.__table__.drop(connection, checkfirst=True)
    SourceModel.__table__.create(connection, checkfirst=True)


def _keywords(value: object) -> list[str]:
    if not value:
        return []
    if isinstance(value, str):
        return [value]
    return [str(item) for item in value]


async def seed_database():
    """Seed sources from mock_data.json without touching search history."""

    async with engine.begin() as conn:
        await conn.run_sync(_recreate_sources)

    data_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "data",
        "mock_data.json",
    )

    with open(data_path, "r") as f:
        json_data = json.load(f)

    sources = []
    items = json_data.get("collection", {}).get("items", [])

    for idx, item in enumerate(items, start=1):
        data = item.get("data", [{}])[0]
        links = item.get("links", [])

        image_url = None
        for link in links:
            if link.get("render") == "image":
                image_url = link.get("href")
                break

        name = data.get("title", f"NASA Item {idx}")
        keywords = _keywords(data.get("keywords"))
        description = data.get("description") or ""
        title_tokens, keyword_tokens, description_tokens = field_tokens(name, keywords, description)
        sources.append(
            SourceModel(
                id=idx,
                name=name,
                type=data.get("media_type", "unknown"),
                launch_date=data.get("date_created", ""),
                center=data.get("center") or "",
                description=description,
                image_url=image_url,
                status="Active",
                keywords=keywords,
                nasa_id=data.get("nasa_id"),
                title_tokens=title_tokens,
                keyword_tokens=keyword_tokens,
                description_tokens=description_tokens,
            )
        )

    async with AsyncSessionLocal() as session:
        session.add_all(sources)
        await session.commit()
        print(f"Successfully seeded {len(sources)} sources into the database.")


if __name__ == "__main__":
    asyncio.run(seed_database())

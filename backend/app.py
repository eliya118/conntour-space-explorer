import asyncio
import os
from contextlib import asynccontextmanager

from alembic import command
from alembic.config import Config
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from controllers import search_router, source_router


def _upgrade_database() -> None:
    """Apply versioned migrations. env.py holds the advisory lock."""
    root = os.path.dirname(__file__)
    config = Config(os.path.join(root, "alembic.ini"))
    config.set_main_option("script_location", os.path.join(root, "alembic"))
    command.upgrade(config, "head")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Apply database migrations before serving requests."""
    await asyncio.to_thread(_upgrade_database)
    yield


app = FastAPI(
    title="Space Explorer API",
    description="API for browsing NASA images",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(source_router)
app.include_router(search_router)

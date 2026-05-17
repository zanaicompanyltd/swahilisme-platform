"""
backend/db/database.py

Database engine — switches between Supabase (PostgreSQL) and SQLite
based on environment variables.

Set in your .env:
    DB_MODE=postgres
    DATABASE_URL=postgresql+asyncpg://...

Leave blank or set DB_MODE=sqlite for local offline development.
"""
import os
import sys

# ── Path fix: works whether you run from project root OR from backend/ ────────
_this_dir = os.path.dirname(os.path.abspath(__file__))
_backend_dir = os.path.dirname(_this_dir)
_project_root = os.path.dirname(_backend_dir)
for _p in [_project_root, _backend_dir]:
    if _p not in sys.path:
        sys.path.insert(0, _p)
# ─────────────────────────────────────────────────────────────────────────────

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.pool import StaticPool, NullPool

# Import Base + all models so create_all() knows every table
from backend.models.ledger import Base  # noqa: F401 — registers all models

# ── Read environment ──────────────────────────────────────────────────────────
DB_MODE      = os.getenv("DB_MODE", "sqlite")          # "sqlite" | "postgres"
SQLITE_URL   = os.getenv("SQLITE_URL",  "sqlite+aiosqlite:///./daftari.db")
POSTGRES_URL = os.getenv("DATABASE_URL", "")           # Supabase URL (asyncpg)


def _build_engine():
    if DB_MODE == "postgres" and POSTGRES_URL:
        print(f"[DB] Connecting to Supabase PostgreSQL (pooler)")
        return create_async_engine(
            POSTGRES_URL,
            echo=False,
            # NullPool is required for Supabase connection pooler (port 6543)
            # because the pooler manages its own connection pool
            poolclass=NullPool,
        )

    # ── SQLite offline fallback ────────────────────────────────────────────
    print(f"[DB] Using SQLite offline: {SQLITE_URL}")
    return create_async_engine(
        SQLITE_URL,
        echo=False,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )


engine = _build_engine()

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
    autocommit=False,
)


async def init_db():
    """
    Create all tables on startup IF they don't exist yet.
    Safe to call even when tables already exist in Supabase.
    """
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_db():
    """FastAPI dependency — yields one async session per request."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()

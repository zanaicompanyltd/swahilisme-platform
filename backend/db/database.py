"""
backend/db/database.py — Single source of truth for SQLAlchemy Base and engine.
All models must import Base from here. Never create their own Base.
"""

import os
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import declarative_base
from sqlalchemy.pool import StaticPool, NullPool

# ── Environment ───────────────────────────────────────────────────────────────
DB_MODE      = os.getenv("DB_MODE", "sqlite")
SQLITE_URL   = os.getenv("SQLITE_URL", "sqlite+aiosqlite:///./daftari.db")
POSTGRES_URL = os.getenv("DATABASE_URL", "")

# ── ONE Base shared by ALL models — defined BEFORE any model imports ──────────
Base = declarative_base()

# ── Engine ────────────────────────────────────────────────────────────────────
def _build_engine():
    if DB_MODE == "postgres" and POSTGRES_URL:
        print("[DB] Connecting to Supabase PostgreSQL")
        return create_async_engine(
            POSTGRES_URL,
            echo=False,
            poolclass=NullPool,
            # 💡 Added connect_args to disable the statement cache for PgBouncer compatibility
            connect_args={
                "prepared_statement_cache_size": 0
            },
        )
    print(f"[DB] Using SQLite: {SQLITE_URL}")
    return create_async_engine(
        SQLITE_URL,
        echo=False,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

# ── Dependencies ──────────────────────────────────────────────────────────────
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

# ── Table creation ────────────────────────────────────────────────────────────
async def init_db():
    """Create all tables on startup. Import models here to register them."""
    # Import models HERE (inside the function) to avoid circular imports
    import models.ledger  # noqa: F401
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

def create_all_tables():
    """Sync version — only used if needed outside async context."""
    import models.ledger  # noqa: F401
    from sqlalchemy import create_engine as _sync_engine
    sync_url = SQLITE_URL.replace("sqlite+aiosqlite", "sqlite") if "sqlite" in SQLITE_URL else POSTGRES_URL
    _engine = _sync_engine(sync_url, connect_args={"check_same_thread": False} if "sqlite" in sync_url else {})
    Base.metadata.create_all(bind=_engine)

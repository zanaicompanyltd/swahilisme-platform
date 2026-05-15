"""
backend/db/database.py
Dual-database setup: SQLite (offline) + PostgreSQL / Supabase (production)
Automatically switches based on DB_MODE environment variable.
"""
import os
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.pool import StaticPool

try:
    from models.ledger import Base
except ModuleNotFoundError:
    import sys
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))
    from backend.models.ledger import Base

# ── Config ────────────────────────────────────────────────────────────────────
DB_MODE     = os.getenv("DB_MODE", "sqlite")
SQLITE_URL  = os.getenv("SQLITE_URL", "sqlite+aiosqlite:///./daftari.db")
POSTGRES_URL = os.getenv("_URL", "")


def _build_engine():
    if DB_MODE == "postgres" and POSTGRES_URL:
        return create_async_engine(
            POSTGRES_URL,
            echo=False,
            pool_size=5,
            max_overflow=10,
            # Supabase closes idle connections after ~5 min; keep-alive prevents that
            pool_pre_ping=True,
            pool_recycle=300,
        )
    # SQLite – offline-first default
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
    """Create all tables on startup."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_db() -> AsyncSession:
    """FastAPI dependency – yields a DB session."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()

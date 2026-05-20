"""
backend/db/database.py — Single source of truth for SQLAlchemy Base and engine.
All models must import Base from here. Never create their own Base.
"""
import os
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import declarative_base
from sqlalchemy.pool import StaticPool, NullPool

# ── Environment ───────────────────────────────────────────────────────────────
DB_MODE      = os.getenv("DB_MODE", "postgresql")
SQLITE_URL   = os.getenv("SQLITE_URL", "sqlite+aiosqlite:///./daftari.db")
POSTGRES_URL = os.getenv("DATABASE_URL", "")

# ── ONE Base shared by ALL models ─────────────────────────────────────────────
Base = declarative_base()


# ── Engine Builder ────────────────────────────────────────────────────────────
def _build_engine():
    # ✅ Check for both "postgresql" and "postgres" to be safe
    if POSTGRES_URL and DB_MODE in ("postgresql", "postgres"):

        # ✅ Fix URL scheme: Supabase gives postgresql:// but asyncpg needs postgresql+asyncpg://
        url = POSTGRES_URL
        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql+asyncpg://", 1)
        elif url.startswith("postgresql://") and "+asyncpg" not in url:
            url = url.replace("postgresql://", "postgresql+asyncpg://", 1)

        print(f"[DB] Connecting to Supabase PostgreSQL")
        return create_async_engine(
            url,
            echo=False,
            poolclass=NullPool,   # NullPool is best for serverless/Railway
        )

    # ── SQLite fallback (local dev only) ──────────────────────────────────────
    print(f"[DB] Using SQLite: {SQLITE_URL}")
    return create_async_engine(
        SQLITE_URL,
        echo=False,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )


# ── Global engine ─────────────────────────────────────────────────────────────
engine = _build_engine()

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
    autocommit=False,
)


# ── FastAPI dependency ────────────────────────────────────────────────────────
async def get_db():
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
    """Create all tables on startup."""
    import models.ledger  # noqa — registers Transaction etc. on Base
    import models.user    # noqa — registers User, OTPCode on Base
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("[DB] Tables ready")


def create_all_tables():
    """Sync fallback — not used in production."""
    pass

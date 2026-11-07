"""
backend/db/database.py — Single source of truth for SQLAlchemy Base and engine.
All models must import Base from here. Never create their own Base.
"""
import os
import sqlalchemy as sa
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


# ── Additive schema upgrades ──────────────────────────────────────────────────
# create_all() creates missing TABLES but never adds COLUMNS to a table that
# already exists. Railway/Supabase already has a `users` table from the OTP
# era, so newly added columns must be applied explicitly. Every entry here is
# additive and nullable, so existing rows and data are untouched.
_ADDITIVE_COLUMNS = {
    "users": {"password_hash": "VARCHAR(255)"},
}


def _apply_additive_columns(sync_conn):
    inspector = sa.inspect(sync_conn)
    existing_tables = set(inspector.get_table_names())
    is_postgres = sync_conn.dialect.name == "postgresql"

    for table, columns in _ADDITIVE_COLUMNS.items():
        if table not in existing_tables:
            continue                      # create_all() just made it, fully formed
        present = {c["name"] for c in inspector.get_columns(table)}
        for column, column_type in columns.items():
            if column in present:
                continue
            ddl = f"ALTER TABLE {table} ADD COLUMN {column} {column_type}"
            if is_postgres:
                ddl = f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {column} {column_type}"
            sync_conn.execute(sa.text(ddl))
            print(f"[DB] Added column {table}.{column}")


# ── Table creation ────────────────────────────────────────────────────────────
async def init_db():
    """Create all tables on startup and apply safe additive upgrades."""
    import models.ledger  # noqa — registers Transaction etc. on Base
    import models.user    # noqa — registers User, OTPCode on Base
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # SAVEPOINT: a failed upgrade rolls back only the upgrade, never the
        # table creation. (A second engine.begin() deadlocks the single
        # StaticPool connection used by the SQLite dev fallback.)
        try:
            async with conn.begin_nested():
                await conn.run_sync(_apply_additive_columns)
        except Exception as exc:                  # pragma: no cover
            print(f"[DB] WARNING: additive schema upgrade skipped: {exc}")
    print("[DB] Tables ready")


def create_all_tables():
    """Sync fallback — not used in production."""
    pass

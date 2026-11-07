"""
SwahiliSME Platform — FastAPI Backend
"""
import os
import sys
import logging
from contextlib import asynccontextmanager

# ✅ Load .env FIRST — before anything else reads environment variables
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# ✅ Import DB setup
from db.database import engine, init_db

# ✅ Import all models so SQLAlchemy registers them on Base before init_db runs
import models  # noqa: F401 — triggers backend/models/__init__.py

# ✅ Import routers AFTER env vars are loaded
from api.routes.auth      import router as auth_router
from api.routes.daftari   import router as daftari_router
from api.routes.dashboard import router as dashboard_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("SwahiliSME Platform starting up...")
    try:
        await init_db()
        logger.info(f"Database ready — mode: {os.getenv('DB_MODE', 'postgresql')}")
    except Exception as e:
        logger.error(f"Database init failed: {e}")
        raise  # ← crash fast so Railway shows the real error
    yield
    logger.info("Shutting down")
    # Close pooled connections so aiosqlite/asyncpg worker threads exit and the
    # process terminates promptly on SIGTERM (Railway's deploy/restart).
    try:
        await engine.dispose()
    except Exception as exc:                      # pragma: no cover
        logger.warning("Engine dispose failed: %s", exc)


app = FastAPI(
    title="SwahiliSME Platform API",
    version="1.0.0",
    description="Daftari Yangu — Voice bookkeeping for Tanzanian SMEs",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],      # tighten in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(auth_router)
app.include_router(daftari_router)
app.include_router(dashboard_router)


@app.get("/", tags=["Root"])
async def root():
    return {
        "message":  "Karibu kwenye SwahiliSME Platform! 🇹🇿",
        "platform": "SwahiliSME",
        "version":  "1.0.0-MVP",
        "status":   "operational",
        "docs":     "/docs",
        "tagline":  "Teknolojia kwa Lugha Yetu",
    }


@app.get("/health", tags=["Health"])
async def health():
    return {
        "status":  "ok",
        "db_mode": os.getenv("DB_MODE", "postgresql"),
    }

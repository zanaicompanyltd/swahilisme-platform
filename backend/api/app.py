"""
SwahiliSME Platform — FastAPI Backend
Registers: dashboard (1.6), daftari (1.3), health
"""
import os
import sys
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# ── STEP 1: create engine + Base (no model imports yet) ──────────────────
from db.database import create_all_tables

# ── STEP 2: import all models via __init__ so they register on Base ───────
import models  # noqa: F401 — triggers backend/models/__init__.py

from api.routes.auth import router as auth_router

# Load .env file if python-dotenv is installed
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from db.database import init_db
from api.routes.dashboard import router as dashboard_router
from api.routes.daftari import router as daftari_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("SwahiliSME Platform starting up...")
    await init_db()
    db_mode = os.getenv("DB_MODE", "sqlite")
    logger.info(f"Database tables initialised - mode: {db_mode}")
    yield
    logger.info("Shutting down")


app = FastAPI(
    title="Swahilisme Platform API",
    version="1.0.0",
    description="Daftari Yangu — Voice bookkeeping for Tanzanian SMEs",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # tighten in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────
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
        "status": "ok",
        "db_mode": os.getenv("DB_MODE", "sqlite")
    }

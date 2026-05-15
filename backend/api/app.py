"""
backend/api/app.py
FastAPI application entrypoint for SwahiliSME - Daftari Yangu
"""
# ── Path fix: MUST be the very first thing before ANY other import ────────────
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
# ─────────────────────────────────────────────────────────────────────────────

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Load .env file if python-dotenv is installed
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from backend.db.database import init_db
from backend.api.routes.daftari import router as daftari_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("SwahiliSME Daftari Yangu starting up...")
    await init_db()
    db_mode = os.getenv("DB_MODE", "sqlite")
    logger.info(f"Database tables initialised - mode: {db_mode}")
    yield
    logger.info("Shutting down")


app = FastAPI(
    title="SwahiliSME - Daftari Yangu API",
    description=(
        "Module 1: AI-powered voice bookkeeping for East African SMEs.\n\n"
        "Teknolojia kwa Lugha Yetu, Mafanikio kwa Biashara Zetu."
    ),
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS
allowed_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routes
app.include_router(daftari_router)


@app.get("/", tags=["Health"])
async def root():
    return {
        "app": "SwahiliSME - Daftari Yangu",
        "version": "1.0.0",
        "status": "running",
        "db_mode": os.getenv("DB_MODE", "sqlite"),
        "docs": "/docs",
        "tagline": "Teknolojia kwa Lugha Yetu",
    }


@app.get("/health", tags=["Health"])
async def health():
    return {"status": "ok", "db_mode": os.getenv("DB_MODE", "sqlite")}
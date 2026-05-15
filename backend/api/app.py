"""
backend/api/app.py
FastAPI application entrypoint for SwahiliSME Platform
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
from backend.api.routes.dashboard import router as dashboard_router

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
    title="SwahiliSME Platform API",
    description=(
        "AI-powered Swahili business management for East African SMEs.\n\n"
        "Teknolojia kwa Lugha Yetu, Mafanikio kwa Biashara Zetu."
    ),
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS - Allow your Vercel frontend
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,https://swahilisme-platform.vercel.app,https://swahilisme-platform-ax7sue4i8-zanai.vercel.app,https://*.vercel.app")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in ALLOWED_ORIGINS.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routes
app.include_router(dashboard_router, prefix="/api/v1/dashboard", tags=["Dashboard"])

@app.get("/", tags=["Health"])
async def root():
    return {
        "app": "SwahiliSME Platform",
        "version": "1.0.0",
        "status": "running",
        "db_mode": os.getenv("DB_MODE", "sqlite"),
        "docs": "/docs",
        "tagline": "Teknolojia kwa Lugha Yetu",
    }

@app.get("/health", tags=["Health"])
async def health():
    return {"status": "ok", "db_mode": os.getenv("DB_MODE", "sqlite")}

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.routes import dashboard

app = FastAPI(
    title="SwahiliSME Platform API",
    description="AI-powered Swahili business management for SMEs in East Africa",
    version="1.0.0-MVP",
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS — allow Vercel frontend + local dev
ALLOWED_ORIGINS = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:3000,https://*.vercel.app"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten in production with ALLOWED_ORIGINS
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routes ───────────────────────────────────────────────────────────────────
app.include_router(
    dashboard.router,
    prefix="/api/v1/dashboard",
    tags=["📊 Dashboard Analytics"],
)

# ── Root endpoints ────────────────────────────────────────────────────────────
@app.get("/", tags=["Root"])
async def root():
    return {
        "message": "Karibu kwenye SwahiliSME Platform! 🇹🇿",
        "platform": "SwahiliSME",
        "version": "1.0.0-MVP",
        "status": "operational",
        "docs": "/docs",
        "tagline": "Teknolojia kwa Lugha Yetu",
    }

@app.get("/health", tags=["Root"])
async def health():
    return {
        "status": "healthy",
        "platform": "SwahiliSME",
    }


"""
backend/api/app.py
FastAPI application entrypoint for SwahiliSME – Daftari Yangu
"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend.db.database import init_db
from backend.api.routes.daftari import router as daftari_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 SwahiliSME Daftari Yangu starting up…")
    await init_db()
    logger.info("✅ Database tables initialised")
    yield
    logger.info("👋 Shutting down")


app = FastAPI(
    title="SwahiliSME – Daftari Yangu API",
    description=(
        "Module 1: AI-powered voice bookkeeping for East African SMEs.\n\n"
        "Teknolojia kwa Lugha Yetu, Mafanikio kwa Biashara Zetu."
    ),
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── CORS ──────────────────────────────────────────────────────────────────────
import os
allowed_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routes ────────────────────────────────────────────────────────────────────
app.include_router(daftari_router)


@app.get("/", tags=["Health"])
async def root():
    return {
        "app": "SwahiliSME – Daftari Yangu",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs",
        "tagline": "Teknolojia kwa Lugha Yetu 🇹🇿",
    }


@app.get("/health", tags=["Health"])
async def health():
    return {"status": "ok"}

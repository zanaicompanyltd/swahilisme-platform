"""
SwahiliSME Platform — FastAPI Backend
Registers: dashboard (1.6), daftari (1.3), health
"""
import os
import os
import sys
import logging  # ← add this line
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# ── STEP 1: create engine + Base (no model imports yet) ──────────────────
from db.database import create_all_tables

# ── STEP 2: import all models via __init__ so they register on Base ───────
import backend.models  # noqa: F401 — triggers backend/models/__init__.py


# Load .env file if python-dotenv is installed
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

fromdb.database import init_db
fromapi.routes.dashboard import router as dashboard_router
fromapi.routes.daftari import router as daftari_router

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

@app.on_event("startup")
def on_startup():
    """Create all DB tables on first run."""
    create_all_tables()
@app.get("/health", tags=["Root"])

@app.get("/health", tags=["Health"])
async def health():
    return {"status": "ok", "db_mode": os.getenv("DB_MODE", "sqlite")}
    # Check DB connectivity
    try:
        from api.routes.dashboard import get_db
        conn = get_db()
        db_status = "connected" if conn else "no DATABASE_URL"
        if conn:
            conn.close()
    except Exception as e:
        db_status = f"error: {str(e)}"
    return {"status": "healthy", "database": db_status}


@app.get("/health")
def health():
    return {"status": "ok", "service": "swahilisme-api"}

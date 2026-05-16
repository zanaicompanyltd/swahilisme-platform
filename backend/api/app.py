"""
SwahiliSME Platform — FastAPI Backend
Registers: dashboard (1.6), daftari (1.3), health
"""
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.routes import dashboard, daftari

# Load .env file if python-dotenv is installed
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from backend.db.database import init_db
from backend.api.routes.dashboard import router as dashboard_router
from backend.api.routes.daftari import router as daftari_router

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
    description="AI-powered Swahili business management for SMEs in East Africa",
    version="1.0.0-MVP",
    docs_url="/docs",
)

# CORS - Allow your Vercel frontend
ALLOWED_ORIGINS = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:3000,https://swahilisme-platform.vercel.app,https://swahilisme-platform-ax7sue4i8-zanai.vercel.app,https://*.vercel.app"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routes
app.include_router(dashboard_router, prefix="/api/v1/dashboard", tags=["Dashboard"])
app.include_router(daftari_router)   # already has prefix="/api/v1/daftari" in its own file

# ── Routes ────────────────────────────────────────────────────────────────────
app.include_router(dashboard.router, prefix="/api/v1/dashboard", tags=["📊 Analytics Dashboard"])
app.include_router(daftari.router,   prefix="/api/v1/daftari",   tags=["📒 Daftari Yangu"])

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

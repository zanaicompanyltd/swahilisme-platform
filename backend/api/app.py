import os
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Load environment variables
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# Correct imports (no 'backend.' prefix)
from db.database import init_db
from api.routes.dashboard import router as dashboard_router
# Import other routers as needed

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("SwahiliSME Platform starting up...")
    await init_db()
    yield
    logger.info("Shutting down")

app = FastAPI(
    title="SwahiliSME Platform API",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # Tighten this later
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(dashboard_router, prefix="/api/v1/dashboard", tags=["Dashboard"])

@app.get("/health")
async def health():
    return {"status": "ok"}

@app.get("/")
async def root():
    return {"app": "SwahiliSME Platform", "status": "running"}

"""
SwahiliSME Platform — FastAPI Backend
"Teknolojia kwa Lugha Yetu, Mafanikio kwa Biashara Zetu"

Entry point for Railway deployment.
"""
import os
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

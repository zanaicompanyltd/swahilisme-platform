"""
SwahiliSME Platform — FastAPI Backend
Registers: dashboard (1.6), daftari (1.3), health
"""
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.routes import dashboard, daftari

app = FastAPI(
    title="SwahiliSME Platform API",
    description="AI-powered Swahili business management for SMEs in East Africa",
    version="1.0.0-MVP",
    docs_url="/docs",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
async def health():
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

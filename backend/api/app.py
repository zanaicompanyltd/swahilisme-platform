from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.api.routes import dashboard

app = FastAPI(
    title="SwahiliSME Platform API",
    description="AI-powered Swahili business management for SMEs",
    version="1.0.0-MVP"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routes
app.include_router(dashboard.router, prefix="/api/v1/dashboard", tags=["Dashboard"])

@app.get("/")
async def root():
    return {
        "message": "Karibu kwenye SwahiliSME Platform!",
        "status": "operational",
        "version": "1.0.0-MVP"
    }

@app.get("/health")
async def health():
    return {"status": "healthy"}

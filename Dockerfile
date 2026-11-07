# syntax=docker/dockerfile:1
FROM python:3.11-slim

# ── System libraries ─────────────────────────────────────────────────────────
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libcairo2 \
    && rm -rf /var/lib/apt/lists/*

# ── Python dependencies (own layer, cached until requirements change) ────────
WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# ── Application source ───────────────────────────────────────────────────────
COPY . .

# IMPORTANT — import root
# The backend modules import each other with *flat* top-level paths
# (db.database, models.user, services.otp_service, api.routes.auth).
# That convention means `backend/` itself must be on sys.path, not the repo
# root. Launching `uvicorn backend.api.app:app` from /app is what produced
# "ModuleNotFoundError: No module named 'db'" on Railway.
ENV PYTHONPATH=/app/backend \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1
WORKDIR /app/backend

EXPOSE 8000

# Exec form on purpose: /app/start.sh is executed directly (no shell needed),
# and it resolves $PORT itself. Railway does not always expand shell
# variables in its start command, which made `--port $PORT` reach uvicorn
# literally and crash with "Invalid value for '--port'".
RUN chmod +x /app/start.sh
CMD ["/app/start.sh"]

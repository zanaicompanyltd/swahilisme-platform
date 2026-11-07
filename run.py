# run.py  (project root) — local development launcher
#
# The backend modules import each other with FLAT top-level paths
# (db.database, models.user, services.otp_service, api.routes.auth), so the
# import root must be `backend/` — NOT the repository root. Putting the repo
# root on PYTHONPATH (the previous behaviour) made the app die with
# "ModuleNotFoundError: No module named 'db'".
import os
import sys

# ── Resolve import root (the `backend/` folder this file sits next to) ───────
PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
BACKEND_ROOT = os.path.join(PROJECT_ROOT, "backend")

# 1. Fix sys.path for THIS process
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)

# 2. Fix PYTHONPATH so every child process uvicorn spawns (reload=True)
#    inherits the same import root.
existing = os.environ.get("PYTHONPATH", "")
if BACKEND_ROOT not in existing.split(os.pathsep):
    os.environ["PYTHONPATH"] = BACKEND_ROOT + (os.pathsep + existing if existing else "")

# ─────────────────────────────────────────────────────────────────────────────
import uvicorn

if __name__ == "__main__":
    uvicorn.run(
        "api.app:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", "8000")),
        reload=True,
    )

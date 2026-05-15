# run.py  (project root)
import os
import sys

# ── Resolve project root (the folder this file lives in) ─────────────────────
PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))

# 1. Fix sys.path for THIS process
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

# 2. Fix PYTHONPATH so every child process uvicorn spawns (reload=True)
#    inherits the same path — this is the real fix for the subprocess error.
existing = os.environ.get("PYTHONPATH", "")
if PROJECT_ROOT not in existing.split(os.pathsep):
    os.environ["PYTHONPATH"] = PROJECT_ROOT + (os.pathsep + existing if existing else "")

# ─────────────────────────────────────────────────────────────────────────────
import uvicorn

if __name__ == "__main__":
    uvicorn.run(
        "backend.api.app:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
    )
"""
run.py  –  Launch SwahiliSME Daftari Yangu from the project root.

Usage:
    python run.py                  # default: uvicorn on port 8000
    python run.py --port 9000
    python run.py --reload         # hot-reload for development
"""
import sys
import os

# Ensure project root is on sys.path so `backend.*` imports resolve
sys.path.insert(0, os.path.dirname(__file__))

import argparse
import uvicorn

parser = argparse.ArgumentParser(description="Run Daftari Yangu API")
parser.add_argument("--host",   default="0.0.0.0")
parser.add_argument("--port",   default=8000, type=int)
parser.add_argument("--reload", action="store_true")
args = parser.parse_args()

if __name__ == "__main__":
    uvicorn.run(
        "backend.api.app:app",
        host=args.host,
        port=args.port,
        reload=args.reload,
    )
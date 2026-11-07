"""Regression tests for the backend import root.

The backend uses flat top-level imports (`db.database`, `models.user`,
`services.*`, `api.routes.*`), so `backend/` must be importable. These tests
run the real import in a **separate Python process** with `PYTHONPATH` removed
and the working directory set to the repository root — exactly the setup that
made the Railway deploy crash with `No module named 'db'`.

If `backend/api/app.py` / `backend/main.py` stop adding their own directory to
`sys.path`, these tests fail.
"""
import os
import pathlib
import subprocess
import sys

REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
BACKEND_DIR = REPO_ROOT / "backend"


def _clean_env() -> dict:
    env = {k: v for k, v in os.environ.items() if k != "PYTHONPATH"}
    env["DB_MODE"] = "sqlite"
    env["SQLITE_URL"] = "sqlite+aiosqlite:////tmp/swahilisme_import_root_test.db"
    return env


def _run(code: str, cwd: pathlib.Path) -> subprocess.CompletedProcess:
    return subprocess.run(
        [sys.executable, "-c", code],
        cwd=str(cwd),
        env=_clean_env(),
        capture_output=True,
        text=True,
        timeout=180,
    )


IMPORT_APP = (
    "import importlib\n"
    "m = importlib.import_module('backend.api.app')\n"
    "assert m.app is not None\n"
    "print('IMPORTED', type(m.app).__name__)\n"
)

IMPORT_MAIN = (
    "import importlib\n"
    "m = importlib.import_module('backend.main')\n"
    "assert m.app is not None\n"
    "print('IMPORTED', type(m.app).__name__)\n"
)


def test_app_imports_from_repo_root_without_pythonpath():
    """`uvicorn backend.api.app:app` from /app — the failing Railway case."""
    result = _run(IMPORT_APP, REPO_ROOT)
    assert result.returncode == 0, f"stdout={result.stdout}\nstderr={result.stderr}"
    assert "IMPORTED" in result.stdout
    assert "No module named 'db'" not in result.stderr


def test_app_imports_when_backend_dir_is_cwd():
    """`uvicorn api.app:app` from /app/backend (backend/Procfile style)."""
    code = (
        "import importlib\n"
        "m = importlib.import_module('api.app')\n"
        "assert m.app is not None\n"
        "print('IMPORTED', type(m.app).__name__)\n"
    )
    result = _run(code, BACKEND_DIR)
    assert result.returncode == 0, f"stdout={result.stdout}\nstderr={result.stderr}"
    assert "IMPORTED" in result.stdout


def test_legacy_main_imports_without_pythonpath():
    result = _run(IMPORT_MAIN, REPO_ROOT)
    assert result.returncode == 0, f"stdout={result.stdout}\nstderr={result.stderr}"
    assert "IMPORTED" in result.stdout


def test_routes_are_registered_after_import():
    """Sanity check that the hardened import path keeps every router."""
    code = (
        "import importlib\n"
        "m = importlib.import_module('backend.api.app')\n"
        "paths = sorted({r.path for r in m.app.routes})\n"
        "print('ROUTES', len(paths))\n"
        "assert '/auth/login' in paths, paths\n"
        "assert '/daftari/transactions' in paths, paths\n"
        "assert '/summary' in paths, paths\n"
        "assert '/health' in paths, paths\n"
        "assert not any('otp' in p for p in paths), paths\n"
    )
    result = _run(code, REPO_ROOT)
    assert result.returncode == 0, f"stdout={result.stdout}\nstderr={result.stderr}"

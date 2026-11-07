"""
CORS regression tests for the Vercel → Railway deployment.

The frontend is served from `https://*.vercel.app` and calls the API on
`https://*.up.railway.app`. If the browser preflight is rejected, or the
response carries no `Access-Control-Allow-Origin`, the UI shows a bare
"Failed to fetch" even though the backend is healthy.

Run from the repository root:

    pytest tests/integration/test_cors.py -q
"""
import os
import pathlib
import sys

import pytest

# ── Bootstrap: flat imports need `backend/` on sys.path ──────────────────────
REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
BACKEND = REPO_ROOT / "backend"
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

os.environ.setdefault("DB_MODE", "sqlite")
os.environ.setdefault("SQLITE_URL", "sqlite+aiosqlite:////tmp/swahilisme_cors_test.db")
os.environ.setdefault("JWT_SECRET_KEY", "integration-test-secret")

from fastapi.testclient import TestClient          # noqa: E402

from api.app import app                            # noqa: E402

ORIGIN = "https://swahilisme-platform.vercel.app"


@pytest.fixture(scope="module")
def client():
    pathlib.Path("/tmp/swahilisme_cors_test.db").unlink(missing_ok=True)
    with TestClient(app) as c:
        yield c


def test_preflight_for_login_is_allowed(client):
    res = client.options(
        "/auth/login",
        headers={
            "Origin": ORIGIN,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
    )
    assert res.status_code == 200
    assert res.headers["access-control-allow-origin"] in (ORIGIN, "*")
    assert "POST" in res.headers["access-control-allow-methods"]
    assert "content-type" in res.headers["access-control-allow-headers"].lower()


def test_login_response_carries_cors_header(client):
    res = client.post(
        "/auth/login",
        json={"phone_number": "+255712000000", "password": "WrongPassword1"},
        headers={"Origin": ORIGIN},
    )
    assert res.status_code == 401            # credentials rejected, CORS still OK
    assert res.headers.get("access-control-allow-origin") in (ORIGIN, "*")


def test_register_response_carries_cors_header(client):
    res = client.post(
        "/auth/register",
        json={
            "phone_number": "+255713111222",
            "full_name": "CORS Test",
            "password": "StrongPass123",
        },
        headers={"Origin": ORIGIN},
    )
    assert res.status_code == 201, res.text
    assert res.headers.get("access-control-allow-origin") in (ORIGIN, "*")
    assert "access_token" in res.json()


def test_health_endpoint_is_reachable_for_the_probe(client):
    """The login page pings /health to detect an unreachable backend."""
    res = client.get("/health", headers={"Origin": ORIGIN})
    assert res.status_code == 200
    assert res.json()["status"] == "ok"
    assert res.headers.get("access-control-allow-origin") in (ORIGIN, "*")

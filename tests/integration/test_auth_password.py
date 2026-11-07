"""
Integration tests for the password-based auth flow (post-OTP removal).

These exercise the real FastAPI app, the real SQLAlchemy engine and real
bcrypt hashing — no mocking of the database or the hasher.

Run from the repository root:

    pytest tests/integration/test_auth_password.py -q

The tests use a throwaway SQLite database (the DB_MODE=sqlite fallback) unless
DATABASE_URL/DB_MODE are already set in the environment.
"""
import os
import pathlib
import sqlite3
import sys

import pytest

# ── Bootstrap: flat imports need `backend/` on sys.path ──────────────────────
REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
BACKEND = REPO_ROOT / "backend"
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

TEST_DB = pathlib.Path("/tmp/swahilisme_auth_test.db")
os.environ.setdefault("DB_MODE", "sqlite")
os.environ.setdefault("SQLITE_URL", f"sqlite+aiosqlite:///{TEST_DB}")
os.environ.setdefault("JWT_SECRET_KEY", "integration-test-secret")

from fastapi.testclient import TestClient          # noqa: E402

from api.app import app                            # noqa: E402

PW = "StrongPass123"
NEW_PW = "NewStrong456"


@pytest.fixture(scope="module")
def client():
    TEST_DB.unlink(missing_ok=True)
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="module")
def db_path():
    return str(TEST_DB)


def sql(db_path, statement, params=()):
    con = sqlite3.connect(db_path)
    try:
        cur = con.execute(statement, params)
        con.commit()
        return cur.fetchall()
    finally:
        con.close()


def register(client, phone="+255712000111", password=PW, **extra):
    payload = {"phone_number": phone, "full_name": "Mama Zena", "password": password}
    payload.update(extra)
    return client.post("/auth/register", json=payload)


# ── 1. Route surface ─────────────────────────────────────────────────────────
def test_otp_endpoints_are_gone(client):
    paths = client.get("/openapi.json").json()["paths"]
    assert "/auth/send-otp" not in paths
    assert "/auth/verify-otp" not in paths
    for legacy in ("/auth/send-otp", "/auth/verify-otp"):
        assert client.post(legacy, json={"phone_number": "+255712000111"}).status_code == 404


def test_password_endpoints_exist(client):
    paths = client.get("/openapi.json").json()["paths"]
    for route in ("/auth/register", "/auth/login", "/auth/refresh", "/auth/me", "/auth/set-password"):
        assert route in paths, route


def test_health(client):
    assert client.get("/health").json()["status"] == "ok"


# ── 2. Registration ──────────────────────────────────────────────────────────
def test_register_returns_tokens_and_hides_hash(client):
    r = register(client)
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["access_token"] and body["refresh_token"]
    # phone normalised to E.164
    assert body["user"]["phone_number"] == "+255712000111"
    assert body["user"]["has_password"] is True
    # the hash must never leave the server
    assert "password_hash" not in r.text


def test_register_rejects_duplicate_phone(client):
    r = register(client, phone="+255712000111")
    assert r.status_code == 409
    assert set(r.json()["detail"]) >= {"sw", "en"}


def test_register_rejects_weak_password(client):
    r = register(client, phone="+255712000333", password="short")
    assert r.status_code == 422


def test_register_rejects_invalid_phone(client):
    r = register(client, phone="not-a-phone")
    assert r.status_code == 422


# ── 3. Login ─────────────────────────────────────────────────────────────────
def test_login_with_correct_password(client):
    r = client.post("/auth/login", json={"phone_number": "+255712000111", "password": PW})
    assert r.status_code == 200, r.text
    assert r.json()["access_token"]
    assert "password_hash" not in r.text


def test_login_with_wrong_password(client):
    r = client.post("/auth/login", json={"phone_number": "+255712000111", "password": "WrongPass1"})
    assert r.status_code == 401


def test_login_does_not_reveal_whether_an_account_exists(client):
    wrong = client.post("/auth/login", json={"phone_number": "+255712000111", "password": "WrongPass1"})
    unknown = client.post("/auth/login", json={"phone_number": "+255799999999", "password": "WrongPass1"})
    assert wrong.status_code == unknown.status_code == 401
    assert wrong.json()["detail"] == unknown.json()["detail"]


# ── 4. Protected route ───────────────────────────────────────────────────────
def test_me_requires_token(client):
    assert client.get("/auth/me").status_code == 401
    assert client.get("/auth/me", headers={"Authorization": "Bearer nope"}).status_code == 401


def test_me_returns_the_authenticated_user(client):
    token = client.post("/auth/login", json={"phone_number": "+255712000111", "password": PW}).json()["access_token"]
    r = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    assert r.json()["phone_number"] == "+255712000111"
    assert "password_hash" not in r.text


# ── 5. Refresh ───────────────────────────────────────────────────────────────
def test_refresh_yields_usable_access_token(client):
    tokens = client.post("/auth/login", json={"phone_number": "+255712000111", "password": PW}).json()
    r = client.post("/auth/refresh", json={"refresh_token": tokens["refresh_token"]})
    assert r.status_code == 200
    fresh = r.json()["access_token"]
    assert client.get("/auth/me", headers={"Authorization": f"Bearer {fresh}"}).status_code == 200


def test_access_token_is_not_accepted_as_refresh_token(client):
    tokens = client.post("/auth/login", json={"phone_number": "+255712000111", "password": PW}).json()
    assert client.post("/auth/refresh", json={"refresh_token": tokens["access_token"]}).status_code == 401


# ── 6. Password change ───────────────────────────────────────────────────────
def test_set_password_requires_authentication(client):
    assert client.post("/auth/set-password", json={"new_password": NEW_PW}).status_code == 401


def test_set_password_requires_current_password(client):
    token = client.post("/auth/login", json={"phone_number": "+255712000111", "password": PW}).json()["access_token"]
    r = client.post("/auth/set-password",
                    json={"new_password": NEW_PW, "current_password": "wrong"},
                    headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 400


def test_change_password_switches_the_credential(client):
    token = client.post("/auth/login", json={"phone_number": "+255712000111", "password": PW}).json()["access_token"]
    r = client.post("/auth/set-password",
                    json={"new_password": NEW_PW, "current_password": PW},
                    headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200, r.text
    assert client.post("/auth/login", json={"phone_number": "+255712000111", "password": NEW_PW}).status_code == 200
    assert client.post("/auth/login", json={"phone_number": "+255712000111", "password": PW}).status_code == 401


# ── 7. Account isolation & suspension ───────────────────────────────────────
def test_tokens_resolve_to_their_own_user(client):
    r = register(client, phone="+255712000222")
    token_b = r.json()["access_token"]
    token_a = client.post("/auth/login", json={"phone_number": "+255712000111", "password": NEW_PW}).json()["access_token"]
    me_a = client.get("/auth/me", headers={"Authorization": f"Bearer {token_a}"}).json()
    me_b = client.get("/auth/me", headers={"Authorization": f"Bearer {token_b}"}).json()
    assert me_a["phone_number"] == "+255712000111"
    assert me_b["phone_number"] == "+255712000222"


def test_suspended_account_cannot_log_in(client, db_path):
    token = register(client, phone="+255712000555").json()["access_token"]
    sql(db_path, "UPDATE users SET status = 'suspended' WHERE id = ?", ("+255712000555",))
    r = client.post("/auth/login", json={"phone_number": "+255712000555", "password": PW})
    assert r.status_code == 401
    assert r.json()["detail"]["en"] == "Account suspended."
    # an existing token stops working too
    assert client.get("/auth/me", headers={"Authorization": f"Bearer {token}"}).status_code == 401


# ── 8. Data preservation & legacy accounts ──────────────────────────────────
def test_otp_table_is_preserved(client, db_path):
    tables = [r[0] for r in sql(db_path, "SELECT name FROM sqlite_master WHERE type='table'")]
    assert "otp_codes" in tables          # removed from the flow, NOT from the DB
    assert "users" in tables


def test_password_is_stored_only_as_a_bcrypt_hash(client, db_path):
    rows = sql(db_path, "SELECT password_hash FROM users WHERE id = ?", ("+255712000111",))
    stored = rows[0][0]
    assert stored.startswith("$2b$")
    assert NEW_PW not in stored


def test_legacy_account_without_password_can_be_migrated(client, db_path, monkeypatch):
    legacy = "+255713000001"
    sql(db_path,
        "INSERT INTO users (id, phone_number, name, phone_verified, status, email_verified) "
        "VALUES (?, ?, 'Legacy User', 1, 'active', 0)", (legacy, legacy))

    # Cannot log in without a password…
    assert client.post("/auth/login", json={"phone_number": legacy, "password": "anything1"}).status_code == 401

    # …but can set one while holding a valid token (the migration path).
    from services.auth_service import create_access_token
    token = create_access_token(legacy, legacy)
    r = client.post("/auth/set-password",
                    json={"new_password": "LegacyPass789"},
                    headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200, r.text
    assert client.post("/auth/login", json={"phone_number": legacy, "password": "LegacyPass789"}).status_code == 200

"""
Auth Routes — Swahilisme Platform

POST /auth/register        — create an account (phone + password)
POST /auth/login           — phone + password → JWT tokens
POST /auth/refresh         — exchange refresh token for a new access token
POST /auth/set-password    — set/change password (Bearer token required)
GET  /auth/me              — current user (Bearer token required)

The SMS/WhatsApp OTP flow (POST /auth/send-otp, POST /auth/verify-otp) has
been removed: passwords are now the authentication factor.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Header
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
import re

from db.database import get_db
from services.auth_service import (
    AuthError,
    PASSWORD_MAX_BYTES,
    PASSWORD_MIN_LENGTH,
    authenticate_user,
    get_current_user,
    issue_tokens,
    normalize_phone,
    refresh_access_token,
    register_user,
    set_user_password,
    validate_password_strength,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])

# ── Shared error messages (bilingual, no internal detail leaked) ──────────
MSG = {
    "invalid_credentials":       {"sw": "Nambari ya simu au nenosiri si sahihi.", "en": "Invalid phone number or password."},
    "account_suspended":         {"sw": "Akaunti imezuiwa.",                     "en": "Account suspended."},
    "invalid_token":             {"sw": "Token si halali.",                      "en": "Invalid token."},
    "user_not_found":            {"sw": "Mtumiaji hakupatikana.",                "en": "User not found."},
    "phone_already_registered":  {"sw": "Nambari hii imeshasajiliwa.",           "en": "Phone number already registered."},
    "email_already_registered":  {"sw": "Barua pepe hii imeshasajiliwa.",        "en": "Email already registered."},
    "weak_password":             {"sw": f"Nenosiri lazima liwe na herufi {PASSWORD_MIN_LENGTH} au zaidi.",
                                  "en": f"Password must be at least {PASSWORD_MIN_LENGTH} characters."},
    "password_too_long":         {"sw": f"Nenosiri ni refu mno (herufi {PASSWORD_MAX_BYTES} kwa juu).",
                                  "en": f"Password is too long (max {PASSWORD_MAX_BYTES} bytes)."},
    "invalid_current_password":  {"sw": "Nenosiri la sasa si sahihi.",           "en": "Current password is incorrect."},
    "invalid_refresh_token":     {"sw": "Token ya kuongeza muda si halali.",     "en": "Invalid refresh token."},
}

TZ_PHONE_RE = re.compile(r"^(\+?255|0)\d{9}$")


def _normalize_and_validate_phone(raw: str) -> str:
    """Normalise to E.164 and reject anything that isn't a TZ mobile number."""
    cleaned = re.sub(r"[\s\-\(\)]", "", raw or "")
    if not TZ_PHONE_RE.match(cleaned):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"sw": "Nambari ya simu si sahihi.", "en": "Invalid phone number."},
        )
    return normalize_phone(cleaned)


def _error(code: str, http_status: int) -> HTTPException:
    return HTTPException(status_code=http_status, detail=MSG.get(code, {"sw": "Hitilafu.", "en": "Error."}))


async def _current_user_from_header(authorization: str, db: AsyncSession):
    """Resolve the caller from an `Authorization: Bearer <token>` header."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=MSG["invalid_token"])
    token = authorization.split(" ", 1)[1].strip()
    try:
        return await get_current_user(token, db)
    except AuthError as exc:
        code = "account_suspended" if exc.code == "account_suspended" else "invalid_token"
        raise _error(code, status.HTTP_401_UNAUTHORIZED)


# ── Pydantic schemas ───────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    phone_number:      str
    full_name:         str = Field(..., min_length=2, max_length=150)
    password:          str = Field(..., min_length=PASSWORD_MIN_LENGTH, max_length=PASSWORD_MAX_BYTES)
    business_name:     Optional[str] = None
    business_category: Optional[str] = None
    location:          Optional[str] = None
    email:             Optional[str] = None
    preferred_lang:    str = "sw"


class LoginRequest(BaseModel):
    phone_number: str
    password:     str


class RefreshRequest(BaseModel):
    refresh_token: str


class SetPasswordRequest(BaseModel):
    new_password:     str = Field(..., min_length=PASSWORD_MIN_LENGTH, max_length=PASSWORD_MAX_BYTES)
    current_password: Optional[str] = None


# ── Endpoints ─────────────────────────────────────────────────────────────

@router.post("/register", summary="Jisajili / Register", status_code=status.HTTP_201_CREATED)
async def api_register(body: RegisterRequest, db: AsyncSession = Depends(get_db)):
    """
    Create an account with a password and return JWT tokens immediately.
    No OTP/phone verification step is involved.
    """
    phone = _normalize_and_validate_phone(body.phone_number)

    try:
        user = await register_user(
            phone_number      = phone,
            full_name         = body.full_name,
            db                = db,
            password          = body.password,
            business_name     = body.business_name or "",
            business_category = body.business_category or "",
            location          = body.location or "",
            email             = body.email or "",
            preferred_lang    = body.preferred_lang,
        )
    except ValueError as exc:
        code = str(exc)
        if code in ("phone_already_registered", "email_already_registered"):
            raise _error(code, status.HTTP_409_CONFLICT)
        # weak_password / password_too_long
        raise _error(code if code in MSG else "weak_password", status.HTTP_422_UNPROCESSABLE_ENTITY)

    return {
        "message": {"sw": "Umesajiliwa kwa mafanikio!", "en": "Registration successful!"},
        **issue_tokens(user),
    }


@router.post("/login", summary="Ingia / Login")
async def api_login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Verify phone + password and return JWT tokens."""
    phone = normalize_phone(body.phone_number or "")
    try:
        user = await authenticate_user(phone, body.password, db)
    except AuthError as exc:
        raise _error(exc.code, status.HTTP_401_UNAUTHORIZED)
    return issue_tokens(user)


@router.post("/refresh", summary="Ongeza muda wa token / Refresh token")
async def api_refresh(body: RefreshRequest, db: AsyncSession = Depends(get_db)):
    try:
        return await refresh_access_token(body.refresh_token, db)
    except ValueError:
        raise _error("invalid_refresh_token", status.HTTP_401_UNAUTHORIZED)


@router.post("/set-password", summary="Weka nenosiri / Set password")
async def api_set_password(
    body: SetPasswordRequest,
    authorization: str = Header(default=""),
    db: AsyncSession = Depends(get_db),
):
    """
    Set or change the password of the authenticated caller.

    This is the migration path for accounts created during the OTP-only era:
    a user who still holds a valid access token can give their account a
    password without any SMS. Without a token this endpoint is unreachable, so
    it cannot be used to take over someone else's account.
    """
    user = await _current_user_from_header(authorization, db)

    try:
        validate_password_strength(body.new_password)
        await set_user_password(
            user             = user,
            new_password     = body.new_password,
            db               = db,
            current_password = body.current_password,
        )
    except AuthError:
        raise _error("invalid_current_password", status.HTTP_400_BAD_REQUEST)
    except ValueError as exc:
        code = str(exc)
        raise _error(code if code in MSG else "weak_password", status.HTTP_422_UNPROCESSABLE_ENTITY)

    return {
        "message": {"sw": "Nenosiri limewekwa.", "en": "Password updated."},
        "user":    user.to_dict(),
    }


@router.get("/me", summary="Mtumiaji wa sasa / Current user")
async def api_me(
    authorization: str = Header(default=""),
    db: AsyncSession = Depends(get_db),
):
    user = await _current_user_from_header(authorization, db)
    return user.to_dict()

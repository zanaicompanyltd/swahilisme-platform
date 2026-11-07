"""
Auth Service — Swahilisme Platform

Password-based authentication (bcrypt) that issues JWT access/refresh tokens.
Phone number is the primary identifier; email is optional.

NOTE ON THE AUTH MODEL
----------------------
This platform previously authenticated users with a 6-digit SMS/WhatsApp OTP
and no password at all — possession of a phone number (plus an SMS round-trip)
was the only factor. That flow has been removed. Passwords are now the
credential: they are hashed with bcrypt and never stored or returned in clear.
"""

import os
import logging
import secrets
from datetime import datetime, timedelta
from typing import Optional

import bcrypt
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.user import User, UserStatus

logger = logging.getLogger(__name__)

# ── Config ────────────────────────────────────────────────────────────────
# A hard-coded fallback signing key would let anyone forge tokens, so when
# JWT_SECRET_KEY is not configured we generate a random per-process key and
# warn loudly. Tokens then stop working after a restart (users simply log in
# again) — far safer than a publicly known key.
_env_secret = (os.getenv("JWT_SECRET_KEY") or "").strip()
if not _env_secret:
    _env_secret = secrets.token_urlsafe(48)
    logger.warning(
        "JWT_SECRET_KEY is not set — using an ephemeral random key. "
        "Set JWT_SECRET_KEY in the environment so tokens survive restarts."
    )
SECRET_KEY         = _env_secret
ALGORITHM          = "HS256"
ACCESS_TOKEN_MINS  = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))
REFRESH_TOKEN_DAYS = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS",   "30"))

# ── Password policy ───────────────────────────────────────────────────────
PASSWORD_MIN_LENGTH = int(os.getenv("PASSWORD_MIN_LENGTH", "8"))
PASSWORD_MAX_BYTES  = 72          # bcrypt ignores input beyond 72 bytes

# bcrypt is used directly rather than through passlib: passlib 1.7.4's bcrypt
# backend self-test feeds a >72-byte secret to bcrypt>=4.1, which raises
# ValueError at import time. A pre-computed hash keeps startup fast.
_DUMMY_HASH = "$2b$12$e8kNN3wM4e93YTpJvpp20.DPBVmnuPbALwXqpCA56F4sLQqtLgAnS"


class AuthError(Exception):
    """Raised for authentication/authorisation failures. Code is mapped to a
    bilingual message in the route layer; nothing internal is leaked."""

    def __init__(self, code: str):
        super().__init__(code)
        self.code = code


# ── Phone helpers ─────────────────────────────────────────────────────────

def normalize_phone(phone: str) -> str:
    """
    Normalise to E.164, defaulting to +255 (Tanzania) when no country code.
        0712345678   → +255712345678
        255712...    → +255712...
        +255712...   → +255712...
    """
    phone = (phone or "").strip().replace(" ", "").replace("-", "").replace("(", "").replace(")", "")
    if phone.startswith("0"):
        return "+255" + phone[1:]
    if phone.startswith("255") and not phone.startswith("+"):
        return "+" + phone
    if not phone.startswith("+"):
        return "+255" + phone
    return phone


# ── Password helpers ──────────────────────────────────────────────────────

def validate_password_strength(password: str) -> None:
    """Raise ValueError('weak_password') when the password is unacceptable."""
    if not isinstance(password, str) or len(password) < PASSWORD_MIN_LENGTH:
        raise ValueError("weak_password")
    if len(password.encode("utf-8")) > PASSWORD_MAX_BYTES:
        raise ValueError("password_too_long")


def hash_password(password: str) -> str:
    """Hash a password with bcrypt (cost 12). Raises ValueError if too weak."""
    validate_password_strength(password)
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("ascii")


def verify_password(password: str, password_hash: Optional[str]) -> bool:
    """bcrypt checkpw (constant-time compare). Never raises on bad input."""
    if not password or not password_hash:
        return False
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("ascii"))
    except (ValueError, TypeError):
        return False


# ── Token helpers ─────────────────────────────────────────────────────────

def create_access_token(user_id: str, phone: str) -> str:
    payload = {
        "sub":   str(user_id),
        "phone": phone,
        "type":  "access",
        "exp":   datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_MINS),
        "iat":   datetime.utcnow(),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def create_refresh_token(user_id: str) -> str:
    payload = {
        "sub":  str(user_id),
        "type": "refresh",
        "exp":  datetime.utcnow() + timedelta(days=REFRESH_TOKEN_DAYS),
        "iat":  datetime.utcnow(),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError as exc:
        logger.debug("Token decode failed: %s", exc)
        return None


def issue_tokens(user: User) -> dict:
    """Build the standard login/registration response for a user."""
    return {
        "needs_registration": False,
        "access_token":       create_access_token(user.id, user.phone_number),
        "refresh_token":      create_refresh_token(user.id),
        "token_type":         "bearer",
        "user":               user.to_dict(),
    }


# ── User lookups ──────────────────────────────────────────────────────────

async def _user_by_phone(phone_number: str, db: AsyncSession) -> Optional[User]:
    result = await db.execute(select(User).where(User.phone_number == phone_number))
    return result.scalars().first()


async def _user_by_id(user_id: str, db: AsyncSession) -> Optional[User]:
    result = await db.execute(select(User).where(User.id == str(user_id)))
    return result.scalars().first()


# ── Registration ──────────────────────────────────────────────────────────

async def register_user(
    phone_number: str,
    full_name: str,
    db: AsyncSession,
    password: str,
    business_name: str  = "",
    business_category: str = "",
    location: str       = "",
    email: str          = "",
    preferred_lang: str = "sw",
) -> User:
    """
    Create a new user with a bcrypt-hashed password.
    Raises ValueError for duplicate phone/email or a weak password.
    """
    existing = await _user_by_phone(phone_number, db)
    if existing:
        raise ValueError("phone_already_registered")

    if email:
        email_result = await db.execute(select(User).where(User.email == email))
        if email_result.scalars().first():
            raise ValueError("email_already_registered")

    password_hash = hash_password(password)   # raises ValueError('weak_password')

    user = User(
        id                = phone_number,
        phone_number      = phone_number,
        # No phone verification happens anymore, so the flag stays honest.
        phone_verified    = False,
        password_hash     = password_hash,
        email             = email or None,
        name              = full_name,
        business_name     = business_name or None,
        business_category = business_category or None,
        location          = location or None,
        preferred_lang    = preferred_lang,
        status            = UserStatus.active,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    logger.info("Registered new user: id=%s phone=%s", str(user.id), phone_number)
    return user


# ── Login ─────────────────────────────────────────────────────────────────

async def authenticate_user(phone_number: str, password: str, db: AsyncSession) -> User:
    """
    Verify phone + password. Raises AuthError('invalid_credentials') for an
    unknown phone, an account without a password, or a wrong password — the
    same error in all three cases so accounts cannot be enumerated.
    """
    user = await _user_by_phone(phone_number, db)

    if user is None or not user.password_hash:
        verify_password(password, _DUMMY_HASH)     # equalise timing
        raise AuthError("invalid_credentials")

    if not verify_password(password, user.password_hash):
        raise AuthError("invalid_credentials")

    if user.status == UserStatus.suspended:
        raise AuthError("account_suspended")

    logger.info("User logged in: id=%s", str(user.id))
    return user


# ── Password change (also the migration path for OTP-era accounts) ────────

async def set_user_password(
    user: User,
    new_password: str,
    db: AsyncSession,
    current_password: Optional[str] = None,
) -> None:
    """
    Set/replace a user's password.

    * Existing password  → current_password must match (prevents session
      hijacking of an unlocked device).
    * No password yet    → allowed only for an already-authenticated caller,
      which is how accounts created during the OTP-only era get a password.
    """
    if user.password_hash:
        if not verify_password(current_password or "", user.password_hash):
            raise AuthError("invalid_current_password")

    user.password_hash = hash_password(new_password)    # raises ValueError('weak_password')
    await db.commit()
    # `updated_at` is server-generated, so it is expired by the UPDATE; reload
    # it here instead of letting to_dict() trigger lazy IO outside the greenlet.
    await db.refresh(user)
    logger.info("Password set for user id=%s", str(user.id))


# ── Refresh ───────────────────────────────────────────────────────────────

async def refresh_access_token(refresh_token: str, db: AsyncSession) -> dict:
    """Exchange a valid refresh token for a new access token."""
    payload = decode_token(refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise ValueError("invalid_refresh_token")

    user = await _user_by_id(payload.get("sub"), db)
    if not user or user.status == UserStatus.suspended:
        raise ValueError("user_not_found_or_suspended")

    return {
        "access_token": create_access_token(user.id, user.phone_number),
        "token_type":   "bearer",
        "user":         user.to_dict(),
    }


# ── Current user ──────────────────────────────────────────────────────────

async def get_current_user(token: str, db: AsyncSession) -> User:
    payload = decode_token(token)
    if not payload or payload.get("type") != "access":
        raise AuthError("invalid_token")

    user = await _user_by_id(payload.get("sub"), db)
    if not user:
        raise AuthError("user_not_found")
    if user.status == UserStatus.suspended:
        raise AuthError("account_suspended")
    return user

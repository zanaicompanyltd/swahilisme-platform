"""
Auth Service — Swahilisme Platform
JWT-based authentication. Phone number primary, email optional.
"""

import os
import logging
from datetime import datetime, timedelta
from typing import Optional

from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session
from sqlalchemy.future import select

from models.user import User, UserStatus, OTPCode

logger = logging.getLogger(__name__)

# ── Config ────────────────────────────────────────────────────────────────
SECRET_KEY        = os.getenv("JWT_SECRET_KEY", "CHANGE_ME_IN_PRODUCTION")
ALGORITHM         = "HS256"
ACCESS_TOKEN_MINS = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))
REFRESH_TOKEN_DAYS= int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS",   "30"))

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ── Token helpers ─────────────────────────────────────────────────────────

def create_access_token(user_id: int, phone: str) -> str:
    payload = {
        "sub":   str(user_id),
        "phone": phone,
        "type":  "access",
        "exp":   datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_MINS),
        "iat":   datetime.utcnow(),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def create_refresh_token(user_id: int) -> str:
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


# ── Registration ──────────────────────────────────────────────────────────

def register_user(
    phone_number: str,
    full_name: str,
    db: Session,
    business_name: str  = "",
    business_category: str = "",
    location: str       = "",
    email: str          = "",
    preferred_lang: str = "sw",
) -> User:
    """
    Create a new user (phone already verified by OTP at this point).
    Raises ValueError for duplicate phone/email.
    """
    # Duplicate check
    existing = db.query(User).filter(User.phone_number == phone_number).first()
    if existing:
        raise ValueError("phone_already_registered")

    if email:
        dup_email = db.query(User).filter(User.email == email).first()
        if dup_email:
            raise ValueError("email_already_registered")

    user = User(
        phone_number      = phone_number,
        phone_verified    = True,           # OTP already validated
        email             = email or None,
        full_name         = full_name,
        business_name     = business_name or None,
        business_category = business_category or None,
        location          = location or None,
        preferred_lang    = preferred_lang,
        status            = UserStatus.active,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    logger.info("Registered new user: id=%d phone=%s", user.id, phone_number)
    return user


# ── Login ─────────────────────────────────────────────────────────────────

async def login_user(phone_number: str, db: AsyncSession):
    """
    Called after OTP is verified. Returns JWT tokens.
    If user doesn't exist yet, returns needs_registration=True.
    """
    #  NEW ASYNC COMPATIBLE SYNTAX:
    stmt = select(User).where(User.phone_number == phone_number)
    result = await db.execute(stmt)
    user = result.scalars().first()

    if not user:
        return {"needs_registration": True, "phone": phone_number}

    if user.status == UserStatus.suspended:
        raise PermissionError("account_suspended")

    # Update last login
    user.last_login_at = datetime.utcnow()
    user.phone_verified = True
    db.commit()

    access_token  = create_access_token(user.id, user.phone_number)
    refresh_token = create_refresh_token(user.id)

    return {
        "needs_registration": False,
        "access_token":       access_token,
        "refresh_token":      refresh_token,
        "token_type":         "bearer",
        "user":               user.to_dict(),
    }


def refresh_access_token(refresh_token: str, db: Session) -> dict:
    """Exchange a valid refresh token for a new access token."""
    payload = decode_token(refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise ValueError("invalid_refresh_token")

    user_id = int(payload["sub"])
    user = db.query(User).filter(User.id == user_id).first()
    if not user or user.status == UserStatus.suspended:
        raise ValueError("user_not_found_or_suspended")

    return {
        "access_token": create_access_token(user.id, user.phone_number),
        "token_type":   "bearer",
    }


# ── Current user (FastAPI dependency) ─────────────────────────────────────

def get_current_user(token: str, db: Session) -> User:
    payload = decode_token(token)
    if not payload or payload.get("type") != "access":
        raise PermissionError("invalid_token")

    user_id = int(payload["sub"])
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise PermissionError("user_not_found")
    if user.status == UserStatus.suspended:
        raise PermissionError("account_suspended")
    return user

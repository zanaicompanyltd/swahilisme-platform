"""
Auth Routes — Swahilisme Platform
POST /auth/send-otp
POST /auth/verify-otp
POST /auth/register
POST /auth/refresh
GET  /auth/me
"""

from fastapi import APIRouter, Depends, HTTPException, status, Header
from pydantic import BaseModel, Field, EmailStr, validator
from sqlalchemy.orm import Session
from typing import Optional
import re

from db.database import get_db
from models.user import OTPDeliveryMethod
from services.otp_service import send_otp, verify_otp, _normalize_phone
from services.auth_service import (
    register_user, login_user, refresh_access_token, get_current_user
)

router = APIRouter(prefix="/auth", tags=["Authentication"])


# ── Pydantic schemas ───────────────────────────────────────────────────────

class SendOTPRequest(BaseModel):
    phone_number:    str = Field(..., example="+255712345678")
    delivery_method: OTPDeliveryMethod = OTPDeliveryMethod.sms
    lang:            str = Field(default="sw", example="sw")   # sw | en
    purpose:         str = Field(default="login")               # login | register

    @validator("phone_number")
    def validate_phone(cls, v):
        cleaned = re.sub(r"[\s\-\(\)]", "", v)
        # Accept TZ formats: 07xx, +2557xx, 2557xx
        if not re.match(r"^(\+?255|0)\d{9}$", cleaned):
            raise ValueError("Nambari ya simu si sahihi / Invalid phone number")
        return cleaned

    @validator("lang")
    def validate_lang(cls, v):
        if v not in ("sw", "en"):
            raise ValueError("Lang must be 'sw' or 'en'")
        return v


class VerifyOTPRequest(BaseModel):
    phone_number: str
    code:         str = Field(..., min_length=6, max_length=6)
    purpose:      str = Field(default="login")


class RegisterRequest(BaseModel):
    phone_number:      str
    full_name:         str = Field(..., min_length=2, max_length=150)
    business_name:     Optional[str] = None
    business_category: Optional[str] = None
    location:          Optional[str] = None
    email:             Optional[str] = None
    preferred_lang:    str = "sw"


class RefreshRequest(BaseModel):
    refresh_token: str


# ── Endpoints ─────────────────────────────────────────────────────────────

@router.post("/send-otp", summary="Tuma OTP / Send OTP")
async def api_send_otp(body: SendOTPRequest, db: Session = Depends(get_db)):
    """
    Step 1 of auth flow.
    Sends a 6-digit OTP via SMS (Africa's Talking) or WhatsApp (Meta Cloud API).
    Falls back automatically if primary channel fails.
    """
    result = await send_otp(
        phone   = body.phone_number,
        db      = db,
        purpose = body.purpose,
        delivery= body.delivery_method,
        lang    = body.lang,
    )
    if not result["success"]:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "sw": "Imeshindwa kutuma OTP. Tafadhali jaribu tena.",
                "en": "Failed to send OTP. Please try again.",
            }
        )
    return {
        "message": {
            "sw": f"Msimbo umetumwa kwa {'SMS' if result['delivery_method'] == 'sms' else 'WhatsApp'}.",
            "en": f"Code sent via {'SMS' if result['delivery_method'] == 'sms' else 'WhatsApp'}.",
        },
        "delivery_method": result["delivery_method"],
        "phone":           result["phone"],
        # Only exposed in dev/sandbox
        **({"otp": result["otp"]} if "otp" in result else {}),
    }


@router.post("/verify-otp", summary="Thibitisha OTP / Verify OTP")
async def api_verify_otp(body: VerifyOTPRequest, db: Session = Depends(get_db)):
    """
    Step 2 of auth flow.
    Verifies the OTP. On success, either logs the user in (returns tokens)
    or signals that registration is needed.
    """
    phone = _normalize_phone(body.phone_number)

    result = await verify_otp(
        phone   = phone,
        code    = body.code,
        db      = db,
        purpose = body.purpose,
    )

    if not result["valid"]:
        reason = result["reason"]
        messages = {
            "otp_not_found":        {"sw": "Msimbo haukupatikana.", "en": "OTP not found."},
            "otp_expired":          {"sw": "Msimbo umeisha muda. Omba mpya.", "en": "OTP expired. Request a new one."},
            "max_attempts_exceeded":{"sw": "Majaribio mengi. Omba msimbo mpya.", "en": "Too many attempts. Request a new code."},
            "invalid_code":         {
                "sw": f"Msimbo si sahihi. Majaribio {result.get('attempts_remaining', 0)} zimebaki.",
                "en": f"Invalid code. {result.get('attempts_remaining', 0)} attempts remaining.",
            },
        }
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=messages.get(reason, {"sw": "Hitilafu.", "en": "Error."}),
        )

    # OTP valid — attempt login
    try:
        # Inside api_verify_otp:
        login_result = await login_user(phone, db)  # 💡 Added 'await' here
    except PermissionError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"sw": "Akaunti imezuiwa.", "en": "Account suspended."},
        )

    return login_result


@router.post("/register", summary="Jisajili / Register", status_code=status.HTTP_201_CREATED)
async def api_register(body: RegisterRequest, db: Session = Depends(get_db)):
    """
    Called after OTP verification when user is new.
    Creates the user record and returns JWT tokens.
    """
    phone = _normalize_phone(body.phone_number)

    try:
        user = await register_user(
            phone_number      = phone,
            full_name         = body.full_name,
            db                = db,
            business_name     = body.business_name or "",
            business_category = body.business_category or "",
            location          = body.location or "",
            email             = body.email or "",
            preferred_lang    = body.preferred_lang,
        )
    except ValueError as exc:
        error_map = {
            "phone_already_registered": {"sw": "Nambari hii imeshasajiliwa.", "en": "Phone already registered."},
            "email_already_registered": {"sw": "Barua pepe hii imeshasajiliwa.", "en": "Email already registered."},
        }
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=error_map.get(str(exc), {"sw": "Hitilafu.", "en": "Error."}),
        )

    login_result = await login_user(phone, db)
    return {
        "message": {"sw": "Umesajiliwa kwa mafanikio!", "en": "Registration successful!"},
        **login_result,
    }


@router.post("/refresh", summary="Ongeza muda wa token / Refresh token")
async def api_refresh(body: RefreshRequest, db: Session = Depends(get_db)):
    try:
        return refresh_access_token(body.refresh_token, db)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"sw": "Token si halali.", "en": "Invalid refresh token."},
        )


@router.get("/me", summary="Mtumiaji wa sasa / Current user")
async def api_me(
    authorization: str = Header(...),
    db: Session = Depends(get_db),
):
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    token = authorization.split(" ", 1)[1]
    try:
        user = get_current_user(token, db)
        return user.to_dict()
    except PermissionError as exc:
        raise HTTPException(status_code=401, detail=str(exc))

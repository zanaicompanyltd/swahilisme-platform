"""
OTP Service — Daftari Yangu Auth
Delivers 6-digit OTP via:
  1. SMS        — Africa's Talking (primary for TZ market)
  2. WhatsApp   — Meta Cloud API (fallback / user choice)
"""

import os
import random
import string
import logging
import httpx
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import update

from models.user import OTPCode, OTPDeliveryMethod

logger = logging.getLogger(__name__)

# ── Config ────────────────────────────────────────────────────────────────
OTP_LENGTH        = 6
OTP_EXPIRY_MINS  = 10
MAX_ATTEMPTS     = 3

# Africa's Talking
# 💡 Added your Sandbox API Key as the default fallback
AT_API_KEY       = os.getenv("AFRICASTALKING_API_KEY", "atsk_d5819c457354e4780d75d2a7712f4e8400985435fda6a41530ebc62976f6090f8b7dc8f0")
AT_USERNAME      = os.getenv("AFRICASTALKING_USERNAME", "sandbox")

# 💡 CHANGED: Sandbox requires 'sandbox' as the sender ID instead of 'SWAHILISME'
AT_SENDER_ID     = os.getenv("AFRICASTALKING_SENDER_ID", "sandbox")

# 💡 CHANGED: Swapped production URL to the dedicated sandbox API endpoint
AT_SMS_URL       = "https://api.sandbox.africastalking.com/version1/messaging"

# Meta WhatsApp Cloud API
WA_TOKEN         = os.getenv("WHATSAPP_TOKEN", "")
WA_PHONE_ID      = os.getenv("WHATSAPP_PHONE_NUMBER_ID", "")
WA_TEMPLATE_SW   = os.getenv("WHATSAPP_TEMPLATE_SW", "daftari_otp_sw")   # Swahili template
WA_TEMPLATE_EN   = os.getenv("WHATSAPP_TEMPLATE_EN", "daftari_otp_en")   # English template
WA_API_URL       = f"https://graph.facebook.com/v18.0/{WA_PHONE_ID}/messages"


# ── OTP generation ────────────────────────────────────────────────────────

def _generate_otp() -> str:
    return "".join(random.choices(string.digits, k=OTP_LENGTH))


def _normalize_phone(phone: str) -> str:
    """
    Normalize to E.164 format, defaulting to +255 (Tanzania) if no country code.
    Examples:
        0712345678   → +255712345678
        +255712...   → +255712...
        255712...    → +255712...
    """
    phone = phone.strip().replace(" ", "").replace("-", "")
    if phone.startswith("0"):
        phone = "+255" + phone[1:]
    elif phone.startswith("255") and not phone.startswith("+"):
        phone = "+" + phone
    elif not phone.startswith("+"):
        phone = "+255" + phone
    return phone


# ── SMS delivery (Africa's Talking) ──────────────────────────────────────

async def _send_sms(phone: str, otp: str, lang: str = "sw") -> bool:
    if lang == "sw":
        message = (
            f"Msimbo wako wa uthibitisho wa Swahilisme ni: {otp}\n"
            f"Halali kwa dakika {OTP_EXPIRY_MINS}. Usishirikishe mtu yeyote."
        )
    else:
        message = (
            f"Your Swahilisme verification code is: {otp}\n"
            f"Valid for {OTP_EXPIRY_MINS} minutes. Do not share with anyone."
        )

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                AT_SMS_URL,
                headers={
                    "apiKey": AT_API_KEY,
                    "Accept": "application/json",
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                data={
                    "username": AT_USERNAME,
                    "to":       phone,
                    "message":  message,
                    "from":     AT_SENDER_ID,
                },
            )
            resp.raise_for_status()
            data = resp.json()
            recipients = data.get("SMSMessageData", {}).get("Recipients", [])
            if recipients and recipients[0].get("status") == "Success":
                logger.info("SMS OTP sent to %s", phone)
                return True
            logger.warning("SMS delivery issue: %s", data)
            return False
    except Exception as exc:
        logger.error("SMS send failed for %s: %s", phone, exc)
        return False


# ── WhatsApp delivery (Meta Cloud API) ────────────────────────────────────

# ── WhatsApp delivery (Meta Cloud API) ────────────────────────────────────

async def _send_whatsapp(phone: str, otp: str, lang: str = "sw") -> bool:
    """
    Send OTP via WhatsApp using Meta's pre-approved 'hello_world' test template.
    Bypasses template creation restrictions during sandbox testing.
    """
    # 💡 Temporarily override template_name to use Meta's default template
    template_name = "hello_world"

    payload = {
        "messaging_product": "whatsapp",
        "to": phone,
        "type": "template",
        "template": {
            "name": template_name,
            # 'hello_world' must be sent using the 'en_US' language code
            "language": {"code": "en_US"}, 
            # 💡 Note: We completely removed the "components" parameter 
            # because 'hello_world' does not accept variable parameters like {{1}}
        },
    }

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                WA_API_URL,
                headers={
                    "Authorization": f"Bearer {WA_TOKEN}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
            resp.raise_for_status()
            logger.info("WhatsApp Sandbox Test Message ('hello_world') sent to %s", phone)
            return True
    except Exception as exc:
        logger.error("WhatsApp send failed for %s: %s", phone, exc)
        return False


# ── Public API ────────────────────────────────────────────────────────────

async def send_otp(
    phone: str,
    db: AsyncSession,
    purpose: str = "login",
    delivery: OTPDeliveryMethod = OTPDeliveryMethod.sms,
    lang: str = "sw",
    user_id: int | None = None,
) -> dict:
    """
    Generate and dispatch a 6-digit OTP.
    If SMS fails and whatsapp credentials exist, auto-fallback to WhatsApp.

    Returns:
        {"success": bool, "delivery_method": str, "phone": str}
    """
    phone = _normalize_phone(phone)
    otp   = _generate_otp()

    # Invalidate any existing unused OTPs for this phone + purpose
    stmt = (
        update(OTPCode)
        .where(
            OTPCode.phone_number == phone,
            OTPCode.purpose == purpose,
            OTPCode.is_used == False,
        )
        .values(is_used=True)
    )
    await db.execute(stmt)
    await db.commit()

    # Persist new OTP
    record = OTPCode(
        user_id         = user_id,
        phone_number    = phone,
        code            = otp,
        delivery_method = delivery,
        purpose         = purpose,
        expires_at      = datetime.utcnow() + timedelta(minutes=OTP_EXPIRY_MINS),
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)

    # Deliver
    delivered = False
    used_method = delivery

    if delivery == OTPDeliveryMethod.sms:
        delivered = await _send_sms(phone, otp, lang=lang)

    if not delivered and WA_TOKEN:
        # Fallback to WhatsApp
        logger.info("Falling back to WhatsApp for %s", phone)
        delivered = await _send_whatsapp(phone, otp, lang=lang)
        used_method = OTPDeliveryMethod.whatsapp
        record.delivery_method = used_method
        await db.commit()

    if delivery == OTPDeliveryMethod.whatsapp:
        delivered = await _send_whatsapp(phone, otp, lang=lang)
        if not delivered and AT_API_KEY:
            logger.info("Falling back to SMS for %s", phone)
            delivered = await _send_sms(phone, otp, lang=lang)
            used_method = OTPDeliveryMethod.sms
            record.delivery_method = used_method
            await db.commit()

    return {
        "success":         delivered,
        "delivery_method": used_method.value,
        "phone":           phone,
        "otp_id":          record.id,
        # ⚠ Never expose `otp` itself — only for sandbox/dev mode
        **({"otp": otp} if os.getenv("ENV") == "development" else {}),
    }


async def verify_otp(
    phone: str,
    code: str,
    db: AsyncSession,
    purpose: str = "login",
) -> dict:
    """
    Verify the submitted OTP code.

    Returns:
        {"valid": bool, "reason": str | None}
    """
    phone = _normalize_phone(phone)

    stmt = (
        select(OTPCode)
        .where(
            OTPCode.phone_number == phone,
            OTPCode.purpose == purpose,
            OTPCode.is_used == False,
        )
        .order_by(OTPCode.created_at.desc())
    )
    result = await db.execute(stmt)
    record = result.scalars().first()

    if not record:
        return {"valid": False, "reason": "otp_not_found"}

    if datetime.utcnow() > record.expires_at:
        record.is_used = True
        await db.commit()
        return {"valid": False, "reason": "otp_expired"}

    if record.attempts >= MAX_ATTEMPTS:
        record.is_used = True
        await db.commit()
        return {"valid": False, "reason": "max_attempts_exceeded"}

    if record.code != code.strip():
        record.attempts += 1
        await db.commit()
        remaining = MAX_ATTEMPTS - record.attempts
        return {"valid": False, "reason": "invalid_code", "attempts_remaining": remaining}

    # ✓ Valid
    record.is_used = True
    await db.commit()
    return {"valid": True, "reason": None, "phone": phone}

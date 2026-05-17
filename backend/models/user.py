"""
User Model — Swahilisme Platform
Phone number is the primary identifier. Email is optional.
"""

import enum
from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime,
    Enum as SAEnum, Text
)
from sqlalchemy.orm import relationship
from db.database import Base   # ← single shared Base, never redefine


class UserStatus(str, enum.Enum):
    pending   = "pending"    # phone not yet verified
    active    = "active"     # verified, can use platform
    suspended = "suspended"  # admin-suspended


class User(Base):
    __tablename__ = "users"

    id               = Column(Integer, primary_key=True, index=True)
    # ── Identity ──────────────────────────────────────────────────────────
    phone_number     = Column(String(20), unique=True, nullable=False, index=True)
    phone_verified   = Column(Boolean, default=False, nullable=False)
    email            = Column(String(255), unique=True, nullable=True, index=True)
    email_verified   = Column(Boolean, default=False, nullable=False)
    # ── Profile ───────────────────────────────────────────────────────────
    full_name        = Column(String(150), nullable=True)
    business_name    = Column(String(200), nullable=True)
    business_category= Column(String(100), nullable=True)
    location         = Column(String(150), nullable=True)
    preferred_lang   = Column(String(5), default="sw", nullable=False)  # sw | en
    # ── Auth ──────────────────────────────────────────────────────────────
    hashed_password  = Column(String(255), nullable=True)  # optional PIN/password
    status           = Column(SAEnum(UserStatus), default=UserStatus.pending, nullable=False)
    # ── Timestamps ────────────────────────────────────────────────────────
    created_at       = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at       = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_login_at    = Column(DateTime, nullable=True)

    # ── Relationships ─────────────────────────────────────────────────────
    transactions     = relationship("Transaction", back_populates="user", lazy="dynamic")
    otp_codes        = relationship("OTPCode", back_populates="user", lazy="dynamic")

    def to_dict(self) -> dict:
        return {
            "id":                self.id,
            "phone_number":      self.phone_number,
            "phone_verified":    self.phone_verified,
            "email":             self.email,
            "full_name":         self.full_name,
            "business_name":     self.business_name,
            "business_category": self.business_category,
            "location":          self.location,
            "preferred_lang":    self.preferred_lang,
            "status":            self.status.value,
            "created_at":        self.created_at.isoformat(),
        }

    def __repr__(self):
        return f"<User id={self.id} phone={self.phone_number} status={self.status}>"


class OTPDeliveryMethod(str, enum.Enum):
    sms       = "sms"
    whatsapp  = "whatsapp"


class OTPCode(Base):
    """One-time passwords for phone (and optionally email) verification."""
    __tablename__ = "otp_codes"

    id              = Column(Integer, primary_key=True, index=True)
    user_id         = Column(Integer, nullable=True)        # null before user is created
    phone_number    = Column(String(20), nullable=False, index=True)
    code            = Column(String(8), nullable=False)     # 6-digit OTP
    delivery_method = Column(SAEnum(OTPDeliveryMethod), nullable=False)
    purpose         = Column(String(30), default="login")  # login | register | reset
    is_used         = Column(Boolean, default=False)
    attempts        = Column(Integer, default=0)
    expires_at      = Column(DateTime, nullable=False)
    created_at      = Column(DateTime, default=datetime.utcnow)

    user            = relationship("User", back_populates="otp_codes",
                                   foreign_keys=[user_id],
                                   primaryjoin="OTPCode.user_id == User.id")

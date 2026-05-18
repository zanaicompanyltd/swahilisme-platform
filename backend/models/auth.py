# backend/models/auth.py
from sqlalchemy import Column, Integer, String, DateTime, Boolean, func
# ⚠️ If you don't need OTPRequest anymore because you have OTPCode, you can remove this file entirely.
# Otherwise, keep ONLY the OTPRequest class here:

from db.database import Base # Use the shared single database base!

class OTPRequest(Base):
    __tablename__ = "otp_requests"

    id = Column(Integer, primary_key=True, index=True)
    phone_number = Column(String(20), nullable=False, index=True)
    otp_code = Column(String(10), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    is_used = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

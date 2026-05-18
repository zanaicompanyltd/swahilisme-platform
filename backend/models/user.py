# backend/models/user.py
import enum
from datetime import datetime
# 💡 Added ForeignKey to the import list below
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Enum as SAEnum, Text, ForeignKey
from sqlalchemy.orm import relationship
from db.database import Base  

class UserStatus(str, enum.Enum):
    pending = "pending"
    active = "active"
    suspended = "suspended"

class User(Base):
    __tablename__ = "users"

    id = Column(String(50), primary_key=True) # Changed from 36 to 50 to perfectly support 'demo-user-001'
    phone = Column(String(20), unique=True, nullable=False, index=True)
    phone_verified = Column(Boolean, default=False, nullable=False)
    email = Column(String(255), unique=True, nullable=True, index=True)
    email_verified = Column(Boolean, default=False, nullable=False)
    
    name = Column(String(150), nullable=True)  
    business_name = Column(String(200), nullable=True)
    business_category = Column(String(100), nullable=True)
    location = Column(String(150), nullable=True)
    preferred_lang = Column(String(5), default="sw", nullable=False)
    
    status = Column(SAEnum(UserStatus), default=UserStatus.pending, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    transactions = relationship("Transaction", back_populates="user", lazy="dynamic")
    otp_codes = relationship("OTPCode", back_populates="user", lazy="dynamic")
    products = relationship("Product", back_populates="user", lazy="dynamic")
    business_health_cards = relationship("BusinessHealthCard", back_populates="user", lazy="dynamic")
    whatsapp_messages = relationship("WhatsAppMessage", back_populates="user", lazy="dynamic")
    compliance_queries = relationship("ComplianceQuery", back_populates="user", lazy="dynamic")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "phone": self.phone,
            "name": self.name,
            "business_name": self.business_name,
            "business_category": self.business_category,
            "location": self.location,
            "preferred_lang": self.preferred_lang,
            "status": self.status.value,
            "created_at": self.created_at.isoformat(),
        }


class OTPDeliveryMethod(str, enum.Enum):
    sms = "sms"
    whatsapp = "whatsapp"


class OTPCode(Base):
    __tablename__ = "otp_codes"

    id = Column(Integer, primary_key=True, index=True)
    
    # 💡 Added explicit ForeignKey mapping here linking back to users.id table
    user_id = Column(String(50), ForeignKey("users.id", ondelete="CASCADE"), nullable=True)  
    
    phone_number = Column(String(20), nullable=False, index=True)
    code = Column(String(8), nullable=False)
    delivery_method = Column(SAEnum(OTPDeliveryMethod), nullable=False)
    purpose = Column(String(30), default="login")
    is_used = Column(Boolean, default=False)
    attempts = Column(Integer, default=0)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Cleaned up redundant explicit primaryjoin parameters since ForeignKey configuration handles it cleanly
    user = relationship("User", back_populates="otp_codes")

# backend/models/user.py
import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, func, Boolean, DateTime, Enum as SAEnum, Text, ForeignKey
from sqlalchemy.orm import relationship
from db.database import Base  

class UserStatus(str, enum.Enum):
    pending = "pending"
    active = "active"
    suspended = "suspended"

class User(Base):
    __tablename__ = "users"

    id = Column(String(50), primary_key=True)
    # 💡 Renamed to match what your auth_service expects (User.phone_number)
    phone_number = Column(String(20), unique=True, nullable=True)
    name = Column(String(100), nullable=True)
    business_name = Column(String(200), nullable=True)
    business_type = Column(String(100), nullable=True) 
    location = Column(String(200), nullable=True)
    whatsapp_opt_in = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=func.now())
    phone_verified = Column(Boolean, default=False, nullable=False)
    status = Column(SAEnum(UserStatus), default=UserStatus.pending, nullable=False)
    
    # Commented out items remain safely ignored...
    # phone_verified = Column(Boolean, default=False, nullable=False)
    # email = Column(String(255), unique=True, nullable=True, index=True)
    # email_verified = Column(Boolean, default=False, nullable=False)
    # preferred_lang = Column(String(5), default="sw", nullable=False) 
    # status = Column(SAEnum(UserStatus), default=UserStatus.pending, nullable=False)  
    # updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    transactions = relationship("Transaction", back_populates="user", lazy="dynamic")
    otp_codes = relationship("OTPCode", back_populates="user", lazy="dynamic")
    products = relationship("Product", back_populates="user", lazy="dynamic")
    business_health_cards = relationship("BusinessHealthCard", back_populates="user", lazy="dynamic")
    whatsapp_messages = relationship("WhatsAppMessage", back_populates="user", lazy="dynamic")
    compliance_queries = relationship("ComplianceQuery", back_populates="user", lazy="dynamic")
    sync_queue = relationship("SyncQueue", back_populates="user", lazy="dynamic")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "phone_number": self.phone_number,
            "name": self.name,
            "business_name": self.business_name,
            "business_type": self.business_type, 
            "location": self.location,
            "whatsapp_opt_in": self.whatsapp_opt_in,
            "phone_verified": self.phone_verified,          # 💡 Added back safely
            "status": self.status.value if hasattr(self.status, 'value') else self.status, # 💡 Added back safely
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

class OTPDeliveryMethod(str, enum.Enum):
    sms = "sms"
    whatsapp = "whatsapp"


class OTPCode(Base):
    __tablename__ = "otp_codes"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(50), ForeignKey("users.id", ondelete="CASCADE"), nullable=True)  
    
    phone_number = Column(String(20), nullable=False, index=True)
    code = Column(String(8), nullable=False)
    delivery_method = Column(SAEnum(OTPDeliveryMethod), nullable=False)
    purpose = Column(String(30), default="login")
    is_used = Column(Boolean, default=False)
    attempts = Column(Integer, default=0)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="otp_codes")

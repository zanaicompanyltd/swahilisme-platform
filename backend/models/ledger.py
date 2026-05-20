# backend/models/ledger.py
"""
Transaction model for Daftari Yangu ledger entries.

IMPORTANT: Base is imported from db.database — the same instance
used by user.py. Never create a second Base here.
"""
from datetime import date, datetime
import enum
from enum import Enum as PyEnum

from sqlalchemy import (
    Boolean, Column, Date, DateTime, Float, ForeignKey, 
    Integer, String, Text, Enum as SAEnum, JSON
)
from sqlalchemy.orm import relationship
from db.database import Base  # Same Base instance as user.py

# ── Enums ─────────────────────────────────────────────────────────────────────

class TransactionCategory(str, PyEnum):
    MAUZO              = "mauzo"
    HUDUMA             = "huduma"
    MKOPO_ULIOPOKELEWA = "mkopo_uliopokelewa"
    NYINGINE_MAPATO    = "nyingine_mapato"
    MALIGHAFI          = "malighafi"
    MISHAHARA          = "mishahara"
    KODI               = "kodi"
    UMEME              = "umeme"
    USAFIRI            = "usafiri"
    MATANGAZO          = "matangazo"
    MKOPO_ULIOLIPWA    = "mkopo_uliolipwa"
    NYINGINE_GHARAMA   = "nyingine_gharama"

class TransactionType(str, enum.Enum):
    MAPATO  = "mapato"
    GHARAMA = "gharama"
class TransactionSource(str, PyEnum):
    VOICE    = "voice"
    MANUAL   = "manual"
    WHATSAPP = "whatsapp"


# ── users ─────────────────────────────────────────────────────────────────────
# CRITICAL FIX: The User class is ALREADY declared in user.py! 
# We keep it completely commented out here so SQLAlchemy doesn't throw a duplicate error.
#
# class User(Base):
#     __tablename__ = "users"
#     id            = Column(String(36),  primary_key=True)
#     phone         = Column(String(20),  nullable=True,  unique=True)
#     name          = Column(String(200), nullable=False,  default="Mtumiaji")
#     business_name = Column(String(200), nullable=False,  default="Biashara Yangu")
#     business_type = Column(String(100), nullable=True)
#     location      = Column(String(200), nullable=True)
#     created_at    = Column(DateTime,    default=datetime.utcnow)
#     updated_at    = Column(DateTime,    default=datetime.utcnow, onupdate=datetime.utcnow)
#     transactions          = relationship("Transaction",       back_populates="user")
#     products              = relationship("Product",           back_populates="user")
#     business_health_cards = relationship("BusinessHealthCard",back_populates="user")
#     whatsapp_messages     = relationship("WhatsAppMessage",   back_populates="user")
#     compliance_queries    = relationship("ComplianceQuery",    back_populates="user")
#     sync_queue            = relationship("SyncQueue",         back_populates="user")


# ── transactions ──────────────────────────────────────────────────────────────

# ── transactions ──────────────────────────────────────────────────────────────

class Transaction(Base):
    __tablename__ = "transactions"

    id               = Column(String(36), primary_key=True)
    user_id          = Column(String(50), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    client_id        = Column(String(64), nullable=True, unique=True, index=True)

    # ✅ Use String instead of SAEnum — matches your Supabase VARCHAR columns
    type             = Column(String(20), nullable=False)
    category         = Column(String(100), nullable=True)
    amount           = Column(Float, nullable=False)
    revenue          = Column(Float, default=0.0)
    cost             = Column(Float, default=0.0)
    profit           = Column(Float, default=0.0)
    source           = Column(String(20), default="manual")
    
    description      = Column(Text, nullable=True)
    product_name     = Column(String(200), nullable=True)
    quantity         = Column(Float, nullable=True)
    unit_price       = Column(Float, nullable=True)
    currency         = Column(String(5), default="TZS")
    
    raw_transcript   = Column(Text, nullable=True)
    nlp_confidence   = Column(Float, nullable=True)
    nlp_entities     = Column(JSON, nullable=True)
    
    is_synced        = Column(Boolean, default=False)
    local_id         = Column(String(36), nullable=True)
    transaction_date = Column(Date, nullable=False, default=date.today)
    timestamp        = Column(DateTime, nullable=False, default=datetime.utcnow)
    created_at       = Column(DateTime, default=datetime.utcnow)
    updated_at       = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="transactions")

    def to_dict(self) -> dict:
        return {
            "id":               self.id,
            "user_id":          self.user_id,
            "client_id":        self.client_id,
            "transaction_type": self.type,
            "amount":           self.amount,
            "cost":             self.cost,
            "profit":           self.profit,
            "category":         self.category,
            "product":          self.product_name,
            "transaction_date": self.transaction_date.isoformat() if self.transaction_date else None,
            "raw_text":         self.raw_transcript,
            "nlp_confidence":   self.nlp_confidence,
            "is_synced":        self.is_synced,
            "created_at":       self.created_at.isoformat(),
        }

    def __repr__(self):
        return f"<Transaction id={self.id} type={self.type} amount={self.amount}>"


# ── products ──────────────────────────────────────────────────────────────────

class Product(Base):
    __tablename__ = "products"

    id            = Column(String(36), primary_key=True)
    user_id       = Column(String(50), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name_sw       = Column(String(200), nullable=False)
    name_en       = Column(String(200), nullable=True)
    current_stock = Column(Float, default=0.0)
    unit_price    = Column(Float, default=0.0)
    created_at    = Column(DateTime, default=datetime.utcnow)
    updated_at    = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="products")


# ── business_health_cards ─────────────────────────────────────────────────────

class BusinessHealthCard(Base):
    __tablename__ = "business_health_cards"

    id            = Column(String(36), primary_key=True)
    user_id       = Column(String(50), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    period_start  = Column(Date, nullable=False)
    period_end    = Column(Date, nullable=False)
    total_revenue = Column(Float, default=0.0)
    total_cost    = Column(Float, default=0.0)
    total_profit  = Column(Float, default=0.0)
    pdf_url       = Column(String(500), nullable=True)
    generated_at  = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="business_health_cards")


# ── whatsapp_messages ─────────────────────────────────────────────────────────

class WhatsAppMessage(Base):
    __tablename__ = "whatsapp_messages"

    id        = Column(String(36), primary_key=True)
    
    # 💡 BUMP THIS TO 50 to match our updated users.id size cleanly
    user_id   = Column(String(50), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    direction = Column(String(10), nullable=False)
    content   = Column(Text, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)
    status    = Column(String(20), default="sent")

    user = relationship("User", back_populates="whatsapp_messages")


# ── compliance_queries ────────────────────────────────────────────────────────

class ComplianceQuery(Base):
    __tablename__ = "compliance_queries"

    id          = Column(String(36), primary_key=True)
    user_id = Column(String(50), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    question_sw = Column(Text, nullable=False)
    answer_sw   = Column(Text, nullable=True)
    confidence  = Column(Float, nullable=True)
    escalated   = Column(Boolean, default=False)
    created_at  = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="compliance_queries")


# ── sync_queue ────────────────────────────────────────────────────────────────

class SyncQueue(Base):
    __tablename__ = "sync_queue"

    id             = Column(Integer, primary_key=True, autoincrement=True)
    user_id       = Column(String(50), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    transaction_id = Column(String(36), nullable=False)
    operation      = Column(String(10), nullable=False)
    payload        = Column(JSON, nullable=False)
    attempts       = Column(Integer, default=0)
    last_error     = Column(Text, nullable=True)
    created_at     = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="sync_queue")

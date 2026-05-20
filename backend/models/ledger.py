# backend/models/ledger.py
"""
Transaction model for Daftari Yangu ledger entries.

IMPORTANT: Base is imported from db.database — the same instance
used by user.py. Never create a second Base here.

IMPORTANT: Transaction columns use String (not SAEnum) to match
Supabase VARCHAR columns with CHECK constraints.
"""
from datetime import date, datetime
import enum
from enum import Enum as PyEnum

from sqlalchemy import (
    Boolean, Column, Date, DateTime, Float, ForeignKey,
    Integer, String, Text, JSON
    # ✅ SAEnum removed — we use String columns to match Supabase VARCHAR
)
from sqlalchemy.orm import relationship
from db.database import Base


# ── Enums (kept for use in daftari.py Pydantic models / NLP service) ─────────
# These are Python enums only — NOT used as database column types anymore.

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


# ── transactions ──────────────────────────────────────────────────────────────

class Transaction(Base):
    __tablename__ = "transactions"

    id               = Column(String(36), primary_key=True)
    user_id          = Column(String(50), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    client_id        = Column(String(64), nullable=True, unique=True, index=True)

    # ✅ String columns — match Supabase VARCHAR with CHECK constraints
    type             = Column(String(20),  nullable=False)
    category         = Column(String(100), nullable=True)
    source           = Column(String(20),  default="manual")

    amount           = Column(Float, nullable=False)
    revenue          = Column(Float, default=0.0)
    cost             = Column(Float, default=0.0)
    profit           = Column(Float, default=0.0)

    description      = Column(Text,        nullable=True)
    product_name     = Column(String(200), nullable=True)
    quantity         = Column(Float,       nullable=True)
    unit_price       = Column(Float,       nullable=True)
    currency         = Column(String(5),   default="TZS")

    raw_transcript   = Column(Text,  nullable=True)
    nlp_confidence   = Column(Float, nullable=True)
    nlp_entities     = Column(JSON,  nullable=True)

    is_synced        = Column(Boolean,  default=False)
    local_id         = Column(String(36), nullable=True)
    transaction_date = Column(Date,     nullable=False, default=date.today)
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
            "revenue":          self.revenue,
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

    id        = Column(String(36),  primary_key=True)
    user_id   = Column(String(50),  ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    direction = Column(String(10),  nullable=False)
    content   = Column(Text,        nullable=False)
    timestamp = Column(DateTime,    default=datetime.utcnow)
    status    = Column(String(20),  default="sent")

    user = relationship("User", back_populates="whatsapp_messages")


# ── compliance_queries ────────────────────────────────────────────────────────

class ComplianceQuery(Base):
    __tablename__ = "compliance_queries"

    id          = Column(String(36), primary_key=True)
    user_id     = Column(String(50), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    question_sw = Column(Text,    nullable=False)
    answer_sw   = Column(Text,    nullable=True)
    confidence  = Column(Float,   nullable=True)
    escalated   = Column(Boolean, default=False)
    created_at  = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="compliance_queries")


# ── sync_queue ────────────────────────────────────────────────────────────────

class SyncQueue(Base):
    __tablename__ = "sync_queue"

    id             = Column(Integer,    primary_key=True, autoincrement=True)
    user_id        = Column(String(50), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    transaction_id = Column(String(36), nullable=False)
    operation      = Column(String(10), nullable=False)
    payload        = Column(JSON,       nullable=False)
    attempts       = Column(Integer,    default=0)
    last_error     = Column(Text,       nullable=True)
    created_at     = Column(DateTime,   default=datetime.utcnow)

    user = relationship("User", back_populates="sync_queue")

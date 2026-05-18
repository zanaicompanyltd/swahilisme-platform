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
from db.database import Base  # ← Absolute import matching setup

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
    revenue  = "revenue"
    expense  = "expense"
    purchase = "purchase"

class TransactionSource(str, PyEnum):
    VOICE    = "voice"
    MANUAL   = "manual"
    WHATSAPP = "whatsapp"


# ── transactions ──────────────────────────────────────────────────────────────

class Transaction(Base):
    __tablename__ = "transactions"

    # Synchronized properties matching routes (String 36 IDs)
    id             = Column(String(36), primary_key=True)
    user_id        = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    client_id      = Column(String(64), nullable=True, unique=True, index=True)
    
    # Enum-backed values
    transaction_type = Column(SAEnum(TransactionType), nullable=False)
    category         = Column(SAEnum(TransactionCategory), nullable=False)
    source           = Column(SAEnum(TransactionSource), default=TransactionSource.MANUAL)
    
    # Numbers & Financial Data
    amount         = Column(Float, nullable=False)
    revenue        = Column(Float, default=0.0)
    cost           = Column(Float, default=0.0)
    profit         = Column(Float, default=0.0)
    quantity       = Column(Float, nullable=True)
    unit_price     = Column(Float, nullable=True)
    currency       = Column(String(5), default="TZS")
    
    # Audit & Natural Language Fields
    product_name   = Column(String(200), nullable=True)
    product        = Column(String(200), nullable=True)  # Fallback duplicate match
    description    = Column(Text, nullable=True)
    raw_text       = Column(Text, nullable=True)
    raw_transcript = Column(Text, nullable=True)
    
    # Confidence metrics
    asr_confidence = Column(Float, nullable=True)
    ner_confidence = Column(Float, nullable=True)
    nlp_confidence = Column(Float, nullable=True)
    nlp_entities   = Column(JSON, nullable=True)
    
    # Sync Flags
    synced         = Column(Boolean, default=True)
    is_synced      = Column(Boolean, default=False)
    local_id       = Column(String(36), nullable=True)
    transaction_date = Column(Date, nullable=False, default=date.today)
    timestamp      = Column(DateTime, nullable=False, default=datetime.utcnow)
    
    created_at     = Column(DateTime, default=datetime.utcnow)
    updated_at     = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationship
    user = relationship("User", back_populates="transactions")

    def to_dict(self) -> dict:
        return {
            "id":               self.id,
            "user_id":          self.user_id,
            "client_id":        self.client_id,
            "transaction_type": self.transaction_type.value if hasattr(self.transaction_type, 'value') else self.transaction_type,
            "amount":           self.amount,
            "cost":             self.cost,
            "profit":           self.profit,
            "category":         self.category.value if hasattr(self.category, 'value') else self.category,
            "product":          self.product_name or self.product,
            "transaction_date": self.transaction_date.isoformat() if self.transaction_date else None,
            "raw_text":         self.raw_text or self.raw_transcript,
            "asr_confidence":   self.asr_confidence,
            "ner_confidence":   self.ner_confidence,
            "synced":           self.synced,
            "created_at":       self.created_at.isoformat(),
        }

    def __repr__(self):
        return f"<Transaction id={self.id} type={self.transaction_type} amount={self.amount}>"


# ── products ──────────────────────────────────────────────────────────────────

class Product(Base):
    __tablename__ = "products"

    id            = Column(String(36), primary_key=True)
    user_id       = Column(String(36), ForeignKey("users.id"), nullable=False)
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
    user_id       = Column(String(36), ForeignKey("users.id"), nullable=False)
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
    user_id   = Column(String(36), ForeignKey("users.id"), nullable=False)
    direction = Column(String(10), nullable=False)
    content   = Column(Text, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)
    status    = Column(String(20), default="sent")

    user = relationship("User", back_populates="whatsapp_messages")


# ── compliance_queries ────────────────────────────────────────────────────────

class ComplianceQuery(Base):
    __tablename__ = "compliance_queries"

    id          = Column(String(36), primary_key=True)
    user_id     = Column(String(36), ForeignKey("users.id"), nullable=False)
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
    user_id        = Column(String(36), ForeignKey("users.id"), nullable=False)
    transaction_id = Column(String(36), nullable=False)
    operation      = Column(String(10), nullable=False)
    payload        = Column(JSON, nullable=False)
    attempts       = Column(Integer, default=0)
    last_error     = Column(Text, nullable=True)
    created_at     = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="sync_queue")

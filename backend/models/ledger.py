"""
backend/models/ledger.py
Transaction model for Daftari Yangu ledger entries.

IMPORTANT: Base is imported from db.database — the same instance
used by user.py. Never create a second Base here.
Exact copy of your teammate's schema — do NOT change column names.
Tables already exist in Supabase; SQLAlchemy will just connect to them.
"""
from datetime import datetime
from enum import Enum as PyEnum

import enum
from datetime import date, datetime

from sqlalchemy import (
    Boolean, Column, Date, DateTime,
    Enum as SAEnum, Float, ForeignKey, Integer, String, Text,
)
from sqlalchemy.orm import declarative_base, relationship


# ── Enums ─────────────────────────────────────────────────────────────────────

class TransactionType(str, PyEnum):
    MAPATO  = "mapato"
    GHARAMA = "gharama"
from sqlalchemy.orm import relationship

from db.database import Base   # ← same Base as user.py

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


# ── users ─────────────────────────────────────────────────────────────────────

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
#     compliance_queries    = relationship("ComplianceQuery",   back_populates="user")
#     sync_queue            = relationship("SyncQueue",         back_populates="user")


# ── transactions ──────────────────────────────────────────────────────────────

class Transaction(Base):
    __tablename__ = "transactions"

    id               = Column(Integer, primary_key=True, index=True)

    # ── Owner ─────────────────────────────────────────────────────────────
    user_id          = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    # ── Offline sync dedup key ────────────────────────────────────────────
    client_id        = Column(String(64), nullable=True, unique=True, index=True)

    # ── Core fields ───────────────────────────────────────────────────────
    transaction_type = Column(SAEnum(TransactionType), nullable=False)
    amount           = Column(Float, nullable=True)   # revenue or expense amount
    cost             = Column(Float, nullable=True)   # cost-of-goods within a revenue entry
    profit           = Column(Float, nullable=True)   # computed: amount - cost

    # ── NER-extracted metadata ────────────────────────────────────────────
    category         = Column(String(100), nullable=True)
    product          = Column(String(200), nullable=True)
    transaction_date = Column(Date,        nullable=False, default=date.today)

    # ── Audit trail ───────────────────────────────────────────────────────
    raw_text         = Column(Text,    nullable=True)   # original Swahili utterance
    asr_confidence   = Column(Float,   nullable=True)   # Whisper log-prob → 0-1
    ner_confidence   = Column(Float,   nullable=True)   # NER model confidence
    synced           = Column(Boolean, default=True)    # False = offline, not yet synced

    created_at       = Column(DateTime, default=datetime.utcnow)
    updated_at       = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    id             = Column(String(36),  primary_key=True)
    user_id        = Column(String(36),  ForeignKey("users.id"), nullable=False)
    type           = Column(Enum(TransactionType),     nullable=False)
    category       = Column(Enum(TransactionCategory), nullable=False)
    revenue        = Column(Float, default=0.0)
    cost           = Column(Float, default=0.0)
    profit         = Column(Float, default=0.0)
    amount         = Column(Float, nullable=False)
    source         = Column(Enum(TransactionSource),   default=TransactionSource.MANUAL)
    timestamp      = Column(DateTime, nullable=False,   default=datetime.utcnow)
    description    = Column(Text,       nullable=True)
    product_name   = Column(String(200),nullable=True)
    quantity       = Column(Float,      nullable=True)
    unit_price     = Column(Float,      nullable=True)
    currency       = Column(String(5),  default="TZS")
    raw_transcript = Column(Text,       nullable=True)
    nlp_confidence = Column(Float,      nullable=True)
    nlp_entities   = Column(JSON,       nullable=True)
    is_synced      = Column(Boolean,    default=False)
    local_id       = Column(String(36), nullable=True)
    created_at     = Column(DateTime,   default=datetime.utcnow)
    updated_at     = Column(DateTime,   default=datetime.utcnow, onupdate=datetime.utcnow)

    # ── Relationship ──────────────────────────────────────────────────────
    user = relationship("User", back_populates="transactions")


# ── products ──────────────────────────────────────────────────────────────────

class Product(Base):
    __tablename__ = "products"

    id            = Column(String(36),  primary_key=True)
    user_id       = Column(String(36),  ForeignKey("users.id"), nullable=False)
    name_sw       = Column(String(200), nullable=False)
    name_en       = Column(String(200), nullable=True)
    current_stock = Column(Float,       default=0.0)
    unit_price    = Column(Float,       default=0.0)
    created_at    = Column(DateTime,    default=datetime.utcnow)
    updated_at    = Column(DateTime,    default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="products")


# ── business_health_cards ─────────────────────────────────────────────────────

class BusinessHealthCard(Base):
    __tablename__ = "business_health_cards"

    id            = Column(String(36), primary_key=True)
    user_id       = Column(String(36), ForeignKey("users.id"), nullable=False)
    period_start  = Column(Date,       nullable=False)
    period_end    = Column(Date,       nullable=False)
    total_revenue = Column(Float,      default=0.0)
    total_cost    = Column(Float,      default=0.0)
    total_profit  = Column(Float,      default=0.0)
    pdf_url       = Column(String(500),nullable=True)
    generated_at  = Column(DateTime,   default=datetime.utcnow)

    user = relationship("User", back_populates="business_health_cards")

    def to_dict(self) -> dict:
        return {
            "id":               self.id,
            "user_id":          self.user_id,
            "client_id":        self.client_id,
            "transaction_type": self.transaction_type.value,
            "amount":           self.amount,
            "cost":             self.cost,
            "profit":           self.profit,
            "category":         self.category,
            "product":          self.product,
            "transaction_date": self.transaction_date.isoformat() if self.transaction_date else None,
            "raw_text":         self.raw_text,
            "asr_confidence":   self.asr_confidence,
            "ner_confidence":   self.ner_confidence,
            "synced":           self.synced,
            "created_at":       self.created_at.isoformat(),
        }

    def __repr__(self):
        return f"<Transaction id={self.id} type={self.transaction_type} amount={self.amount}>"
# ── whatsapp_messages ─────────────────────────────────────────────────────────

class WhatsAppMessage(Base):
    __tablename__ = "whatsapp_messages"

    id        = Column(String(36),  primary_key=True)
    user_id   = Column(String(36),  ForeignKey("users.id"), nullable=False)
    direction = Column(String(10),  nullable=False)
    content   = Column(Text,        nullable=False)
    timestamp = Column(DateTime,    default=datetime.utcnow)
    status    = Column(String(20),  default="sent")

    user = relationship("User", back_populates="whatsapp_messages")


# ── compliance_queries ────────────────────────────────────────────────────────

class ComplianceQuery(Base):
    __tablename__ = "compliance_queries"

    id          = Column(String(36),  primary_key=True)
    user_id     = Column(String(36),  ForeignKey("users.id"), nullable=False)
    question_sw = Column(Text,        nullable=False)
    answer_sw   = Column(Text,        nullable=True)
    confidence  = Column(Float,       nullable=True)
    escalated   = Column(Boolean,     default=False)
    created_at  = Column(DateTime,    default=datetime.utcnow)

    user = relationship("User", back_populates="compliance_queries")


# ── sync_queue ────────────────────────────────────────────────────────────────

class SyncQueue(Base):
    __tablename__ = "sync_queue"

    id             = Column(Integer,    primary_key=True, autoincrement=True)
    user_id        = Column(String(36), ForeignKey("users.id"), nullable=False)
    transaction_id = Column(String(36), nullable=False)
    operation      = Column(String(10), nullable=False)
    payload        = Column(JSON,       nullable=False)
    attempts       = Column(Integer,    default=0)
    last_error     = Column(Text,       nullable=True)
    created_at     = Column(DateTime,   default=datetime.utcnow)

    user = relationship("User", back_populates="sync_queue")

"""
backend/models/ledger.py

Database models aligned to the SwahiliSME Platform shared schema
as defined in the Requirements Specification (section 2.5.3).

Tables created here are shared across all modules:
  - users            (core profile — all modules)
  - transactions     (Daftari Yangu — Module 1)
  - products         (Daftari Yangu — Module 1)
  - business_health_cards (Daftari Yangu — Module 1)
  - whatsapp_messages     (shared — platform-wide)
  - compliance_queries    (Mshauri Wangu — Module 2, defined here for FK integrity)
  - sync_queue            (offline sync — Daftari Yangu internal)
"""

from datetime import datetime
from enum import Enum as PyEnum
from sqlalchemy import (
    Column, String, Float, DateTime, Enum,
    Text, Boolean, Integer, ForeignKey, JSON, Date
)
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()


# ── Enums ─────────────────────────────────────────────────────────────────────

class TransactionType(str, PyEnum):
    MAPATO  = "mapato"   # Revenue / Income
    GHARAMA = "gharama"  # Cost / Expense


class TransactionCategory(str, PyEnum):
    # Income
    MAUZO              = "mauzo"
    HUDUMA             = "huduma"
    MKOPO_ULIOPOKELEWA = "mkopo_uliopokelewa"
    NYINGINE_MAPATO    = "nyingine_mapato"
    # Expense
    MALIGHAFI          = "malighafi"
    MISHAHARA          = "mishahara"
    KODI               = "kodi"
    UMEME              = "umeme"
    USAFIRI            = "usafiri"
    MATANGAZO          = "matangazo"
    MKOPO_ULIOLIPWA    = "mkopo_uliolipwa"
    NYINGINE_GHARAMA   = "nyingine_gharama"


class TransactionSource(str, PyEnum):
    VOICE    = "voice"
    MANUAL   = "manual"
    WHATSAPP = "whatsapp"


# ── users ─────────────────────────────────────────────────────────────────────
# Spec: id, phone, name, business_name, business_type, location

class User(Base):
    __tablename__ = "users"

    id            = Column(String(36),  primary_key=True)
    phone         = Column(String(20),  nullable=True,  unique=True)
    name          = Column(String(200), nullable=False, default="Mtumiaji")
    business_name = Column(String(200), nullable=False, default="Biashara Yangu")
    business_type = Column(String(100), nullable=True)
    location      = Column(String(200), nullable=True)
    created_at    = Column(DateTime,    default=datetime.utcnow)
    updated_at    = Column(DateTime,    default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    transactions        = relationship("Transaction",       back_populates="user")
    products            = relationship("Product",           back_populates="user")
    business_health_cards = relationship("BusinessHealthCard", back_populates="user")
    whatsapp_messages   = relationship("WhatsAppMessage",   back_populates="user")
    compliance_queries  = relationship("ComplianceQuery",   back_populates="user")
    sync_queue          = relationship("SyncQueue",         back_populates="user")


# ── transactions ──────────────────────────────────────────────────────────────
# Spec: id, user_id, timestamp, revenue, cost, profit, category, source

class Transaction(Base):
    __tablename__ = "transactions"

    id               = Column(String(36),  primary_key=True)
    user_id          = Column(String(36),  ForeignKey("users.id"), nullable=False)

    # Spec fields
    type             = Column(Enum(TransactionType),     nullable=False)
    category         = Column(Enum(TransactionCategory), nullable=False)
    revenue          = Column(Float, default=0.0)   # populated when type=MAPATO
    cost             = Column(Float, default=0.0)   # populated when type=GHARAMA
    profit           = Column(Float, default=0.0)   # revenue - cost
    amount           = Column(Float, nullable=False) # raw amount entered
    source           = Column(Enum(TransactionSource), default=TransactionSource.MANUAL)
    timestamp        = Column(DateTime, nullable=False, default=datetime.utcnow)

    # Extra fields for Daftari Yangu
    description      = Column(Text,       nullable=True)
    product_name     = Column(String(200),nullable=True)
    quantity         = Column(Float,      nullable=True)
    unit_price       = Column(Float,      nullable=True)
    currency         = Column(String(5),  default="TZS")

    # Voice/NLP metadata
    raw_transcript   = Column(Text,       nullable=True)
    nlp_confidence   = Column(Float,      nullable=True)
    nlp_entities     = Column(JSON,       nullable=True)

    # Sync tracking
    is_synced        = Column(Boolean,    default=False)
    local_id         = Column(String(36), nullable=True)

    created_at       = Column(DateTime,   default=datetime.utcnow)
    updated_at       = Column(DateTime,   default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="transactions")


# ── products ──────────────────────────────────────────────────────────────────
# Spec: id, name_sw, name_en, current_stock, unit_price

class Product(Base):
    __tablename__ = "products"

    id            = Column(String(36),  primary_key=True)
    user_id       = Column(String(36),  ForeignKey("users.id"), nullable=False)
    name_sw       = Column(String(200), nullable=False)   # Swahili name (required)
    name_en       = Column(String(200), nullable=True)    # English name (optional)
    current_stock = Column(Float,       default=0.0)
    unit_price    = Column(Float,       default=0.0)
    created_at    = Column(DateTime,    default=datetime.utcnow)
    updated_at    = Column(DateTime,    default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="products")


# ── business_health_cards ─────────────────────────────────────────────────────
# Spec: id, user_id, period_start, period_end,
#       total_revenue, total_cost, total_profit, pdf_url

class BusinessHealthCard(Base):
    __tablename__ = "business_health_cards"

    id             = Column(String(36), primary_key=True)
    user_id        = Column(String(36), ForeignKey("users.id"), nullable=False)
    period_start   = Column(Date,       nullable=False)
    period_end     = Column(Date,       nullable=False)
    total_revenue  = Column(Float,      default=0.0)
    total_cost     = Column(Float,      default=0.0)
    total_profit   = Column(Float,      default=0.0)
    pdf_url        = Column(String(500),nullable=True)  # S3/storage URL after upload
    generated_at   = Column(DateTime,   default=datetime.utcnow)

    user = relationship("User", back_populates="business_health_cards")


# ── whatsapp_messages ─────────────────────────────────────────────────────────
# Spec: id, user_id, direction, content, timestamp

class WhatsAppMessage(Base):
    __tablename__ = "whatsapp_messages"

    id        = Column(String(36),  primary_key=True)
    user_id   = Column(String(36),  ForeignKey("users.id"), nullable=False)
    direction = Column(String(10),  nullable=False)   # "inbound" | "outbound"
    content   = Column(Text,        nullable=False)
    timestamp = Column(DateTime,    default=datetime.utcnow)
    status    = Column(String(20),  default="sent")   # sent | delivered | read | failed

    user = relationship("User", back_populates="whatsapp_messages")


# ── compliance_queries ────────────────────────────────────────────────────────
# Spec: id, user_id, question_sw, answer_sw, confidence, escalated

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
# Internal table for offline-first sync (not in spec, but required by arch)

class SyncQueue(Base):
    __tablename__ = "sync_queue"

    id             = Column(Integer,    primary_key=True, autoincrement=True)
    user_id        = Column(String(36), ForeignKey("users.id"), nullable=False)
    transaction_id = Column(String(36), nullable=False)
    operation      = Column(String(10), nullable=False)   # create | update | delete
    payload        = Column(JSON,       nullable=False)
    attempts       = Column(Integer,    default=0)
    last_error     = Column(Text,       nullable=True)
    created_at     = Column(DateTime,   default=datetime.utcnow)

    user = relationship("User", back_populates="sync_queue")
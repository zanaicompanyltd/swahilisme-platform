"""
backend/services/ledger_service.py
1.3.3 – Ledger Storage & Offline Sync

Handles:
  • CRUD operations for transactions (SQLite primary, Postgres target)
  • Offline queue: unsync'd records tracked in sync_queue table
  • Sync push: batch-uploads queued records to Postgres when online
  • Summary stats used by dashboard and Health Card
"""
import uuid
import logging
from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy import select, func, and_, desc
from sqlalchemy.ext.asyncio import AsyncSession

try:
    from backend.models.ledger import (
        Transaction, SyncQueue, User,
        TransactionType, TransactionCategory,
    )
except ModuleNotFoundError:
    import sys, os
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))
    from backend.models.ledger import (
        Transaction, SyncQueue, User,
        TransactionType, TransactionCategory,
    )

logger = logging.getLogger(__name__)


# ── Transaction CRUD ──────────────────────────────────────────────────────────

async def create_transaction(
    db: AsyncSession,
    user_id: str,
    tx_type: TransactionType,
    category: TransactionCategory,
    amount: float,
    description: str = "",
    transaction_date: Optional[datetime] = None,
    source: str = "manual",
    raw_transcript: Optional[str] = None,
    nlp_confidence: Optional[float] = None,
    product_name: Optional[str] = None,
    quantity: Optional[float] = None,
    unit_price: Optional[float] = None,
    nlp_entities: Optional[dict] = None,
    local_id: Optional[str] = None,
) -> Transaction:
    tx_id = str(uuid.uuid4())
    tx = Transaction(
        id=tx_id,
        user_id=user_id,
        type=tx_type,
        category=category,
        amount=amount,
        description=description,
        transaction_date=transaction_date or datetime.utcnow(),
        source=source,
        raw_transcript=raw_transcript,
        nlp_confidence=nlp_confidence,
        product_name=product_name,
        quantity=quantity,
        unit_price=unit_price,
        nlp_entities=nlp_entities,
        local_id=local_id,
        is_synced=False,
    )
    db.add(tx)
    await db.flush()

    # Queue for Postgres sync
    await _enqueue_sync(db, user_id, tx_id, "create", tx)

    logger.info(f"Transaction created: {tx_id} | {tx_type} | TZS {amount:,.0f}")
    return tx


async def get_transactions(
    db: AsyncSession,
    user_id: str,
    limit: int = 50,
    offset: int = 0,
    tx_type: Optional[TransactionType] = None,
    category: Optional[TransactionCategory] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
) -> list[Transaction]:
    q = select(Transaction).where(Transaction.user_id == user_id)
    if tx_type:
        q = q.where(Transaction.type == tx_type)
    if category:
        q = q.where(Transaction.category == category)
    if date_from:
        q = q.where(Transaction.transaction_date >= date_from)
    if date_to:
        q = q.where(Transaction.transaction_date <= date_to)
    q = q.order_by(desc(Transaction.transaction_date)).limit(limit).offset(offset)
    result = await db.execute(q)
    return result.scalars().all()


async def delete_transaction(db: AsyncSession, tx_id: str, user_id: str) -> bool:
    q = select(Transaction).where(
        and_(Transaction.id == tx_id, Transaction.user_id == user_id)
    )
    result = await db.execute(q)
    tx = result.scalar_one_or_none()
    if not tx:
        return False
    await _enqueue_sync(db, user_id, tx_id, "delete", tx)
    await db.delete(tx)
    return True


# ── Summary / Analytics ───────────────────────────────────────────────────────

async def get_summary(
    db: AsyncSession,
    user_id: str,
    days: int = 30,
) -> dict:
    """Returns revenue, cost, profit, margin and transaction count."""
    since = datetime.utcnow() - timedelta(days=days)

    # Revenue
    rev_q = select(func.sum(Transaction.amount)).where(
        and_(
            Transaction.user_id == user_id,
            Transaction.type == TransactionType.MAPATO,
            Transaction.transaction_date >= since,
        )
    )
    cost_q = select(func.sum(Transaction.amount)).where(
        and_(
            Transaction.user_id == user_id,
            Transaction.type == TransactionType.GHARAMA,
            Transaction.transaction_date >= since,
        )
    )
    count_q = select(func.count(Transaction.id)).where(
        and_(Transaction.user_id == user_id, Transaction.transaction_date >= since)
    )

    revenue = (await db.execute(rev_q)).scalar() or 0.0
    cost = (await db.execute(cost_q)).scalar() or 0.0
    count = (await db.execute(count_q)).scalar() or 0

    profit = revenue - cost
    margin = round((profit / revenue * 100), 1) if revenue > 0 else 0.0

    return {
        "period_days": days,
        "total_revenue": revenue,
        "total_cost": cost,
        "net_profit": profit,
        "profit_margin": margin,
        "transactions_count": count,
    }


async def get_top_products(
    db: AsyncSession,
    user_id: str,
    days: int = 30,
    limit: int = 5,
) -> list[dict]:
    since = datetime.utcnow() - timedelta(days=days)
    q = (
        select(
            Transaction.product_name,
            func.sum(Transaction.amount).label("total_revenue"),
            func.sum(Transaction.quantity).label("total_units"),
        )
        .where(
            and_(
                Transaction.user_id == user_id,
                Transaction.type == TransactionType.MAPATO,
                Transaction.product_name.isnot(None),
                Transaction.transaction_date >= since,
            )
        )
        .group_by(Transaction.product_name)
        .order_by(desc("total_revenue"))
        .limit(limit)
    )
    rows = (await db.execute(q)).all()
    return [
        {"product": r.product_name, "revenue": r.total_revenue, "units": r.total_units or 0}
        for r in rows
    ]


async def get_spending_by_category(
    db: AsyncSession,
    user_id: str,
    days: int = 30,
) -> list[dict]:
    since = datetime.utcnow() - timedelta(days=days)
    q = (
        select(
            Transaction.category,
            func.sum(Transaction.amount).label("total"),
        )
        .where(
            and_(
                Transaction.user_id == user_id,
                Transaction.type == TransactionType.GHARAMA,
                Transaction.transaction_date >= since,
            )
        )
        .group_by(Transaction.category)
        .order_by(desc("total"))
    )
    rows = (await db.execute(q)).all()
    return [{"category": r.category, "total": r.total} for r in rows]


# ── Offline Sync Queue ────────────────────────────────────────────────────────

async def _enqueue_sync(
    db: AsyncSession,
    user_id: str,
    tx_id: str,
    operation: str,
    tx: Transaction,
):
    payload = {
        "id": tx.id,
        "user_id": tx.user_id,
        "type": tx.type.value if tx.type else None,
        "category": tx.category.value if tx.category else None,
        "amount": tx.amount,
        "description": tx.description,
        "transaction_date": tx.transaction_date.isoformat() if tx.transaction_date else None,
        "source": tx.source,
        "product_name": tx.product_name,
        "quantity": tx.quantity,
    }
    entry = SyncQueue(
        user_id=user_id,
        transaction_id=tx_id,
        operation=operation,
        payload=payload,
    )
    db.add(entry)


async def get_pending_sync_count(db: AsyncSession, user_id: str) -> int:
    q = select(func.count(SyncQueue.id)).where(SyncQueue.user_id == user_id)
    return (await db.execute(q)).scalar() or 0


async def flush_sync_queue(db: AsyncSession, user_id: str) -> dict:
    """
    Mark all queued transactions as synced (call after Postgres push succeeds).
    In production this would do the actual Postgres upsert.
    """
    q = select(SyncQueue).where(SyncQueue.user_id == user_id)
    rows = (await db.execute(q)).scalars().all()
    count = len(rows)

    # Mark transactions as synced
    for entry in rows:
        await db.execute(
            Transaction.__table__.update()
            .where(Transaction.id == entry.transaction_id)
            .values(is_synced=True)
        )
        await db.delete(entry)

    logger.info(f"Synced {count} transactions for user {user_id}")
    return {"synced": count, "synced_at": datetime.utcnow().isoformat()}


# ── User helpers ──────────────────────────────────────────────────────────────

async def get_or_create_user(
    db: AsyncSession,
    user_id: str,
    business_name: str = "Biashara Yangu",
    owner_name: str = "Mtumiaji",
) -> User:
    q = select(User).where(User.id == user_id)
    result = await db.execute(q)
    user = result.scalar_one_or_none()
    if not user:
        user = User(id=user_id, business_name=business_name, owner_name=owner_name)
        db.add(user)
        await db.flush()
    return user
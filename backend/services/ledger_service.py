"""
backend/services/ledger_service.py
Works with your teammate's exact schema (ledger.py).
Uses TransactionType.MAPATO / GHARAMA (uppercase enums).
"""
import uuid
from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from models.ledger import (
    Transaction, TransactionType, TransactionCategory,
    TransactionSource,
)
from models.user import User

# ── User ──────────────────────────────────────────────────────────────────────

async def get_or_create_user(db: AsyncSession, user_id: str) -> User:
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        user = User(id=user_id, name="Mtumiaji", business_name="Biashara Yangu")
        db.add(user)
        await db.flush()
    return user


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
    if tx_type == TransactionType.MAPATO:
        revenue, cost = amount, 0.0
    else:
        revenue, cost = 0.0, amount
    profit = revenue - cost

    src_map = {"voice": TransactionSource.VOICE, "whatsapp": TransactionSource.WHATSAPP}
    src = src_map.get(source, TransactionSource.MANUAL)

    tx = Transaction(
        id=str(uuid.uuid4()),
        user_id=user_id,
        type=tx_type,
        category=category,
        amount=amount,
        revenue=revenue,
        cost=cost,
        profit=profit,
        source=src,
        description=description,
        # ✅ Changed from timestamp to transaction_date
        transaction_date=transaction_date or datetime.utcnow(),
        raw_transcript=raw_transcript,
        nlp_confidence=nlp_confidence,
        product_name=product_name,
        quantity=quantity,
        unit_price=unit_price,
        nlp_entities=nlp_entities,
        local_id=local_id,
        is_synced=True,
        currency="TZS",
    )
    db.add(tx)
    await db.flush()
    await db.refresh(tx)
    return tx


async def get_transactions(
    db, user_id, limit=50, offset=0,
    tx_type=None, category=None, date_from=None, date_to=None,
):
    stmt = (
        select(Transaction)
        .where(Transaction.user_id == user_id)
        # ✅ Changed from timestamp to transaction_date
        .order_by(Transaction.transaction_date.desc())
        .limit(limit).offset(offset)
    )
    if tx_type:
        stmt = stmt.where(Transaction.type == tx_type)
    if category:
        stmt = stmt.where(Transaction.category == category)
    if date_from:
        # ✅ Changed from timestamp to transaction_date
        stmt = stmt.where(Transaction.transaction_date >= date_from)
    if date_to:
        # ✅ Changed from timestamp to transaction_date
        stmt = stmt.where(Transaction.transaction_date <= date_to)
    return list((await db.execute(stmt)).scalars().all())


async def delete_transaction(db, tx_id, user_id):
    result = await db.execute(
        select(Transaction).where(
            and_(Transaction.id == tx_id, Transaction.user_id == user_id)
        )
    )
    tx = result.scalar_one_or_none()
    if not tx:
        return False
    await db.delete(tx)
    await db.flush()
    return True


# ── Analytics ─────────────────────────────────────────────────────────────────

async def get_summary(db, user_id, days=30):
    since = datetime.utcnow() - timedelta(days=days)
    stmt = select(
        func.coalesce(func.sum(Transaction.revenue), 0).label("total_revenue"),
        func.coalesce(func.sum(Transaction.cost),    0).label("total_cost"),
        func.coalesce(func.sum(Transaction.profit),  0).label("total_profit"),
        func.count(Transaction.id).label("transactions_count"),
    ).where(and_(
        Transaction.user_id == user_id,
        # ✅ Changed from timestamp to transaction_date
        Transaction.transaction_date >= since,
    ))
    row = (await db.execute(stmt)).one()
    revenue = float(row.total_revenue)
    cost    = float(row.total_cost)
    profit  = float(row.total_profit)
    margin  = round(profit / revenue * 100, 1) if revenue else 0.0
    return {
        "total_revenue": revenue, "total_cost": cost,
        "net_profit": profit, "profit_margin": margin,
        "transactions_count": row.transactions_count, "days": days,
    }


async def get_top_products(db, user_id, days=30, limit=5):
    since = datetime.utcnow() - timedelta(days=days)
    stmt = (
        select(
            func.coalesce(Transaction.product_name, "Nyingine").label("name"),
            func.sum(Transaction.amount).label("revenue"),
        )
        .where(and_(
            Transaction.user_id == user_id,
            Transaction.type == TransactionType.MAPATO,
            # ✅ Changed from timestamp to transaction_date
            Transaction.transaction_date >= since,
        ))
        .group_by(func.coalesce(Transaction.product_name, "Nyingine"))
        .order_by(func.sum(Transaction.amount).desc())
        .limit(limit)
    )
    rows = (await db.execute(stmt)).all()
    return [{"name": r.name, "revenue": float(r.revenue)} for r in rows]


async def get_spending_by_category(db, user_id, days=30):
    since = datetime.utcnow() - timedelta(days=days)
    stmt = (
        select(
            Transaction.category.label("category"),
            func.sum(Transaction.amount).label("amount"),
        )
        .where(and_(
            Transaction.user_id == user_id,
            Transaction.type == TransactionType.GHARAMA,
            # ✅ Changed from timestamp to transaction_date
            Transaction.transaction_date >= since,
        ))
        .group_by(Transaction.category)
        .order_by(func.sum(Transaction.amount).desc())
    )
    rows = (await db.execute(stmt)).all()
    total = sum(float(r.amount) for r in rows) or 1
    return [
        {"category": str(r.category), "amount": float(r.amount),
         "percent": round(float(r.amount) / total * 100, 1)}
        for r in rows
    ]


# ── Offline sync ──────────────────────────────────────────────────────────────

async def get_pending_sync_count(db, user_id):
    stmt = select(func.count(Transaction.id)).where(
        and_(Transaction.user_id == user_id, Transaction.is_synced == False)  # noqa
    )
    return (await db.execute(stmt)).scalar() or 0


async def flush_sync_queue(db, user_id):
    stmt = select(Transaction).where(
        and_(Transaction.user_id == user_id, Transaction.is_synced == False)  # noqa
    )
    txs = list((await db.execute(stmt)).scalars().all())
    for tx in txs:
        tx.is_synced = True
    await db.flush()
    return {"synced": len(txs), "message": f"Miamala {len(txs)} imesawazishwa"}

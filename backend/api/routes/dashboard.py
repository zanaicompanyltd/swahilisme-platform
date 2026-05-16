"""
1.6 Analytics Dashboard Routes — connected to Supabase
Reads from: transactions, users tables
"""
from fastapi import APIRouter, Query
from typing import Optional
import os, asyncio

router = APIRouter()

# ── Supabase connection (via psycopg2 or asyncpg) ────────────────────────────
# We use a simple sync wrapper — Railway has DATABASE_URL set automatically

def get_db():
    """Return a psycopg2 connection to Supabase PostgreSQL."""
    import psycopg2
    from psycopg2.extras import RealDictCursor
    db_url = os.getenv("DATABASE_URL", "")
    if not db_url:
        return None
    # Supabase URLs use 'postgres://' — psycopg2 needs 'postgresql://'
    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)
    conn = psycopg2.connect(db_url, cursor_factory=RealDictCursor)
    return conn


def query_db(sql: str, params: tuple = ()):
    """Run a SELECT query, return list of dicts. Falls back to [] on error."""
    try:
        conn = get_db()
        if not conn:
            return []
        cur = conn.cursor()
        cur.execute(sql, params)
        rows = cur.fetchall()
        conn.close()
        return [dict(r) for r in rows]
    except Exception as e:
        print(f"[DB Error] {e}")
        return []


def scalar_db(sql: str, params: tuple = (), default=0):
    """Run a scalar query, return single value."""
    try:
        conn = get_db()
        if not conn:
            return default
        cur = conn.cursor()
        cur.execute(sql, params)
        row = cur.fetchone()
        conn.close()
        if row:
            vals = list(dict(row).values())
            return vals[0] if vals else default
        return default
    except Exception as e:
        print(f"[DB Scalar Error] {e}")
        return default


# ── Period to days mapping ───────────────────────────────────────────────────
PERIOD_DAYS = {"day": 1, "week": 7, "month": 30, "quarter": 90}

# ── Fallback demo data (shown when DB is empty or unreachable) ───────────────
DEMO_SUMMARY = {
    "total_revenue": 125000,
    "total_cost":    58000,
    "net_profit":    67000,
    "profit_margin": 53.6,
    "transactions_count": 42,
}
DEMO_CHART = {
    "labels":  ["Jumatatu", "Jumanne", "Jumatano", "Alhamisi", "Ijumaa", "Jumamosi", "Jumapili"],
    "revenue": [45000, 62000, 58000, 71000, 89000, 95000, 42000],
    "cost":    [22000, 30000, 28000, 35000, 42000, 48000, 20000],
    "profit":  [23000, 32000, 30000, 36000, 47000, 47000, 22000],
}
DEMO_PRODUCTS = {"products": [
    {"rank": 1, "name": "Samaki wa Bahari",   "revenue": 120000, "units": 85,  "category": "Chakula"},
    {"rank": 2, "name": "Nguo za Kanga",      "revenue": 95000,  "units": 40,  "category": "Mavazi"},
    {"rank": 3, "name": "Mboga za Bustani",   "revenue": 72000,  "units": 200, "category": "Chakula"},
    {"rank": 4, "name": "Simu za Mikono",     "revenue": 68000,  "units": 8,   "category": "Teknolojia"},
    {"rank": 5, "name": "Sabuni na Vipodozi", "revenue": 45000,  "units": 150, "category": "Nyumbani"},
]}
DEMO_SPENDING = {"categories": [
    {"category": "Bidhaa (Stocking)", "amount": 185000, "percent": 42},
    {"category": "Usafiri",           "amount": 66000,  "percent": 15},
    {"category": "Kodi ya Duka",      "amount": 55000,  "percent": 12},
    {"category": "Wafanyakazi",       "amount": 88000,  "percent": 20},
    {"category": "Umeme & Maji",      "amount": 22000,  "percent": 5},
    {"category": "Nyingine",          "amount": 24000,  "percent": 6},
]}


# ── 1.6 Endpoints ─────────────────────────────────────────────────────────────

@router.get("/summary")
async def get_dashboard_summary(
    user_id: str,
    period: str = Query("week", enum=["day", "week", "month", "quarter"]),
):
    """1.6.1 — Summary stat cards: revenue, cost, profit, margin, count."""
    days = PERIOD_DAYS.get(period, 7)

    # Try Supabase first
    rows = query_db("""
        SELECT
            COALESCE(SUM(CASE WHEN type = 'mapato'  THEN amount ELSE 0 END), 0) AS revenue,
            COALESCE(SUM(CASE WHEN type = 'gharama' THEN amount ELSE 0 END), 0) AS cost,
            COUNT(*) AS tx_count
        FROM transactions
        WHERE user_id = %s
          AND transaction_date >= NOW() - INTERVAL '%s days'
    """, (user_id, days))

    if rows and rows[0]["tx_count"] > 0:
        r = rows[0]
        revenue = float(r["revenue"] or 0)
        cost    = float(r["cost"]    or 0)
        profit  = revenue - cost
        margin  = round((profit / revenue) * 100, 1) if revenue else 0
        return {
            "period": period,
            "total_revenue": revenue,
            "total_cost":    cost,
            "net_profit":    profit,
            "profit_margin": margin,
            "transactions_count": int(r["tx_count"]),
            "source": "supabase",
        }

    # Fallback to demo data
    return {**DEMO_SUMMARY, "period": period, "source": "demo"}


@router.get("/revenue-cost-profit")
async def get_revenue_cost_profit(
    user_id: str,
    days: int = Query(7, ge=1, le=365),
):
    """1.6.1 — Daily time-series for the area chart."""
    rows = query_db("""
        SELECT
            TO_CHAR(transaction_date::date, 'Dy') AS day_label,
            COALESCE(SUM(CASE WHEN type = 'mapato'  THEN amount ELSE 0 END), 0) AS revenue,
            COALESCE(SUM(CASE WHEN type = 'gharama' THEN amount ELSE 0 END), 0) AS cost
        FROM transactions
        WHERE user_id = %s
          AND transaction_date >= NOW() - INTERVAL '%s days'
        GROUP BY transaction_date::date, day_label
        ORDER BY transaction_date::date ASC
        LIMIT 30
    """, (user_id, days))

    if rows:
        labels  = [r["day_label"] for r in rows]
        revenue = [float(r["revenue"]) for r in rows]
        cost    = [float(r["cost"])    for r in rows]
        profit  = [rev - cst for rev, cst in zip(revenue, cost)]
        return {"labels": labels, "revenue": revenue, "cost": cost, "profit": profit, "source": "supabase"}

    return {**DEMO_CHART, "source": "demo"}


@router.get("/top-products")
async def get_top_products(
    user_id: str,
    limit: int = Query(5, ge=1, le=20),
    period: str = Query("month", enum=["week", "month", "quarter"]),
):
    """1.6.2 — Products/categories ranked by revenue."""
    days = PERIOD_DAYS.get(period, 30)

    rows = query_db("""
        SELECT
            COALESCE(product_name, category, 'Nyingine') AS name,
            category,
            COALESCE(SUM(amount), 0)                     AS revenue,
            COALESCE(SUM(quantity), 0)                   AS units,
            ROW_NUMBER() OVER (ORDER BY SUM(amount) DESC) AS rank
        FROM transactions
        WHERE user_id = %s
          AND type = 'mapato'
          AND transaction_date >= NOW() - INTERVAL '%s days'
        GROUP BY product_name, category
        ORDER BY revenue DESC
        LIMIT %s
    """, (user_id, days, limit))

    if rows:
        products = [
            {
                "rank":     int(r["rank"]),
                "name":     r["name"],
                "category": r["category"] or "—",
                "revenue":  float(r["revenue"]),
                "units":    int(r["units"] or 0),
            }
            for r in rows
        ]
        return {"period": period, "products": products, "source": "supabase"}

    return {**DEMO_PRODUCTS, "period": period, "source": "demo"}


@router.get("/spending-patterns")
async def get_spending_patterns(
    user_id: str,
    period: str = Query("month", enum=["week", "month", "quarter"]),
):
    """1.6.3 — Expense breakdown by category (donut chart)."""
    days = PERIOD_DAYS.get(period, 30)

    rows = query_db("""
        SELECT
            COALESCE(category, 'Nyingine') AS category,
            COALESCE(SUM(amount), 0)       AS amount
        FROM transactions
        WHERE user_id = %s
          AND type = 'gharama'
          AND transaction_date >= NOW() - INTERVAL '%s days'
        GROUP BY category
        ORDER BY amount DESC
    """, (user_id, days))

    if rows:
        total = sum(float(r["amount"]) for r in rows) or 1
        cats = [
            {
                "category": r["category"],
                "amount":   float(r["amount"]),
                "percent":  round((float(r["amount"]) / total) * 100, 1),
            }
            for r in rows
        ]
        return {"period": period, "total_spending": total, "categories": cats, "source": "supabase"}

    return {**DEMO_SPENDING, "period": period, "source": "demo"}


@router.get("/health-card-status")
async def get_health_card_status(user_id: str):
    """Check if user qualifies for Business Health Card (90 days, 30+ txn)."""
    rows = query_db("""
        SELECT
            COUNT(*) AS tx_count,
            COALESCE(
                EXTRACT(DAY FROM NOW() - MIN(transaction_date)), 0
            )::int AS days_of_data
        FROM transactions
        WHERE user_id = %s
    """, (user_id,))

    if rows:
        r = rows[0]
        tx_count    = int(r["tx_count"]    or 0)
        days_of_data = int(r["days_of_data"] or 0)
    else:
        tx_count = 0
        days_of_data = 0

    eligible = days_of_data >= 90 and tx_count >= 30
    return {
        "days_of_data":        days_of_data,
        "transaction_count":   tx_count,
        "eligible":            eligible,
        "days_remaining":      max(0, 90 - days_of_data),
        "required_transactions": max(0, 30 - tx_count),
    }

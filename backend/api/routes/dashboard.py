"""
1.6 Analytics Dashboard — API Routes
1.6.1  Revenue / Cost / Profit Charts
1.6.2  Top Products View
1.6.3  Spending Patterns
"""
from fastapi import APIRouter, Query
from typing import Optional

router = APIRouter()


# ── 1.6.1  Revenue / Cost / Profit Charts ────────────────────────────────────

@router.get("/summary")
async def get_dashboard_summary(
    user_id: str,
    period: str = Query("week", enum=["day", "week", "month", "quarter"]),
):
    """
    Summary cards: total revenue, cost, net profit, margin, transaction count.
    Used by the top stat cards in the dashboard.
    """
    # TODO: replace mock data with Supabase query
    data = {
        "day":     dict(revenue=18000,  cost=8000,  profit=10000, transactions=6),
        "week":    dict(revenue=125000, cost=58000, profit=67000, transactions=42),
        "month":   dict(revenue=490000, cost=220000,profit=270000,transactions=165),
        "quarter": dict(revenue=1480000,cost=660000,profit=820000,transactions=510),
    }
    d = data[period]
    margin = round((d["profit"] / d["revenue"]) * 100, 1) if d["revenue"] else 0
    return {
        "period": period,
        "total_revenue": d["revenue"],
        "total_cost": d["cost"],
        "net_profit": d["profit"],
        "profit_margin": margin,
        "transactions_count": d["transactions"],
    }


@router.get("/revenue-cost-profit")
async def get_revenue_cost_profit(
    user_id: str,
    days: int = Query(7, ge=1, le=365),
):
    """
    1.6.1 — Time-series data for the area/line chart.
    Returns parallel arrays: labels, revenue, cost, profit.
    """
    # TODO: query Supabase transactions table, group by day
    return {
        "labels":  ["Jumatatu", "Jumanne", "Jumatano", "Alhamisi", "Ijumaa", "Jumamosi", "Jumapili"],
        "revenue": [45000, 62000, 58000, 71000, 89000, 95000, 42000],
        "cost":    [22000, 30000, 28000, 35000, 42000, 48000, 20000],
        "profit":  [23000, 32000, 30000, 36000, 47000, 47000, 22000],
    }


# ── 1.6.2  Top Products View ──────────────────────────────────────────────────

@router.get("/top-products")
async def get_top_products(
    user_id: str,
    limit: int = Query(5, ge=1, le=20),
    period: str = Query("month", enum=["week", "month", "quarter"]),
):
    """
    1.6.2 — Products ranked by revenue contribution.
    Drives both the horizontal bar chart and the summary table.
    """
    # TODO: query Supabase, group by product, sum revenue
    return {
        "period": period,
        "products": [
            {"rank": 1, "name": "Samaki wa Bahari",   "revenue": 120000, "units": 85,  "category": "Chakula"},
            {"rank": 2, "name": "Nguo za Kanga",      "revenue": 95000,  "units": 40,  "category": "Mavazi"},
            {"rank": 3, "name": "Mboga za Bustani",   "revenue": 72000,  "units": 200, "category": "Chakula"},
            {"rank": 4, "name": "Simu za Mikono",     "revenue": 68000,  "units": 8,   "category": "Teknolojia"},
            {"rank": 5, "name": "Sabuni na Vipodozi", "revenue": 45000,  "units": 150, "category": "Nyumbani"},
        ],
    }


# ── 1.6.3  Spending Patterns ──────────────────────────────────────────────────

@router.get("/spending-patterns")
async def get_spending_patterns(
    user_id: str,
    period: str = Query("month", enum=["week", "month", "quarter"]),
):
    """
    1.6.3 — Expense breakdown by category.
    Drives the donut chart and progress-bar list.
    """
    # TODO: query Supabase transactions WHERE type='expense', group by category
    return {
        "period": period,
        "total_spending": 440000,
        "categories": [
            {"category": "Bidhaa (Stocking)", "amount": 185000, "percent": 42},
            {"category": "Usafiri",           "amount": 66000,  "percent": 15},
            {"category": "Kodi ya Duka",      "amount": 55000,  "percent": 12.5},
            {"category": "Wafanyakazi",       "amount": 88000,  "percent": 20},
            {"category": "Umeme & Maji",      "amount": 22000,  "percent": 5},
            {"category": "Nyingine",          "amount": 24000,  "percent": 5.5},
        ],
    }


# ── Business Health Card eligibility ─────────────────────────────────────────

@router.get("/health-card-status")
async def get_health_card_status(user_id: str):
    """
    Check if user has enough data (90 days, 30+ transactions)
    to generate a Business Health Card PDF.
    """
    # TODO: query Supabase for user's oldest transaction date + count
    days_of_data = 12
    transaction_count = 42
    eligible = days_of_data >= 90 and transaction_count >= 30
    return {
        "days_of_data": days_of_data,
        "transaction_count": transaction_count,
        "eligible": eligible,
        "days_remaining": max(0, 90 - days_of_data),
        "required_transactions": max(0, 30 - transaction_count),
    }

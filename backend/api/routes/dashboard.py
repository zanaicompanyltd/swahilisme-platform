"""
Dashboard Routes - 1.6 Analytics Dashboard
1.6.1 Revenue / Cost / Profit Charts
1.6.2 Top Products View
1.6.3 Spending Patterns
"""
from fastapi import APIRouter, Query
from datetime import datetime, timedelta
from typing import Optional
import os

router = APIRouter()

@router.get("/summary")
async def get_dashboard_summary(
    user_id: str,
    period: str = Query("week", enum=["day", "week", "month", "quarter"])
):
    """1.6.1 - Get revenue, cost, profit summary"""
    # In production, query database
    # For now, return demo data
    return {
        "period": period,
        "total_revenue": 125000,
        "total_cost": 58000,
        "net_profit": 67000,
        "profit_margin": 53.6,
        "transactions_count": 42
    }

@router.get("/revenue-cost-profit")
async def get_revenue_cost_profit(
    user_id: str,
    days: int = 30
):
    """1.6.1 - Time-series data for charts"""
    return {
        "labels": ["Jumatatu", "Jumanne", "Jumatano", "Alhamisi", "Ijumaa", "Jumamosi", "Jumapili"],
        "revenue": [45000, 62000, 58000, 71000, 89000, 95000, 42000],
        "cost": [22000, 30000, 28000, 35000, 42000, 48000, 20000],
        "profit": [23000, 32000, 30000, 36000, 47000, 47000, 22000]
    }

@router.get("/top-products")
async def get_top_products(
    user_id: str,
    limit: int = Query(5, ge=1, le=20)
):
    """1.6.2 - Top products by revenue"""
    return {
        "products": [
            {"rank": 1, "name": "Samaki wa Bahari", "revenue": 120000, "units": 85, "category": "Chakula"},
            {"rank": 2, "name": "Nguo za Kanga", "revenue": 95000, "units": 40, "category": "Mavazi"},
            {"rank": 3, "name": "Mboga za Bustani", "revenue": 72000, "units": 200, "category": "Chakula"},
            {"rank": 4, "name": "Simu za Mikono", "revenue": 68000, "units": 8, "category": "Teknolojia"},
            {"rank": 5, "name": "Sabuni na Vipodozi", "revenue": 45000, "units": 150, "category": "Vitu vya Nyumbani"}
        ][:limit]
    }

@router.get("/spending-patterns")
async def get_spending_patterns(user_id: str):
    """1.6.3 - Category breakdown of expenses"""
    return {
        "categories": [
            {"category": "Bidhaa (Stocking)", "amount": 185000, "percent": 42},
            {"category": "Usafiri", "amount": 66000, "percent": 15},
            {"category": "Kodi ya Duka", "amount": 55000, "percent": 12.5},
            {"category": "Malipo ya Wafanyakazi", "amount": 88000, "percent": 20},
            {"category": "Umeme & Maji", "amount": 22000, "percent": 5},
            {"category": "Nyingine", "amount": 24000, "percent": 5.5}
        ]
    }

@router.get("/health-card-status")
async def get_health_card_status(user_id: str):
    """Check if user is eligible for Business Health Card"""
    return {
        "eligible": True,
        "days_of_data": 90,
        "days_remaining": 0,
        "transaction_count": 42,
        "required_days": 90,
        "required_transactions": 30
    }

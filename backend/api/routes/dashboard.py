from fastapi import APIRouter, Query

router = APIRouter()

@router.get("/summary")
async def get_dashboard_summary(
    user_id: str,
    period: str = Query("week", enum=["day", "week", "month"])
):
    """Get revenue, cost, profit summary"""
    return {
        "period": period,
        "total_revenue": 125000,
        "total_cost": 58000,
        "net_profit": 67000,
        "profit_margin": 53.6,
        "transactions_count": 42
    }

@router.get("/revenue-cost-profit")
async def get_chart_data(
    user_id: str,
    days: int = 30
):
    """Time-series data for charts"""
    return {
        "labels": ["Jumatatu", "Jumanne", "Jumatano", "Alhamisi", "Ijumaa", "Jumamosi", "Jumapili"],
        "revenue": [45000, 62000, 58000, 71000, 89000, 95000, 42000],
        "cost": [22000, 30000, 28000, 35000, 42000, 48000, 20000],
        "profit": [23000, 32000, 30000, 36000, 47000, 47000, 22000]
    }

@router.get("/top-products")
async def get_top_products(
    user_id: str,
    limit: int = 5
):
    """Top products by revenue"""
    return {
        "products": [
            {"name": "Samaki wa Bahari", "revenue": 120000, "units": 85},
            {"name": "Nguo za Kanga", "revenue": 95000, "units": 40},
            {"name": "Mboga za Bustani", "revenue": 72000, "units": 200}
        ]
    }

@router.get("/spending-patterns")
async def get_spending_patterns(user_id: str):
    """Category breakdown of expenses"""
    return {
        "categories": [
            {"category": "Bidhaa", "amount": 185000, "percent": 42},
            {"category": "Usafiri", "amount": 66000, "percent": 15},
            {"category": "Kodi", "amount": 55000, "percent": 12.5}
        ]
    }

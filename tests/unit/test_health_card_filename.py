"""Regression coverage for safe PDF filenames with optional business names."""
import pathlib
import sys

BACKEND = pathlib.Path(__file__).resolve().parents[2] / "backend"
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

from services.pdf.filename import safe_business_filename  # noqa: E402
from services.pdf.health_card import generate_health_card  # noqa: E402


def test_health_card_filename_slug_handles_missing_name():
    assert safe_business_filename(None) == "biashara"
    assert safe_business_filename("   ") == "biashara"


def test_health_card_filename_slug_is_ascii_safe():
    assert safe_business_filename("Mama's Shop & Sons") == "mama-s-shop-sons"
    assert safe_business_filename("Duka #1") == "duka-1"


def test_health_card_generator_returns_a_pdf_for_empty_ledger_data():
    pdf = generate_health_card(
        business_name="Biashara Yangu",
        owner_name="Mmiliki",
        summary={
            "total_revenue": 0,
            "total_cost": 0,
            "net_profit": 0,
            "profit_margin": 0,
            "transactions_count": 0,
        },
        top_products=[],
        spending_by_category=[],
        transactions_count=0,
        days=90,
    )
    assert pdf.startswith(b"%PDF-")

"""
backend/models/__init__.py

Import ALL models here in dependency order.
This file is the single place that controls model loading.
Any code that needs models should import from here, not from individual files.

WHY: SQLAlchemy uses a shared MetaData registry on Base.
If two files define the same table name on the same Base, you get:
  "Table 'X' is already defined for this MetaData instance"
The fix: import each model module exactly once, here.
"""

from db.database import Base  # noqa: F401 — ensures Base is created first

from models.user import (     # noqa: F401
    User,
    OTPCode,
    UserStatus,
    OTPDeliveryMethod,
)

from models.ledger import (   # noqa: F401
    Transaction,
    TransactionType,
)

__all__ = [
    "Base",
    "User", "OTPCode", "UserStatus", "OTPDeliveryMethod",
    "Transaction", "TransactionType",
]

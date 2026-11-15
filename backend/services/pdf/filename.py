"""Helpers for safe, user-derived PDF download filenames."""
import re
from typing import Optional


def safe_business_filename(business_name: Optional[str]) -> str:
    """Return an ASCII-only filename slug, with a fallback for empty names."""
    slug = re.sub(r"[^a-z0-9]+", "-", (business_name or "").strip().lower()).strip("-")
    return slug or "biashara"

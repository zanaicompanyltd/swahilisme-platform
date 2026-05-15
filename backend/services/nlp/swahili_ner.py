"""
backend/services/nlp/swahili_ner.py
1.3.2 – NLP Pipeline: Named Entity Recognition for Swahili transactions

Extracts from free Swahili text:
  • amount     – e.g. "elfu ishirini" → 20000, "shilingi 5,000" → 5000
  • category   – maps keywords to TransactionCategory enum
  • type       – mapato (income) or gharama (expense)
  • date       – "leo", "jana", "juzi", explicit dates
  • product    – item name if mentioned
  • quantity   – units sold/bought
"""
import re
import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Optional

try:
    from backend.models.ledger import TransactionType, TransactionCategory
except ModuleNotFoundError:
    # Fallback for running the file directly or from project root without
    # the package on sys.path.  Works when CWD is the project root.
    import sys, os
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", ".."))
    from backend.models.ledger import TransactionType, TransactionCategory

logger = logging.getLogger(__name__)


# ── Swahili number words ──────────────────────────────────────────────────────
SWAHILI_ONES = {
    "moja": 1, "mbili": 2, "tatu": 3, "nne": 4, "tano": 5,
    "sita": 6, "saba": 7, "nane": 8, "tisa": 9, "kumi": 10,
    "kumi na moja": 11, "kumi na mbili": 12, "kumi na tatu": 13,
    "kumi na nne": 14, "kumi na tano": 15, "kumi na sita": 16,
    "kumi na saba": 17, "kumi na nane": 18, "kumi na tisa": 19,
    "ishirini": 20, "thelathini": 30, "arobaini": 40, "hamsini": 50,
    "sitini": 60, "sabini": 70, "themanini": 80, "tisini": 90,
}

SWAHILI_MULTIPLIERS = {
    "mia": 100, "elfu": 1000, "laki": 100_000, "milioni": 1_000_000,
}

# ── Income/Expense keyword maps ───────────────────────────────────────────────
INCOME_KEYWORDS = [
    "nimeuza", "niliuza", "mauzo", "mapato", "nimepata", "nilipata",
    "huduma", "faida", "pato", "mkopo uliopokelewa", "fedha zilizoingia",
    "aliambia", "walilipa", "wateja walinipa",
]

EXPENSE_KEYWORDS = [
    "nimenunua", "nilinunua", "manunuzi", "gharama", "nililipa", "nilipa",
    "kodi", "mishahara", "mshahara", "umeme", "maji", "usafiri", "nauli",
    "matangazo", "tangazo", "mkopo", "deni", "malipo", "nimelipa",
    "nimechukua", "nimetumia",
]

# ── Category keyword map ──────────────────────────────────────────────────────
CATEGORY_MAP = {
    TransactionCategory.MAUZO:          ["uza", "mauzo", "bidhaa", "duka", "soko"],
    TransactionCategory.HUDUMA:         ["huduma", "fundi", "ushauri", "kazi"],
    TransactionCategory.MALIGHAFI:      ["malighafi", "unga", "nyama", "mboga", "mafuta", "sukari",
                                         "chumvi", "vifaa", "bidhaa za kununua"],
    TransactionCategory.MISHAHARA:      ["mshahara", "mishahara", "mfanyakazi", "wafanyakazi"],
    TransactionCategory.KODI:           ["kodi", "pango", "nyumba"],
    TransactionCategory.UMEME:          ["umeme", "stima", "tanesco", "luku"],
    TransactionCategory.USAFIRI:        ["usafiri", "nauli", "gari", "boda", "pikipiki", "mafuta ya gari"],
    TransactionCategory.MATANGAZO:      ["tangazo", "matangazo", "reklama", "advertis"],
    TransactionCategory.MKOPO_ULIOLIPWA: ["mkopo", "deni", "kulipa mkopo"],
    TransactionCategory.NYINGINE_GHARAMA: [],
    TransactionCategory.NYINGINE_MAPATO: [],
}

# ── Date keywords ─────────────────────────────────────────────────────────────
DATE_KEYWORDS = {
    "leo": 0, "jana": -1, "juzi": -2, "kesho": 1,
    "wiki iliyopita": -7, "mwezi uliopita": -30,
}


# ── Result dataclass ──────────────────────────────────────────────────────────
@dataclass
class NLPResult:
    # Core extracted entities
    transaction_type: Optional[TransactionType] = None
    category: Optional[TransactionCategory] = None
    amount: Optional[float] = None
    transaction_date: Optional[datetime] = None
    description: str = ""

    # Optional enrichments
    product_name: Optional[str] = None
    quantity: Optional[float] = None
    unit_price: Optional[float] = None

    # Metadata
    confidence: float = 0.0
    raw_entities: dict = field(default_factory=dict)
    warnings: list = field(default_factory=list)


# ── Main NLP Service ──────────────────────────────────────────────────────────
class SwahiliNERService:

    def extract(self, text: str) -> NLPResult:
        """
        Main entry point. Takes raw Swahili transcript, returns NLPResult.
        """
        text_lower = text.lower().strip()
        result = NLPResult(description=text)

        result.transaction_type = self._extract_type(text_lower)
        result.amount = self._extract_amount(text_lower)
        result.transaction_date = self._extract_date(text_lower)
        result.category = self._extract_category(text_lower, result.transaction_type)
        result.product_name = self._extract_product(text_lower)
        result.quantity = self._extract_quantity(text_lower)
        result.confidence = self._compute_confidence(result)

        result.raw_entities = {
            "type": result.transaction_type,
            "amount": result.amount,
            "date": result.transaction_date.isoformat() if result.transaction_date else None,
            "category": result.category,
            "product": result.product_name,
            "quantity": result.quantity,
        }

        if result.amount is None:
            result.warnings.append("Kiasi hakikupatikana – tafadhali weka kiasi mwenyewe")
        if result.transaction_type is None:
            result.warnings.append("Aina ya muamala haijulikani – tafadhali chagua mapato au gharama")

        return result

    # ── Type detection ────────────────────────────────────────────────────────
    def _extract_type(self, text: str) -> Optional[TransactionType]:
        income_score = sum(1 for kw in INCOME_KEYWORDS if kw in text)
        expense_score = sum(1 for kw in EXPENSE_KEYWORDS if kw in text)

        if income_score > expense_score:
            return TransactionType.MAPATO
        elif expense_score > income_score:
            return TransactionType.GHARAMA
        elif income_score == expense_score and income_score > 0:
            return TransactionType.MAPATO  # default to income on tie
        return None

    # ── Amount extraction ─────────────────────────────────────────────────────
    def _extract_amount(self, text: str) -> Optional[float]:
        # 1. Numeric: "5,000" or "5000" or "50,000/="
        numeric = re.search(r'(\d[\d,\.]*)\s*(?:shilingi|tzs|/=)?', text)
        if numeric:
            raw = numeric.group(1).replace(",", "").replace(".", "")
            try:
                return float(raw)
            except ValueError:
                pass

        # 2. Swahili words: "elfu ishirini" → 20000
        return self._parse_swahili_number(text)

    def _parse_swahili_number(self, text: str) -> Optional[float]:
        total = 0
        found = False

        # Match multiplier patterns: "mia mbili", "elfu tano", "milioni moja"
        for multiplier, mult_val in SWAHILI_MULTIPLIERS.items():
            pattern = rf'(\w+(?:\s+na\s+\w+)?)\s+{multiplier}(?:\s+na\s+(\w+(?:\s+\w+)?))?'
            match = re.search(pattern, text)
            if match:
                prefix_word = match.group(1).strip()
                suffix_word = (match.group(2) or "").strip()
                prefix_val = SWAHILI_ONES.get(prefix_word, 1 if prefix_word == "" else None)
                suffix_val = SWAHILI_ONES.get(suffix_word, 0) if suffix_word else 0
                if prefix_val is not None:
                    total += prefix_val * mult_val + suffix_val
                    found = True

        # Plain ones: "tano", "kumi na mbili"
        if not found:
            for word, val in sorted(SWAHILI_ONES.items(), key=lambda x: -len(x[0])):
                if word in text:
                    return float(val)

        return float(total) if found else None

    # ── Date extraction ───────────────────────────────────────────────────────
    def _extract_date(self, text: str) -> Optional[datetime]:
        today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)

        for keyword, delta in DATE_KEYWORDS.items():
            if keyword in text:
                return today + timedelta(days=delta)

        # Explicit date: "tarehe 15 Mei" or "15/05/2026"
        date_match = re.search(r'(\d{1,2})[/\-](\d{1,2})(?:[/\-](\d{4}))?', text)
        if date_match:
            day, month = int(date_match.group(1)), int(date_match.group(2))
            year = int(date_match.group(3)) if date_match.group(3) else today.year
            try:
                return datetime(year, month, day)
            except ValueError:
                pass

        return today  # default to today

    # ── Category detection ────────────────────────────────────────────────────
    def _extract_category(
        self, text: str, tx_type: Optional[TransactionType]
    ) -> Optional[TransactionCategory]:
        scores = {}
        for category, keywords in CATEGORY_MAP.items():
            score = sum(1 for kw in keywords if kw in text)
            if score > 0:
                scores[category] = score

        if scores:
            return max(scores, key=scores.get)

        # Fallback based on type
        if tx_type == TransactionType.MAPATO:
            return TransactionCategory.MAUZO
        elif tx_type == TransactionType.GHARAMA:
            return TransactionCategory.NYINGINE_GHARAMA
        return None

    # ── Product extraction ────────────────────────────────────────────────────
    def _extract_product(self, text: str) -> Optional[str]:
        # Look for product after "uza/nunua [PRODUCT]"
        match = re.search(
            r'(?:nimenunua|nilinunua|nimeuza|niliuza|nimeona|mauzo ya)\s+([a-z\s]+?)(?:\s+\d|\s+mifuko|\s+kilo|\s+lita|,|\.|$)',
            text
        )
        if match:
            product = match.group(1).strip()
            if len(product) > 2:
                return product.title()
        return None

    # ── Quantity extraction ───────────────────────────────────────────────────
    def _extract_quantity(self, text: str) -> Optional[float]:
        # "mifuko mitano", "kilo tano", "lita tatu", "vipande kumi"
        match = re.search(
            r'(\d+(?:\.\d+)?)\s*(?:kilo|lita|mifuko|vipande|vibaba|gunia)',
            text
        )
        if match:
            return float(match.group(1))

        # Swahili number + unit
        for word, val in SWAHILI_ONES.items():
            if re.search(rf'{word}\s+(?:kilo|lita|mifuko|vipande)', text):
                return float(val)
        return None

    # ── Confidence scoring ────────────────────────────────────────────────────
    def _compute_confidence(self, result: NLPResult) -> float:
        score = 0.0
        if result.transaction_type:
            score += 0.25
        if result.amount:
            score += 0.40
        if result.category:
            score += 0.20
        if result.transaction_date:
            score += 0.15
        return round(score, 2)


# ── Singleton ─────────────────────────────────────────────────────────────────
_nlp_service: SwahiliNERService | None = None


def get_nlp_service() -> SwahiliNERService:
    global _nlp_service
    if _nlp_service is None:
        _nlp_service = SwahiliNERService()
    return _nlp_service
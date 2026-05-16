"""
backend/services/nlp/swahili_ner.py
1.3.2 – NLP Pipeline using Groq LLM (Llama 3.3 70b)

Two-step pipeline:
  1. Clean/correct noisy Whisper transcript → store as description
  2. Extract ALL transactions from clean text
"""
import re
import os
import json
import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Optional, List

try:
    from backend.models.ledger import TransactionType, TransactionCategory
except ModuleNotFoundError:
    import sys
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", ".."))
    from backend.models.ledger import TransactionType, TransactionCategory

logger = logging.getLogger(__name__)


@dataclass
class NLPResult:
    transaction_type: Optional[TransactionType] = None
    category: Optional[TransactionCategory] = None
    amount: Optional[float] = None
    transaction_date: Optional[datetime] = None
    description: str = ""           # ← stores CLEANED transcript
    product_name: Optional[str] = None
    quantity: Optional[float] = None
    unit_price: Optional[float] = None
    confidence: float = 0.0
    raw_entities: dict = field(default_factory=dict)
    warnings: list = field(default_factory=list)
    all_transactions: list = field(default_factory=list)  # ← all found transactions


class SwahiliNERService:

    def __init__(self):
        self._api_key = os.getenv("GROQ_API_KEY", "")
        if not self._api_key:
            logger.warning("GROQ_API_KEY not set – using regex fallback NLP")
            self._use_ai = False
        else:
            self._use_ai = True
            logger.info("SwahiliNERService using Groq Llama 3.3 70b")

    def extract(self, text: str) -> NLPResult:
        if self._use_ai:
            try:
                return self._extract_with_groq(text)
            except Exception as e:
                logger.error(f"Groq NLP failed, falling back to regex: {e}")
        return self._extract_with_regex(text)

    # ── Step 1: Clean transcript ──────────────────────────────────────────────
    def _clean_transcript(self, text: str) -> str:
        from groq import Groq
        client = Groq(api_key=self._api_key)

        prompt = f"""Fix spelling errors in this Swahili business text from voice recognition.
Common errors to fix:
- "harama" → "gharama"
- "miloni" → "milioni"
- "mteje" → "mteja"
- "tarahe/tarahee" → "tarehe"
- "kuminambili" → "kumi na mbili"
- "laki nini" → "laki nne"
- "malipu" → "malipo"
- "faide" → "faida"
- "thamanini" → "themanini"
- years like "1226" → "2026"
- "aituai" → "aitwaye"
- "mshoni mwasiku" → "mwishoni mwa siku"

Return ONLY the corrected Swahili text, nothing else.

Text: {text}"""

        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.0,
            max_tokens=600,
        )
        cleaned = response.choices[0].message.content.strip()
        logger.info(f"Cleaned transcript: {cleaned[:100]}...")
        return cleaned

    # ── Step 2: Extract ALL transactions ─────────────────────────────────────
    def _extract_with_groq(self, text: str) -> NLPResult:
        from groq import Groq

        clean_text = self._clean_transcript(text)
        today = datetime.utcnow().strftime("%Y-%m-%d")

        prompt = f"""You are a Swahili business transaction analyzer for East African SMEs.

Extract ALL separate transactions from this text. Each transaction should be separate.

Text: "{clean_text}"
Today: {today}

Return ONLY this JSON (no explanation):
{{
  "transactions": [
    {{
      "transaction_type": "mapato" or "gharama",
      "category": one of: "mauzo","huduma","mkopo_uliopokelewa","nyingine_mapato","malighafi","mishahara","kodi","umeme","usafiri","matangazo","mkopo_uliolipwa","nyingine_gharama",
      "amount": number,
      "transaction_date": "YYYY-MM-DD",
      "product_name": string or null,
      "quantity": number or null,
      "description": "short description in Swahili",
      "confidence": number 0.0-1.0
    }}
  ],
  "warnings": []
}}

Example for "alinunua simu 15 kwa milioni 7.5, alilipa kodi laki 3, alipata mapato milioni 2.45":
{{
  "transactions": [
    {{"transaction_type":"gharama","category":"malighafi","amount":7500000,"product_name":"Samsung Galaxy","quantity":15,"description":"Ununuzi wa simu 15 Samsung Galaxy"}},
    {{"transaction_type":"gharama","category":"kodi","amount":350000,"description":"Kodi ya duka"}},
    {{"transaction_type":"gharama","category":"usafiri","amount":80000,"description":"Gharama za usafiri"}},
    {{"transaction_type":"mapato","category":"mauzo","amount":1200000,"description":"Malipo ya simu 3 kutoka Hamad Said"}},
    {{"transaction_type":"mapato","category":"mauzo","amount":2450000,"description":"Jumla ya mauzo ya siku"}}
  ]
}}

Rules:
- "milioni saba na laki tano" = 7500000
- "laki tatu na nusu" = 350000  
- "elfu themanini" = 80000
- "milioni moja na laki mbili" = 1200000
- "milioni mbili laki nne na hamsini" = 2450000
- "laki sita na ishirini" = 620000 (faida)
- Return ONLY the JSON"""

        client = Groq(api_key=self._api_key)
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.0,
            max_tokens=800,
        )

        raw = response.choices[0].message.content.strip()
        raw = re.sub(r'^```(?:json)?\s*', '', raw)
        raw = re.sub(r'\s*```$', '', raw)

        data = json.loads(raw)
        transactions = data.get("transactions", [])
        warnings = data.get("warnings", [])

        # Build primary result from first transaction
        primary = transactions[0] if transactions else {}
        result = self._build_result(primary, clean_text, warnings)

        # Store ALL transactions for frontend to display
        result.all_transactions = transactions

        return result

    def _build_result(self, data: dict, text: str, warnings: list = []) -> NLPResult:
        today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        result = NLPResult(description=text)  # description = cleaned transcript

        tx_type = data.get("transaction_type")
        if tx_type == "mapato":
            result.transaction_type = TransactionType.MAPATO
        elif tx_type == "gharama":
            result.transaction_type = TransactionType.GHARAMA

        cat = data.get("category")
        try:
            result.category = TransactionCategory(cat) if cat else None
        except ValueError:
            result.category = None

        amt = data.get("amount")
        result.amount = float(amt) if amt is not None else None

        date_str = data.get("transaction_date")
        if date_str:
            try:
                result.transaction_date = datetime.strptime(date_str, "%Y-%m-%d")
            except ValueError:
                result.transaction_date = today
        else:
            result.transaction_date = today

        result.product_name = data.get("product_name")
        qty = data.get("quantity")
        result.quantity = float(qty) if qty is not None else None
        result.confidence = float(data.get("confidence", 0.8))
        result.warnings = list(warnings)

        if result.amount is None:
            result.warnings.append("Kiasi hakikupatikana – tafadhali weka kiasi mwenyewe")
        if result.transaction_type is None:
            result.warnings.append("Aina ya muamala haijulikani – tafadhali chagua mapato au gharama")

        result.raw_entities = {
            "type":     result.transaction_type,
            "amount":   result.amount,
            "date":     result.transaction_date.isoformat() if result.transaction_date else None,
            "category": result.category,
            "product":  result.product_name,
            "quantity": result.quantity,
        }
        return result

    # ── Regex fallback ────────────────────────────────────────────────────────
    def _extract_with_regex(self, text: str) -> NLPResult:
        text_lower = text.lower().strip()
        result = NLPResult(description=text)
        result.transaction_type  = self._regex_type(text_lower)
        result.transaction_date  = self._regex_date(text_lower)
        result.amount            = self._regex_amount(text_lower)
        result.category          = self._regex_category(text_lower, result.transaction_type)
        result.product_name      = self._regex_product(text_lower)
        result.quantity          = self._regex_quantity(text_lower)
        result.confidence        = self._compute_confidence(result)
        result.raw_entities = {
            "type":     result.transaction_type,
            "amount":   result.amount,
            "date":     result.transaction_date.isoformat() if result.transaction_date else None,
            "category": result.category,
            "product":  result.product_name,
            "quantity": result.quantity,
        }
        if result.amount is None:
            result.warnings.append("Kiasi hakikupatikana – tafadhali weka kiasi mwenyewe")
        if result.transaction_type is None:
            result.warnings.append("Aina ya muamala haijulikani – tafadhali chagua mapato au gharama")
        return result

    def _regex_type(self, text):
        income_kw  = ["nimeuza","niliuza","nikauza","mauzo","mapato","nimepata",
                       "nilipata","huduma","faida","walilipa","wateja","alipokea"]
        expense_kw = ["nimenunua","nilinunua","nikanunua","alinunua","gharama",
                       "nililipa","alilipa","kodi","mishahara","umeme","usafiri","nimelipa"]
        inc = sum(1 for kw in income_kw  if kw in text)
        exp = sum(1 for kw in expense_kw if kw in text)
        if inc > exp:  return TransactionType.MAPATO
        if exp > inc:  return TransactionType.GHARAMA
        if inc > 0:    return TransactionType.MAPATO
        return None

    SWAHILI_ONES = {
        "moja":1,"mbili":2,"tatu":3,"nne":4,"tano":5,"sita":6,"saba":7,
        "nane":8,"tisa":9,"kumi":10,"kumi na moja":11,"kumi na mbili":12,
        "kumi na tatu":13,"kumi na nne":14,"kumi na tano":15,"kumi na sita":16,
        "kumi na saba":17,"kumi na nane":18,"kumi na tisa":19,
        "ishirini":20,"thelathini":30,"arobaini":40,"hamsini":50,
        "sitini":60,"sabini":70,"themanini":80,"tisini":90,
    }
    SWAHILI_MULTIPLIERS = {"milioni":1_000_000,"laki":100_000,"elfu":1_000,"mia":100}

    def _parse_swahili_number(self, text):
        total = 0.0
        remaining = text
        for mult, mult_val in self.SWAHILI_MULTIPLIERS.items():
            m = re.search(rf'(\w+(?:\s+na\s+\w+)?)\s+{mult}', remaining)
            if m:
                pval = self.SWAHILI_ONES.get(m.group(1).strip(),
                       1 if mult == "mia" else None)
                if pval is not None:
                    total += pval * mult_val
                    remaining = remaining.replace(m.group(0), "", 1)
        for word, val in sorted(self.SWAHILI_ONES.items(), key=lambda x: -len(x[0])):
            if re.search(rf'\b{word}\b', remaining):
                total += val
                break
        return float(total) if total > 0 else None

    def _regex_amount(self, text):
        clean = re.sub(r'\d{1,2}[/\-]\d{1,2}(?:[/\-]\d{4})?', '', text)
        word_amt = self._parse_swahili_number(clean)
        if word_amt and word_amt >= 100: return word_amt
        m = re.search(r'(\d[\d,\.]*)\s*(?:shilingi|tzs|/=)?', clean)
        if m:
            try:
                val = float(m.group(1).replace(",","").replace(".",""))
                if val >= 1: return val
            except ValueError: pass
        return word_amt

    def _regex_date(self, text):
        today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        for kw, d in {"wiki iliyopita":-7,"mwezi uliopita":-30,"juzi":-2,"jana":-1,"leo":0,"kesho":1}.items():
            if kw in text: return today + timedelta(days=d)
        return today

    def _regex_category(self, text, tx_type):
        cat_map = {
            TransactionCategory.MAUZO:           ["uza","mauzo","bidhaa","duka","soko","wateja"],
            TransactionCategory.HUDUMA:          ["huduma","fundi","ushauri","kazi"],
            TransactionCategory.MALIGHAFI:       ["malighafi","unga","nyama","mboga","mafuta","sukari","mahindi","mchele","samaki","ndizi","simu","vifaa"],
            TransactionCategory.MISHAHARA:       ["mshahara","mishahara","mfanyakazi","kibarua"],
            TransactionCategory.KODI:            ["kodi","pango","nyumba"],
            TransactionCategory.UMEME:           ["umeme","stima","tanesco","luku"],
            TransactionCategory.USAFIRI:         ["usafiri","nauli","gari","boda","pikipiki","daladala"],
            TransactionCategory.MATANGAZO:       ["tangazo","matangazo","reklama"],
            TransactionCategory.MKOPO_ULIOLIPWA: ["mkopo","deni"],
        }
        scores = {c: sum(1 for kw in kws if kw in text) for c, kws in cat_map.items()}
        scores = {k:v for k,v in scores.items() if v > 0}
        if scores: return max(scores, key=scores.get)
        if tx_type == TransactionType.MAPATO:  return TransactionCategory.MAUZO
        if tx_type == TransactionType.GHARAMA: return TransactionCategory.NYINGINE_GHARAMA
        return None

    def _regex_product(self, text):
        known = ["ndizi","mahindi","mchele","unga","sukari","mafuta","chumvi",
                 "maharage","nyanya","vitunguu","nyama","samaki","mayai","maziwa",
                 "chapati","mkate","sabuni","soda","viazi","simu","samsung","vifaa"]
        for p in known:
            if p in text: return p.title()
        return None

    def _regex_quantity(self, text):
        units = r'(?:kilo|kg|lita|mifuko|vipande|vibaba|gunia|debe)'
        m = re.search(rf'(\d+(?:\.\d+)?)\s*{units}', text)
        if m: return float(m.group(1))
        for word, val in self.SWAHILI_ONES.items():
            if re.search(rf'{units}\s+{word}|{word}\s+{units}', text):
                return float(val)
        return None

    def _compute_confidence(self, result):
        score = 0.0
        if result.transaction_type: score += 0.25
        if result.amount:           score += 0.40
        if result.category:         score += 0.20
        if result.transaction_date: score += 0.10
        if result.product_name:     score += 0.05
        return round(min(score, 1.0), 2)


# ── Singleton ─────────────────────────────────────────────────────────────────
_nlp_service: SwahiliNERService | None = None

def get_nlp_service() -> SwahiliNERService:
    global _nlp_service
    if _nlp_service is None:
        _nlp_service = SwahiliNERService()
    return _nlp_service
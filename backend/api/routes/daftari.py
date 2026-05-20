"""
backend/api/routes/daftari.py
REST API routes for Module 1: Daftari Yangu

Merged version: keeps YOUR async SQLAlchemy backend + HIS fixes for
INTERVAL f-string, health card PDF, top-products, spending, and sync.

Endpoints:
  POST /api/v1/daftari/transcribe          - Upload audio -> ASR -> NLP
  POST /api/v1/daftari/transactions        - Create transaction
  GET  /api/v1/daftari/transactions        - List transactions
  DELETE /api/v1/daftari/transactions/{id} - Delete transaction
  GET  /api/v1/daftari/summary             - Summary stats
  GET  /api/v1/daftari/top-products        - Top products
  GET  /api/v1/daftari/spending            - Spending by category
  POST /api/v1/daftari/sync                - Flush offline sync queue
  GET  /api/v1/daftari/sync/status         - Sync status
  GET  /api/v1/daftari/health-card         - Generate Business Health Card PDF
"""
# ── Path fix ──────────────────────────────────────────────────────────────────
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))
# ─────────────────────────────────────────────────────────────────────────────

import io
from datetime import datetime
from typing import Literal, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from api.routes.dashboard import query_db, scalar_db, get_db
from db.database import get_db
from models.ledger import TransactionCategory, TransactionType
from services.asr.whisper_service import get_asr_service
from services.nlp.swahili_ner import get_nlp_service
from services import ledger_service
from services.pdf.health_card import generate_health_card
from models.user import User

router = APIRouter(prefix="/daftari", tags=["Daftari Yangu"])


# ── Pydantic models ───────────────────────────────────────────────────────────

class TranscribeResponse(BaseModel):
    transcript: str           # cleaned transcript (corrected by Groq)
    raw_transcript: str       # original noisy Whisper output
    language: str
    confidence: float
    duration_seconds: float
    nlp: dict


class CreateTransactionRequest(BaseModel):
    user_id: str
    # ✅ Match your SQL CHECK: 'mapato','gharama','income','expense'
    type: Literal["mapato", "gharama", "income", "expense"]
    # ✅ Plain string — your DB stores varchar, not an enum type
    category: str
    amount: float = Field(gt=0)
    description: str = ""
    transaction_date: Optional[datetime] = None
    source: str = "manual"
    raw_transcript: Optional[str] = None
    nlp_confidence: Optional[float] = None
    product_name: Optional[str] = None
    quantity: Optional[float] = None
    unit_price: Optional[float] = None
    nlp_entities: Optional[dict] = None
    local_id: Optional[str] = None


# ── 1.3.1 + 1.3.2  Transcribe + NLP ─────────────────────────────────────────

@router.post("/transcribe", response_model=TranscribeResponse,
             summary="Rekodi sauti -> maandishi (ASR + NLP)")
async def transcribe_audio(
    user_id: str = Form(...),
    audio: UploadFile = File(...),
):
    audio_bytes = await audio.read()
    if len(audio_bytes) == 0:
        raise HTTPException(400, "Faili la sauti liko tupu / Audio file is empty")

    # --- Start the global try block here ---
    try:
        asr = get_asr_service()
        try:
            asr_result = await asr.transcribe(audio_bytes, filename=audio.filename or "audio.webm")
        except RuntimeError as e:
            raise HTTPException(500, str(e))

        nlp = get_nlp_service()
        nlp_result = nlp.extract(asr_result.transcript)

        # nlp_result.description holds the CLEANED transcript from Groq
        cleaned_transcript = nlp_result.description if nlp_result.description else asr_result.transcript

        return TranscribeResponse(
            transcript=cleaned_transcript,
            raw_transcript=asr_result.transcript,
            language=asr_result.language,
            confidence=asr_result.confidence,
            duration_seconds=asr_result.duration_seconds,
            nlp={
                "transaction_type": nlp_result.transaction_type.value if nlp_result.transaction_type else None,
                "category":         nlp_result.category.value if nlp_result.category else None,
                "amount":           nlp_result.amount,
                "transaction_date": nlp_result.transaction_date.isoformat() if nlp_result.transaction_date else None,
                "product_name":     nlp_result.product_name,
                "quantity":         nlp_result.quantity,
                "confidence":       nlp_result.confidence,
                "warnings":         nlp_result.warnings,
                "all_transactions": getattr(nlp_result, "all_transactions", []),
            },
        )

    # --- The except blocks now properly close the parent try block ---
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Daftari] Create error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ── 1.3.3  Ledger CRUD ────────────────────────────────────────────────────────

@router.post("/transactions", summary="Ongeza muamala mpya (Create transaction)")
async def create_transaction(
    req: CreateTransactionRequest,
    db: AsyncSession = Depends(get_db),
):
    await ledger_service.get_or_create_user(db, req.user_id)

    # ✅ Normalize: treat 'income'→'mapato', 'expense'→'gharama' for consistency
    tx_type_str = req.type
    if tx_type_str == "income":
        tx_type_str = "mapato"
    elif tx_type_str == "expense":
        tx_type_str = "gharama"

    # ✅ Compute revenue/cost/profit based on type string directly
    amount = float(req.amount)
    if tx_type_str == "mapato":
        revenue, cost = amount, 0.0
    else:
        revenue, cost = 0.0, amount
    profit = revenue - cost

    # ✅ Use raw SQL insert to bypass SQLAlchemy enum mismatch entirely
    from sqlalchemy import text as sql_text
    import uuid as uuid_lib

    tx_id = str(uuid_lib.uuid4())
    tx_date = req.transaction_date.date() if req.transaction_date else None

    await db.execute(sql_text("""
        INSERT INTO transactions (
            id, user_id, type, category, amount, revenue, cost, profit,
            description, product_name, quantity, unit_price,
            source, raw_transcript, nlp_confidence, nlp_entities,
            local_id, is_synced, transaction_date, currency
        ) VALUES (
            :id, :user_id, :type, :category, :amount, :revenue, :cost, :profit,
            :description, :product_name, :quantity, :unit_price,
            :source, :raw_transcript, :nlp_confidence, :nlp_entities::jsonb,
            :local_id, true, COALESCE(:transaction_date, CURRENT_DATE), 'TZS'
        )
    """), {
        "id":               tx_id,
        "user_id":          req.user_id,
        "type":             tx_type_str,
        "category":         req.category or "nyingine_gharama",
        "amount":           amount,
        "revenue":          revenue,
        "cost":             cost,
        "profit":           profit,
        "description":      req.description or "",
        "product_name":     req.product_name,
        "quantity":         req.quantity,
        "unit_price":       req.unit_price,
        "source":           req.source or "manual",
        "raw_transcript":   req.raw_transcript,
        "nlp_confidence":   req.nlp_confidence,
        "nlp_entities":     json.dumps(req.nlp_entities) if req.nlp_entities else None,
        "local_id":         req.local_id,
        "transaction_date": tx_date,
    })
    await db.commit()

    return {
        "id":        tx_id,
        "status":    "created",
        "amount":    amount,
        "revenue":   revenue,
        "cost":      cost,
        "profit":    profit,
        "type":      tx_type_str,
        "category":  req.category,
        "timestamp": datetime.utcnow().isoformat(),
        "is_synced": True,
    }


@router.get("/transactions", summary="Orodha ya miamala (List transactions)")
async def list_transactions(
    user_id: str = Query(...),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    type: Optional[TransactionType] = Query(None),
    category: Optional[TransactionCategory] = Query(None),
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    txs = await ledger_service.get_transactions(
        db, user_id, limit, offset, type, category, date_from, date_to
    )
    return [
        {
            "id":               t.id,
            "type":             t.type.value,
            "category":         t.category.value,
            "amount":           t.amount,
            "revenue":          t.revenue,
            "cost":             t.cost,
            "profit":           t.profit,
            "description":      t.description,
            "transaction_date": t.timestamp.isoformat(),
            "source":           t.source.value if t.source else "manual",
            "product_name":     t.product_name,
            "quantity":         t.quantity,
            "nlp_confidence":   t.nlp_confidence,
            "is_synced":        t.is_synced,
            "created_at":       t.created_at.isoformat(),
        }
        for t in txs
    ]


@router.delete("/transactions/{tx_id}", summary="Futa muamala (Delete transaction)")
async def delete_transaction(
    tx_id: str,
    user_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    deleted = await ledger_service.delete_transaction(db, tx_id, user_id)
    if not deleted:
        raise HTTPException(404, "Muamala haujapatikana / Transaction not found")
    return {"status": "deleted", "id": tx_id}


# ── Summary ───────────────────────────────────────────────────────────────────

@router.get("/summary", summary="Muhtasari wa biashara (Business summary)")
async def get_summary(
    user_id: str = Query(...),
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
):
    return await ledger_service.get_summary(db, user_id, days)


@router.get("/top-products", summary="Bidhaa bora (Top products)")
async def get_top_products(
    user_id: str = Query(...),
    days: int = Query(30, ge=1, le=365),
    limit: int = Query(5, ge=1, le=20),
    db: AsyncSession = Depends(get_db),
):
    # HIS fix: use f-string for INTERVAL in raw SQL
    sql = text(f"""
        SELECT COALESCE(product_name, category, 'Nyingine') AS name,
               SUM(amount) AS revenue
        FROM transactions
        WHERE user_id = :user_id AND type = 'mapato'
          AND transaction_date >= CURRENT_DATE - INTERVAL '{days} days'
        GROUP BY name ORDER BY revenue DESC LIMIT {limit}
    """)
    result = await db.execute(sql, {"user_id": user_id})
    rows = result.mappings().all()
    return [{"name": r["name"], "revenue": float(r["revenue"])} for r in rows]


@router.get("/spending", summary="Gharama kwa aina (Spending by category)")
async def get_spending(
    user_id: str = Query(...),
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
):
    # HIS fix: use f-string for INTERVAL in raw SQL
    sql = text(f"""
        SELECT COALESCE(category, 'Nyingine') AS category, SUM(amount) AS amount
        FROM transactions
        WHERE user_id = :user_id AND type = 'gharama'
          AND transaction_date >= CURRENT_DATE - INTERVAL '{days} days'
        GROUP BY category ORDER BY amount DESC
    """)
    result = await db.execute(sql, {"user_id": user_id})
    rows = result.mappings().all()
    total = sum(float(r["amount"]) for r in rows) or 1
    return [
        {
            "category": r["category"],
            "amount":   float(r["amount"]),
            "percent":  round(float(r["amount"]) / total * 100, 1),
        }
        for r in rows
    ]


# ── Sync ──────────────────────────────────────────────────────────────────────

@router.post("/sync", summary="Sawazisha miamala (Sync offline queue)")
async def sync_transactions(
    user_id: str,
    db: AsyncSession = Depends(get_db),
):
    pending = await ledger_service.get_pending_sync_count(db, user_id)
    if pending == 0:
        return {"status": "ok", "synced": 0, "message": "Hakuna data inayohitaji kusawazishwa"}
    result = await ledger_service.flush_sync_queue(db, user_id)
    return {"status": "ok", **result}


@router.get("/sync/status", summary="Hali ya usawazishaji (Sync status)")
async def sync_status(
    user_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    pending = await ledger_service.get_pending_sync_count(db, user_id)
    return {
        "pending_sync": pending,
        "is_synced":    pending == 0,
        "message":      "Imesawazishwa" if pending == 0 else f"Miamala {pending} inasubiri kusawazishwa",
    }


# ── 1.3.4  Health Card PDF ────────────────────────────────────────────────────

@router.get("/health-card", summary="Tengeneza Kadi ya Afya ya Biashara (PDF)")
async def get_health_card(
    user_id: str = Query(...),
    days: int = Query(90, ge=30, le=365),
    db: AsyncSession = Depends(get_db),
):
    # Try YOUR service first (generate_health_card from pdf module)
    user_q = select(User).where(User.id == user_id)
    user = (await db.execute(user_q)).scalar_one_or_none()

    if not user:
        raise HTTPException(404, "Mtumiaji hajapatikana. Kwanza ingiza muamala mmoja.")

    summary      = await ledger_service.get_summary(db, user_id, days)
    top_products = await ledger_service.get_top_products(db, user_id, days)
    spending     = await ledger_service.get_spending_by_category(db, user_id, days)

    try:
        pdf_bytes = generate_health_card(
            business_name=user.business_name,
            owner_name=user.name,
            summary=summary,
            top_products=top_products,
            spending_by_category=spending,
            transactions_count=summary["transactions_count"],
            days=days,
            phone=user.phone,
        )
    except Exception:
        # HIS fallback: build PDF inline with reportlab if service fails
        pdf_bytes = _generate_health_card_fallback(user, summary, days)

    filename = (
        f"kadi-afya-{user.business_name.replace(' ', '-').lower()}"
        f"-{datetime.utcnow().strftime('%Y%m%d')}.pdf"
    )
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def _generate_health_card_fallback(user, summary: dict, days: int) -> bytes:
    """HIS inline reportlab PDF as fallback."""
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib import colors
        from reportlab.lib.units import cm
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

        revenue = float(summary.get("total_revenue", 0) or 0)
        cost    = float(summary.get("total_cost",    0) or 0)
        profit  = revenue - cost
        margin  = round((profit / revenue) * 100, 1) if revenue else 0

        buffer = io.BytesIO()
        doc    = SimpleDocTemplate(buffer, pagesize=A4, topMargin=2*cm)
        styles = getSampleStyleSheet()
        green  = colors.HexColor("#1a6b3a")

        title_style = ParagraphStyle(
            "Title", parent=styles["Title"],
            textColor=green, fontSize=20, spaceAfter=6,
        )

        story = [
            Paragraph("Kadi ya Afya ya Biashara", title_style),
            Paragraph("Business Health Card — SwahiliSME Platform", styles["Normal"]),
            Spacer(1, 0.5*cm),
            Paragraph(f"<b>Jina la Biashara:</b> {user.business_name}", styles["Normal"]),
            Paragraph(f"<b>Mmiliki:</b> {user.name}", styles["Normal"]),
            Paragraph(f"<b>Kipindi:</b> Siku {days} zilizopita", styles["Normal"]),
            Paragraph(f"<b>Tarehe:</b> {datetime.now().date()}", styles["Normal"]),
            Spacer(1, 0.5*cm),
        ]

        data = [
            ["Kiashiria",        "Kiasi (TZS)"],
            ["Mapato (Jumla)",    f"{revenue:,.0f}"],
            ["Gharama (Jumla)",   f"{cost:,.0f}"],
            ["Faida Halisi",      f"{profit:,.0f}"],
            ["Asilimia Faida",    f"{margin}%"],
            ["Idadi ya Miamala",  str(int(summary.get("transactions_count", 0) or 0))],
        ]
        tbl = Table(data, colWidths=[9*cm, 6*cm])
        tbl.setStyle(TableStyle([
            ("BACKGROUND",    (0,0), (-1,0),  green),
            ("TEXTCOLOR",     (0,0), (-1,0),  colors.white),
            ("FONTNAME",      (0,0), (-1,0),  "Helvetica-Bold"),
            ("FONTSIZE",      (0,0), (-1,-1), 11),
            ("ROWBACKGROUNDS",(0,1), (-1,-1), [colors.white, colors.HexColor("#f0f9f4")]),
            ("GRID",          (0,0), (-1,-1), 0.5, colors.HexColor("#d1fae5")),
            ("LEFTPADDING",   (0,0), (-1,-1), 10),
            ("TOPPADDING",    (0,0), (-1,-1), 6),
            ("BOTTOMPADDING", (0,0), (-1,-1), 6),
        ]))
        story.append(tbl)
        story.append(Spacer(1, 1*cm))
        story.append(Paragraph(
            "<i>Hii ni muhtasari wa data ya biashara yako kwa matumizi ya maombi ya mkopo.</i>",
            styles["Normal"],
        ))
        story.append(Spacer(1, 0.4*cm))
        story.append(Paragraph(
            "<b>SwahiliSME Platform</b> • DASUC 2026 • Teknolojia kwa Lugha Yetu",
            styles["Normal"],
        ))

        doc.build(story)
        buffer.seek(0)
        return buffer.read()

    except ImportError:
        raise HTTPException(501, "reportlab not installed. Run: pip install reportlab")

class TextTransactionRequest(BaseModel):
    user_id: str
    text: str
    # ✅ Optional structured fields from manual form (prefixed with _)
    # When present, use directly instead of relying on NLP
    _type: Optional[str] = None
    _category: Optional[str] = None
    _amount: Optional[float] = None
    _product_name: Optional[str] = None
    _description: Optional[str] = None
    _transaction_date: Optional[str] = None
    _quantity: Optional[float] = None

    model_config = {"populate_by_name": True}

@router.post("/text", summary="Ingiza muamala kwa maandishi ya kawaida")
async def create_transaction_from_text(
    body: TextTransactionRequest,
    db: AsyncSession = Depends(get_db),
):
    try:
        # ── Use structured fields if provided by frontend ──────────────
        amount   = float(body._amount or 0)
        has_structured = amount > 0 and body._type

        if has_structured:
            tx_type_str = body._type        # "mapato" or "gharama"
            category    = body._category or ("nyingine_mapato" if tx_type_str == "mapato" else "nyingine_gharama")
            product     = body._product_name
            description = body._description or body.text
            quantity    = body._quantity
            tx_date     = None
            if body._transaction_date:
                try:
                    from datetime import date as date_type
                    tx_date = datetime.strptime(body._transaction_date, "%Y-%m-%d").date()
                except ValueError:
                    tx_date = None
        else:
            # ── Run NLP on the text ────────────────────────────────────
            nlp        = get_nlp_service()
            nlp_result = nlp.extract(body.text)

            # ✅ Use string comparison — never reference TransactionType.MAPATO
            raw_type    = ""
            if nlp_result.transaction_type:
                raw_type = str(nlp_result.transaction_type.value) if hasattr(nlp_result.transaction_type, "value") else str(nlp_result.transaction_type)

            tx_type_str = "gharama" if "gharama" in raw_type.lower() or "expense" in raw_type.lower() else "mapato"
            amount      = float(nlp_result.amount or 0)
            category    = ""
            if nlp_result.category:
                category = nlp_result.category.value if hasattr(nlp_result.category, "value") else str(nlp_result.category)
            if not category:
                category = "nyingine_mapato" if tx_type_str == "mapato" else "nyingine_gharama"
            product     = nlp_result.product_name
            description = body.text
            quantity    = nlp_result.quantity
            tx_date     = nlp_result.transaction_date.date() if nlp_result.transaction_date else None

        # ── Compute financials ─────────────────────────────────────────
        revenue = amount if tx_type_str == "mapato"  else 0.0
        cost    = amount if tx_type_str == "gharama" else 0.0
        profit  = revenue - cost

        # ── Ensure user exists ─────────────────────────────────────────
        await ledger_service.get_or_create_user(db, body.user_id)

        # ── Insert using raw SQL — avoids ALL enum issues ──────────────
        import uuid as uuid_lib
        from sqlalchemy import text as sql_text

        tx_id = str(uuid_lib.uuid4())

        await db.execute(sql_text("""
            INSERT INTO transactions (
                id, user_id, type, category,
                amount, revenue, cost, profit,
                description, product_name, quantity,
                source, raw_transcript, is_synced,
                transaction_date, currency
            ) VALUES (
                :id, :user_id, :type, :category,
                :amount, :revenue, :cost, :profit,
                :description, :product_name, :quantity,
                'manual', :raw_transcript, true,
                COALESCE(:transaction_date, CURRENT_DATE), 'TZS'
            )
        """), {
            "id":               tx_id,
            "user_id":          body.user_id,
            "type":             tx_type_str,
            "category":         category,
            "amount":           amount,
            "revenue":          revenue,
            "cost":             cost,
            "profit":           profit,
            "description":      description,
            "product_name":     product,
            "quantity":         quantity,
            "raw_transcript":   body.text,
            "transaction_date": tx_date,
        })
        await db.commit()

        return {
            "success": True,
            "id":      tx_id,
            "type":    tx_type_str,
            "amount":  amount,
            "revenue": revenue,
            "cost":    cost,
            "profit":  profit,
        }

    except Exception as e:
        await db.rollback()
        import traceback
        traceback.print_exc()   # ← prints full error to Railway logs
        raise HTTPException(status_code=500, detail=str(e))

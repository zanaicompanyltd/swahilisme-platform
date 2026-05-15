"""
backend/api/routes/daftari.py
REST API routes for Module 1: Daftari Yangu

Endpoints:
  POST /api/v1/daftari/transcribe         – Upload audio → ASR → NLP
  POST /api/v1/daftari/transactions       – Create transaction (manual or from NLP)
  GET  /api/v1/daftari/transactions       – List transactions with filters
  DELETE /api/v1/daftari/transactions/{id} – Delete transaction
  GET  /api/v1/daftari/summary            – Summary stats
  GET  /api/v1/daftari/top-products       – Top performing products
  GET  /api/v1/daftari/spending           – Spending by category
  POST /api/v1/daftari/sync               – Flush offline sync queue
  GET  /api/v1/daftari/health-card        – Generate Business Health Card PDF
"""
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.database import get_db
from backend.models.ledger import TransactionCategory, TransactionType
from backend.services.asr.whisper_service import get_asr_service
from backend.services.nlp.swahili_ner import get_nlp_service
from backend.services import ledger_service
from backend.services.pdf.health_card import generate_health_card

router = APIRouter(prefix="/api/v1/daftari", tags=["Daftari Yangu"])


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class TranscribeResponse(BaseModel):
    transcript: str
    language: str
    confidence: float
    duration_seconds: float
    nlp: dict


class CreateTransactionRequest(BaseModel):
    user_id: str
    type: TransactionType
    category: TransactionCategory
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


class TransactionResponse(BaseModel):
    id: str
    user_id: str
    type: str
    category: str
    amount: float
    description: str
    transaction_date: str
    source: str
    product_name: Optional[str]
    quantity: Optional[float]
    nlp_confidence: Optional[float]
    is_synced: bool
    created_at: str

    class Config:
        from_attributes = True


# ── 1.3.1 + 1.3.2  Transcribe + NLP ─────────────────────────────────────────

@router.post("/transcribe", response_model=TranscribeResponse, summary="Rekodi sauti → maandishi (ASR + NLP)")
async def transcribe_audio(
    user_id: str = Form(...),
    audio: UploadFile = File(...),
):
    """
    Upload an audio file (webm/wav/mp3/ogg).
    Returns Swahili transcript + NLP-extracted entities (amount, category, date).
    """
    audio_bytes = await audio.read()

    if len(audio_bytes) == 0:
        raise HTTPException(400, "Faili la sauti liko tupu / Audio file is empty")

    # ASR
    asr = get_asr_service()
    try:
        asr_result = await asr.transcribe(audio_bytes, filename=audio.filename or "audio.webm")
    except RuntimeError as e:
        raise HTTPException(500, str(e))

    # NLP
    nlp = get_nlp_service()
    nlp_result = nlp.extract(asr_result.transcript)

    return TranscribeResponse(
        transcript=asr_result.transcript,
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
        },
    )


# ── 1.3.3  Ledger CRUD ────────────────────────────────────────────────────────

@router.post("/transactions", summary="Ongeza muamala mpya (Create transaction)")
async def create_transaction(
    req: CreateTransactionRequest,
    db: AsyncSession = Depends(get_db),
):
    # Ensure user exists
    await ledger_service.get_or_create_user(db, req.user_id)

    tx = await ledger_service.create_transaction(
        db=db,
        user_id=req.user_id,
        tx_type=req.type,
        category=req.category,
        amount=req.amount,
        description=req.description,
        transaction_date=req.transaction_date,
        source=req.source,
        raw_transcript=req.raw_transcript,
        nlp_confidence=req.nlp_confidence,
        product_name=req.product_name,
        quantity=req.quantity,
        unit_price=req.unit_price,
        nlp_entities=req.nlp_entities,
        local_id=req.local_id,
    )

    return {
        "id": tx.id,
        "status": "created",
        "amount": tx.amount,
        "type": tx.type.value,
        "category": tx.category.value,
        "is_synced": tx.is_synced,
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
            "id": t.id,
            "type": t.type.value,
            "category": t.category.value,
            "amount": t.amount,
            "description": t.description,
            "transaction_date": t.transaction_date.isoformat(),
            "source": t.source,
            "product_name": t.product_name,
            "quantity": t.quantity,
            "nlp_confidence": t.nlp_confidence,
            "is_synced": t.is_synced,
            "created_at": t.created_at.isoformat(),
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


# ── Summary endpoints ─────────────────────────────────────────────────────────

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
    return await ledger_service.get_top_products(db, user_id, days, limit)


@router.get("/spending", summary="Gharama kwa aina (Spending by category)")
async def get_spending(
    user_id: str = Query(...),
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
):
    return await ledger_service.get_spending_by_category(db, user_id, days)


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
        "is_synced": pending == 0,
        "message": "Imesawazishwa" if pending == 0 else f"Miamala {pending} inasubiri kusawazishwa",
    }


# ── 1.3.4  Health Card PDF ────────────────────────────────────────────────────

@router.get("/health-card", summary="Tengeneza Kadi ya Afya ya Biashara (PDF)")
async def get_health_card(
    user_id: str = Query(...),
    days: int = Query(90, ge=30, le=365),
    db: AsyncSession = Depends(get_db),
):
    """
    Generate Business Health Card PDF.
    Requires user to exist and have at least 1 transaction.
    """
    # Fetch user
    from sqlalchemy import select
    from backend.models.ledger import User
    user_q = select(User).where(User.id == user_id)
    user = (await db.execute(user_q)).scalar_one_or_none()
    if not user:
        raise HTTPException(404, "Mtumiaji hajapatikana. Kwanza ingiza muamala mmoja.")

    summary = await ledger_service.get_summary(db, user_id, days)
    top_products = await ledger_service.get_top_products(db, user_id, days)
    spending = await ledger_service.get_spending_by_category(db, user_id, days)

    pdf_bytes = generate_health_card(
        business_name=user.business_name,
        owner_name=user.owner_name,
        summary=summary,
        top_products=top_products,
        spending_by_category=spending,
        transactions_count=summary["transactions_count"],
        days=days,
        phone=user.phone,
    )

    filename = f"kadi-afya-{user.business_name.replace(' ', '-').lower()}-{datetime.utcnow().strftime('%Y%m%d')}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
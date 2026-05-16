"""
1.3 Module 1: Daftari Yangu — Backend Routes
FIXES: INTERVAL f-string, SSL for Supabase connection
"""
from fastapi import APIRouter, UploadFile, File, Form, Query, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import os, io, json

from api.routes.dashboard import query_db, scalar_db, get_db

router = APIRouter()


# ── Pydantic models ───────────────────────────────────────────────────────────

class TransactionIn(BaseModel):
    user_id:          str
    type:             str
    category:         str
    amount:           float
    description:      Optional[str]   = None
    transaction_date: Optional[str]   = None
    source:           Optional[str]   = "manual"
    raw_transcript:   Optional[str]   = None
    nlp_confidence:   Optional[float] = None
    product_name:     Optional[str]   = None
    quantity:         Optional[float] = None
    nlp_entities:     Optional[dict]  = None


# ── 1.3.3 CREATE transaction ──────────────────────────────────────────────────

@router.post("/transactions")
async def create_transaction(tx: TransactionIn):
    """Save a transaction to Supabase."""
    try:
        conn = get_db()
        if not conn:
            raise HTTPException(status_code=503, detail="Database unavailable")

        cur = conn.cursor()
        cur.execute("""
            INSERT INTO transactions (
                user_id, type, category, amount, description,
                transaction_date, source, raw_transcript, nlp_confidence,
                product_name, quantity, is_synced
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, true)
            RETURNING id, user_id, type, category, amount, description,
                      transaction_date, source, is_synced, created_at
        """, (
            tx.user_id, tx.type, tx.category, tx.amount,
            tx.description,
            tx.transaction_date or datetime.now().date().isoformat(),
            tx.source, tx.raw_transcript, tx.nlp_confidence,
            tx.product_name, tx.quantity,
        ))
        row = dict(cur.fetchone())
        conn.commit()
        conn.close()

        # Serialise date fields
        for k in ("transaction_date", "created_at"):
            if k in row and hasattr(row[k], "isoformat"):
                row[k] = row[k].isoformat()

        return row

    except HTTPException:
        raise
    except Exception as e:
        print(f"[Daftari] Create error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ── 1.3.3 LIST transactions ───────────────────────────────────────────────────

@router.get("/transactions")
async def list_transactions(
    user_id: str,
    limit:   int = Query(30, ge=1, le=200),
    offset:  int = 0,
    type:    Optional[str] = None,
):
    """List user's transactions, newest first."""
    # FIX: LIMIT and OFFSET use f-string, not %s
    base_sql = """
        SELECT id, user_id, type, category, amount, description,
               transaction_date, source, product_name, quantity,
               is_synced, created_at
        FROM transactions
        WHERE user_id = %s
    """
    params = [user_id]

    if type:
        base_sql += " AND type = %s"
        params.append(type)

    base_sql += f" ORDER BY transaction_date DESC, created_at DESC LIMIT {limit} OFFSET {offset}"

    rows = query_db(base_sql, tuple(params))

    for r in rows:
        for k in ("transaction_date", "created_at"):
            if k in r and hasattr(r[k], "isoformat"):
                r[k] = r[k].isoformat()

    return rows


# ── 1.3.3 DELETE transaction ──────────────────────────────────────────────────

@router.delete("/transactions/{tx_id}")
async def delete_transaction(tx_id: str, user_id: str):
    """Delete a transaction owned by the user."""
    try:
        conn = get_db()
        if not conn:
            raise HTTPException(status_code=503, detail="Database unavailable")
        cur = conn.cursor()
        cur.execute(
            "DELETE FROM transactions WHERE id::text = %s AND user_id = %s RETURNING id",
            (tx_id, user_id)
        )
        deleted = cur.fetchone()
        conn.commit()
        conn.close()
        if not deleted:
            raise HTTPException(status_code=404, detail="Transaction not found")
        return {"deleted": True, "id": tx_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── 1.3.3 SUMMARY ─────────────────────────────────────────────────────────────

@router.get("/summary")
async def get_summary(user_id: str, days: int = Query(30, ge=1)):
    """Revenue/cost/profit summary for Daftari muhtasari tab."""
    # FIX: f-string for INTERVAL
    sql = f"""
        SELECT
            COALESCE(SUM(CASE WHEN type='mapato'  THEN amount ELSE 0 END), 0) AS revenue,
            COALESCE(SUM(CASE WHEN type='gharama' THEN amount ELSE 0 END), 0) AS cost,
            COUNT(*) AS tx_count
        FROM transactions
        WHERE user_id = %s
          AND transaction_date >= CURRENT_DATE - INTERVAL '{days} days'
    """
    rows = query_db(sql, (user_id,))

    if rows:
        r       = rows[0]
        revenue = float(r.get("revenue", 0) or 0)
        cost    = float(r.get("cost",    0) or 0)
        profit  = revenue - cost
        margin  = round((profit / revenue) * 100, 1) if revenue else 0
        return {
            "total_revenue":      revenue,
            "total_cost":         cost,
            "net_profit":         profit,
            "profit_margin":      margin,
            "transactions_count": int(r.get("tx_count", 0) or 0),
            "days":               days,
        }

    return {
        "total_revenue": 0, "total_cost": 0, "net_profit": 0,
        "profit_margin": 0, "transactions_count": 0, "days": days,
    }


# ── 1.3.1 ASR — Whisper transcription ────────────────────────────────────────

@router.post("/transcribe")
async def transcribe_audio(
    user_id: str = Form(...),
    audio: UploadFile = File(...),
):
    """
    1.3.1 — Whisper ASR + GPT NLP extraction.
    Falls back to mock if OPENAI_API_KEY not set.
    """
    api_key = os.getenv("OPENAI_API_KEY", "")

    if not api_key:
        return {
            "transcript": "Niliuza samaki mia tatu, gharama ilikuwa mia moja",
            "nlp": {
                "transaction_type": "mapato",
                "amount":           300,
                "cost_amount":      100,
                "category":         "mauzo",
                "product_name":     "samaki",
                "quantity":         None,
                "transaction_date": datetime.now().date().isoformat(),
                "confidence":       0.91,
                "warnings":         [],
            },
            "demo": True,
        }

    try:
        import openai
        client      = openai.OpenAI(api_key=api_key)
        audio_bytes = await audio.read()
        audio_file  = io.BytesIO(audio_bytes)
        audio_file.name = audio.filename or "audio.webm"

        transcript = client.audio.transcriptions.create(
            model="whisper-1",
            file=audio_file,
            language="sw",
            response_format="text",
        ).strip()

        nlp_resp = client.chat.completions.create(
            model="gpt-4o-mini",
            response_format={"type": "json_object"},
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a Swahili business transaction parser. "
                        "Extract structured data from Swahili text. "
                        "Return ONLY JSON with: transaction_type (mapato|gharama), "
                        "amount (number), category (string), product_name (string or null), "
                        "quantity (number or null), transaction_date (YYYY-MM-DD), "
                        "confidence (0.0-1.0), warnings (array). "
                        "Today: " + datetime.now().date().isoformat()
                    ),
                },
                {"role": "user", "content": transcript},
            ],
        )
        nlp_data = json.loads(nlp_resp.choices[0].message.content)
        return {"transcript": transcript, "nlp": nlp_data}

    except Exception as e:
        print(f"[ASR Error] {e}")
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")


# ── 1.3.3 Offline sync ───────────────────────────────────────────────────────

@router.post("/sync")
async def sync_offline(user_id: str):
    return {"status": "ok", "message": "Sync endpoint ready"}


@router.get("/sync/status")
async def sync_status(user_id: str):
    count = scalar_db(
        "SELECT COUNT(*) FROM transactions WHERE user_id = %s AND is_synced = false",
        (user_id,), default=0
    )
    return {"is_synced": int(count) == 0, "pending_count": int(count)}


# ── 1.3.4 Business Health Card PDF ───────────────────────────────────────────

@router.get("/health-card")
async def generate_health_card(
    user_id: str,
    days: int = Query(90, ge=30),
):
    """1.3.4 — Generate Business Health Card PDF (reportlab)."""
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib import colors
        from reportlab.lib.units import cm
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

        # FIX: f-string for INTERVAL
        summary_rows = query_db(f"""
            SELECT
                COALESCE(SUM(CASE WHEN type='mapato'  THEN amount ELSE 0 END), 0) AS revenue,
                COALESCE(SUM(CASE WHEN type='gharama' THEN amount ELSE 0 END), 0) AS cost,
                COUNT(*) AS tx_count,
                MIN(transaction_date) AS first_date
            FROM transactions
            WHERE user_id = %s
              AND transaction_date >= CURRENT_DATE - INTERVAL '{days} days'
        """, (user_id,))

        user_rows = query_db(
            "SELECT name, business_name, business_type FROM users WHERE id = %s",
            (user_id,)
        )

        s       = summary_rows[0] if summary_rows else {}
        u       = user_rows[0]    if user_rows    else {}
        revenue = float(s.get("revenue", 0) or 0)
        cost    = float(s.get("cost",    0) or 0)
        profit  = revenue - cost
        margin  = round((profit / revenue) * 100, 1) if revenue else 0

        buffer = io.BytesIO()
        doc    = SimpleDocTemplate(buffer, pagesize=A4, topMargin=2*cm)
        styles = getSampleStyleSheet()
        story  = []

        green = colors.HexColor("#1a6b3a")

        title_style = ParagraphStyle(
            "Title", parent=styles["Title"],
            textColor=green, fontSize=20, spaceAfter=6,
        )
        story.append(Paragraph("Kadi ya Afya ya Biashara", title_style))
        story.append(Paragraph("Business Health Card — SwahiliSME Platform", styles["Normal"]))
        story.append(Spacer(1, 0.5*cm))

        biz_name = u.get("business_name") or "Biashara Yako"
        story.append(Paragraph(f"<b>Jina la Biashara:</b> {biz_name}", styles["Normal"]))
        story.append(Paragraph(f"<b>Mmiliki:</b> {u.get('name', user_id)}", styles["Normal"]))
        story.append(Paragraph(f"<b>Kipindi:</b> Siku {days} zilizopita", styles["Normal"]))
        story.append(Paragraph(f"<b>Tarehe:</b> {datetime.now().date()}", styles["Normal"]))
        story.append(Spacer(1, 0.5*cm))

        data = [
            ["Kiashiria",           "Kiasi (TZS)"],
            ["Mapato (Jumla)",       f"{revenue:,.0f}"],
            ["Gharama (Jumla)",      f"{cost:,.0f}"],
            ["Faida Halisi",         f"{profit:,.0f}"],
            ["Asilimia Faida",       f"{margin}%"],
            ["Idadi ya Miamala",     str(int(s.get("tx_count", 0) or 0))],
        ]
        tbl = Table(data, colWidths=[9*cm, 6*cm])
        tbl.setStyle(TableStyle([
            ("BACKGROUND",    (0, 0), (-1, 0),  green),
            ("TEXTCOLOR",     (0, 0), (-1, 0),  colors.white),
            ("FONTNAME",      (0, 0), (-1, 0),  "Helvetica-Bold"),
            ("FONTSIZE",      (0, 0), (-1, -1), 11),
            ("ROWBACKGROUNDS",(0, 1), (-1, -1), [colors.white, colors.HexColor("#f0f9f4")]),
            ("GRID",          (0, 0), (-1, -1), 0.5, colors.HexColor("#d1fae5")),
            ("LEFTPADDING",   (0, 0), (-1, -1), 10),
            ("TOPPADDING",    (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ]))
        story.append(tbl)
        story.append(Spacer(1, 1*cm))

        disclaimer = (
            "<i>Hii ni muhtasari wa data ya biashara yako kwa matumizi ya maombi ya mkopo. "
            "Haijakaguliwa na wakala wa serikali.</i>"
        )
        story.append(Paragraph(disclaimer, styles["Normal"]))
        story.append(Spacer(1, 0.4*cm))
        story.append(Paragraph(
            "<b>SwahiliSME Platform</b> • DASUC 2026 • Teknolojia kwa Lugha Yetu",
            styles["Normal"],
        ))

        doc.build(story)
        buffer.seek(0)

        filename = f"kadi-afya-{user_id}-{datetime.now().date()}.pdf"
        return StreamingResponse(
            buffer,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename={filename}"},
        )

    except ImportError:
        raise HTTPException(status_code=501, detail="reportlab not installed")
    except Exception as e:
        print(f"[PDF Error] {e}")
        raise HTTPException(status_code=500, detail=f"PDF generation failed: {str(e)}")


# ── Daftari top-products + spending ──────────────────────────────────────────

@router.get("/top-products")
async def get_top_products(user_id: str, days: int = 30):
    sql = f"""
        SELECT COALESCE(product_name, category, 'Nyingine') AS name,
               SUM(amount) AS revenue
        FROM transactions
        WHERE user_id = %s AND type = 'mapato'
          AND transaction_date >= CURRENT_DATE - INTERVAL '{days} days'
        GROUP BY name ORDER BY revenue DESC LIMIT 5
    """
    rows = query_db(sql, (user_id,))
    return [{"name": r["name"], "revenue": float(r["revenue"])} for r in rows]


@router.get("/spending")
async def get_spending(user_id: str, days: int = 30):
    sql = f"""
        SELECT COALESCE(category, 'Nyingine') AS category, SUM(amount) AS amount
        FROM transactions
        WHERE user_id = %s AND type = 'gharama'
          AND transaction_date >= CURRENT_DATE - INTERVAL '{days} days'
        GROUP BY category ORDER BY amount DESC
    """
    rows  = query_db(sql, (user_id,))
    total = sum(float(r["amount"]) for r in rows) or 1
    return [
        {
            "category": r["category"],
            "amount":   float(r["amount"]),
            "percent":  round(float(r["amount"]) / total * 100, 1),
        }
        for r in rows
    ]

"""
backend/services/pdf/health_card.py
1.3.4 – Business Health Card PDF Generator

Generates a professional, loan-application-ready PDF in Swahili.
Layout:
  Page 1: Cover – business name, logo placeholder, period, summary KPIs
  Page 2: Revenue/Cost/Profit table + Top Products + Spending breakdown
  Page 3: Legal disclaimer (Swahili) + signature block
"""
import io
import os
from datetime import datetime
from typing import Optional

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm, mm
from reportlab.platypus import (
    BaseDocTemplate, Frame, PageTemplate, Paragraph,
    Spacer, Table, TableStyle, HRFlowable, KeepTogether,
)
from reportlab.pdfgen import canvas as pdfgen_canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

# ── Brand colors ──────────────────────────────────────────────────────────────
GREEN_DARK  = colors.HexColor("#1A6B3A")
GREEN_MID   = colors.HexColor("#2E9E5B")
GREEN_LIGHT = colors.HexColor("#D4EDDA")
GOLD        = colors.HexColor("#C9A84C")
DARK_TEXT   = colors.HexColor("#1A1A2E")
GREY_TEXT   = colors.HexColor("#6B7280")
WHITE       = colors.white
PAGE_BG     = colors.HexColor("#F9FBF9")

W, H = A4  # 595.27 x 841.89 pts


# ── Number formatting ─────────────────────────────────────────────────────────
def _tzs(amount: float) -> str:
    return f"TZS {amount:,.0f}"


def _pct(value: float) -> str:
    return f"{value:.1f}%"


# ── Page decorators ───────────────────────────────────────────────────────────
def _draw_header(c: pdfgen_canvas.Canvas, doc, business_name: str, period: str):
    c.saveState()
    # Green top band
    c.setFillColor(GREEN_DARK)
    c.rect(0, H - 55, W, 55, fill=1, stroke=0)
    # Title
    c.setFillColor(WHITE)
    c.setFont("Helvetica-Bold", 16)
    c.drawString(20, H - 30, "KADI YA AFYA YA BIASHARA")
    c.setFont("Helvetica", 9)
    c.drawString(20, H - 46, "Business Health Card  •  SwahiliSME Platform")
    # Right: business name
    c.setFont("Helvetica-Bold", 10)
    c.drawRightString(W - 20, H - 30, business_name)
    c.setFont("Helvetica", 8)
    c.drawRightString(W - 20, H - 44, period)
    c.restoreState()


def _draw_footer(c: pdfgen_canvas.Canvas, doc):
    c.saveState()
    c.setFillColor(GREEN_DARK)
    c.rect(0, 0, W, 28, fill=1, stroke=0)
    c.setFillColor(WHITE)
    c.setFont("Helvetica", 7)
    c.drawString(20, 10, "SwahiliSME Platform  •  Hii si hati rasmi ya kisheria.")
    c.drawRightString(W - 20, 10, f"Ukurasa {doc.page}")
    c.restoreState()


# ── Main generator ────────────────────────────────────────────────────────────
def generate_health_card(
    business_name: str,
    owner_name: str,
    summary: dict,
    top_products: list[dict],
    spending_by_category: list[dict],
    transactions_count: int,
    days: int = 90,
    phone: Optional[str] = None,
) -> bytes:
    """
    Returns PDF bytes of the Business Health Card.

    Args:
        business_name:       e.g. "Duka la Mama Salma"
        owner_name:          e.g. "Salma Juma"
        summary:             dict from ledger_service.get_summary()
        top_products:        list from ledger_service.get_top_products()
        spending_by_category: list from ledger_service.get_spending_by_category()
        transactions_count:  total count for eligibility check
        days:                reporting period in days
        phone:               optional phone number
    """
    buffer = io.BytesIO()

    # ── Styles ──────────────────────────────────────────────────────────────
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "title", fontName="Helvetica-Bold", fontSize=20,
        textColor=GREEN_DARK, alignment=TA_CENTER, spaceAfter=4
    )
    subtitle_style = ParagraphStyle(
        "subtitle", fontName="Helvetica", fontSize=10,
        textColor=GREY_TEXT, alignment=TA_CENTER, spaceAfter=16
    )
    section_header = ParagraphStyle(
        "section_header", fontName="Helvetica-Bold", fontSize=12,
        textColor=GREEN_DARK, spaceAfter=6, spaceBefore=14,
        borderPad=4,
    )
    body = ParagraphStyle(
        "body_sw", fontName="Helvetica", fontSize=9,
        textColor=DARK_TEXT, leading=14,
    )
    small = ParagraphStyle(
        "small", fontName="Helvetica", fontSize=7.5,
        textColor=GREY_TEXT, leading=11,
    )
    disclaimer = ParagraphStyle(
        "disclaimer", fontName="Helvetica-Oblique", fontSize=8,
        textColor=GREY_TEXT, leading=12, borderColor=GOLD,
        borderWidth=1, borderPad=8, backColor=colors.HexColor("#FFFBF0"),
    )

    period_str = f"Kipindi: Siku {days} zilizopita  •  Hadi: {datetime.utcnow().strftime('%d %B %Y')}"

    # ── Page template ────────────────────────────────────────────────────────
    def make_page(c, doc):
        _draw_header(c, doc, business_name, period_str)
        _draw_footer(c, doc)

    frame = Frame(15 * mm, 15 * mm, W - 30 * mm, H - 80, id="main")
    doc = BaseDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=15 * mm,
        leftMargin=15 * mm,
        topMargin=65,
        bottomMargin=35,
    )
    doc.addPageTemplates([
        PageTemplate(id="main", frames=[frame], onPage=make_page)
    ])

    story = []

    # ──────────────────────────────────────────────────────────────────────────
    # PAGE 1 – Cover / KPI summary
    # ──────────────────────────────────────────────────────────────────────────
    story.append(Spacer(1, 10))
    story.append(Paragraph(business_name.upper(), title_style))
    story.append(Paragraph(f"Mmiliki: {owner_name}" + (f"  •  Simu: {phone}" if phone else ""), subtitle_style))
    story.append(HRFlowable(width="100%", thickness=2, color=GOLD, spaceAfter=16))

    # ── KPI boxes (2×2 table) ────────────────────────────────────────────────
    kpi_data = [
        [
            _kpi_cell("💰 MAPATO JUMLA", _tzs(summary["total_revenue"]), GREEN_DARK),
            _kpi_cell("💸 GHARAMA JUMLA", _tzs(summary["total_cost"]), colors.HexColor("#C0392B")),
        ],
        [
            _kpi_cell("📈 FAIDA HALISI", _tzs(summary["net_profit"]), GREEN_MID),
            _kpi_cell("📊 ASILIMIA YA FAIDA", _pct(summary["profit_margin"]), GOLD),
        ],
    ]
    kpi_table = Table(kpi_data, colWidths=[(W - 30 * mm) / 2 - 4] * 2, rowHeights=[70] * 2)
    kpi_table.setStyle(TableStyle([
        ("LEFTPADDING",  (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING",(0, 0), (-1, -1), 4),
        ("TOPPADDING",   (0, 0), (-1, -1), 4),
        ("ROWBACKGROUNDS", (0, 0), (-1, -1), [None]),
    ]))
    story.append(kpi_table)
    story.append(Spacer(1, 12))

    # Quick stats row
    stats = [
        ["Idadi ya Miamala", str(summary["transactions_count"])],
        ["Kipindi cha Uchambuzi", f"Siku {days}"],
        ["Hali ya Usawazishaji", "✅ Imesawazishwa" if transactions_count >= 30 else f"⏳ {transactions_count}/30 miamala"],
    ]
    stats_table = Table(stats, colWidths=[120, (W - 30 * mm - 120)])
    stats_table.setStyle(TableStyle([
        ("FONTNAME",     (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTNAME",     (1, 0), (1, -1), "Helvetica"),
        ("FONTSIZE",     (0, 0), (-1, -1), 9),
        ("TEXTCOLOR",    (0, 0), (0, -1), GREY_TEXT),
        ("TEXTCOLOR",    (1, 0), (1, -1), DARK_TEXT),
        ("BOTTOMPADDING",(0, 0), (-1, -1), 5),
        ("LINEBELOW",    (0, 0), (-1, -2), 0.5, colors.HexColor("#E5E7EB")),
    ]))
    story.append(stats_table)
    story.append(Spacer(1, 20))

    # Eligibility notice
    if transactions_count >= 30:
        notice = "✅ Biashara hii inastahili ombi la mkopo. Ripoti hii inaweza kutumika kama hati ya msaada."
        bg = GREEN_LIGHT
    else:
        notice = f"⚠️ Bado unahitaji miamala {30 - transactions_count} zaidi ili kustahili ombi la mkopo (unahitaji 30+)."
        bg = colors.HexColor("#FEF3C7")

    story.append(Paragraph(notice, ParagraphStyle(
        "notice", fontName="Helvetica-Bold", fontSize=9,
        textColor=DARK_TEXT, backColor=bg, borderPad=8, leading=14,
    )))

    # ──────────────────────────────────────────────────────────────────────────
    # PAGE 2 – Detailed tables
    # ──────────────────────────────────────────────────────────────────────────
    story.append(Spacer(1, 20))
    story.append(HRFlowable(width="100%", thickness=1, color=GREEN_LIGHT, spaceAfter=14))
    story.append(Paragraph("📊 MCHANGANUO WA MAPATO NA GHARAMA", section_header))

    # Monthly breakdown placeholder table
    revenue = summary["total_revenue"]
    cost = summary["total_cost"]
    profit = summary["net_profit"]

    breakdown_data = [
        ["Kipengele", "Kiasi (TZS)", "Asilimia"],
        ["Mapato (Jumla)", f"{revenue:,.0f}", "100%"],
        ["Gharama (Jumla)", f"{cost:,.0f}", _pct(cost / revenue * 100) if revenue else "0%"],
        ["Faida Halisi", f"{profit:,.0f}", _pct(summary["profit_margin"])],
    ]
    bd_table = Table(breakdown_data, colWidths=[200, 130, 100])
    bd_table.setStyle(_default_table_style())
    story.append(bd_table)
    story.append(Spacer(1, 16))

    # Top Products
    if top_products:
        story.append(Paragraph("🏆 BIDHAA BORA ZAIDI", section_header))
        prod_data = [["Bidhaa", "Mapato (TZS)", "Vitengo Vilivyouzwa"]]
        for p in top_products:
            prod_data.append([
                p.get("product", "—"),
                f"{p.get('revenue', 0):,.0f}",
                str(int(p.get("units", 0))),
            ])
        prod_table = Table(prod_data, colWidths=[200, 130, 100])
        prod_table.setStyle(_default_table_style())
        story.append(prod_table)
        story.append(Spacer(1, 16))

    # Spending by category
    if spending_by_category:
        story.append(Paragraph("💸 GHARAMA KWA AINA", section_header))
        total_spend = sum(s["total"] for s in spending_by_category)
        spend_data = [["Aina ya Gharama", "Kiasi (TZS)", "Asilimia"]]
        for s in spending_by_category:
            pct = s["total"] / total_spend * 100 if total_spend else 0
            spend_data.append([
                _category_label(s["category"]),
                f"{s['total']:,.0f}",
                _pct(pct),
            ])
        spend_table = Table(spend_data, colWidths=[200, 130, 100])
        spend_table.setStyle(_default_table_style())
        story.append(spend_table)

    # ──────────────────────────────────────────────────────────────────────────
    # PAGE 3 – Legal disclaimer
    # ──────────────────────────────────────────────────────────────────────────
    story.append(Spacer(1, 24))
    story.append(HRFlowable(width="100%", thickness=1, color=GOLD, spaceAfter=14))
    story.append(Paragraph("📋 TANGAZO LA KISHERIA / DISCLAIMER", section_header))

    disclaimer_text = (
        "<b>TANGAZO MUHIMU (Swahili):</b><br/>"
        "Ripoti hii ya 'Kadi ya Afya ya Biashara' imetolewa na mfumo wa SwahiliSME Platform kwa madhumuni "
        "ya habari na msaada wa biashara TU. Taarifa zilizomo katika ripoti hii zinatokana na data "
        "iliyoingizwa na mtumiaji na hazijathibitishwa na msajili wowote wa serikali au taasisi ya fedha.<br/><br/>"
        "Ripoti hii <b>SIKO</b> hati rasmi ya kisheria, taarifa ya akaunti iliyothibitishwa, wala ushahidi "
        "wa mapato kwa madhumuni ya kodi. Mwombaji wa mkopo anatakiwa kujua kwamba taasisi za fedha "
        "zitahitaji uthibitisho wa ziada wa taarifa zilizomo hapa.<br/><br/>"
        "SwahiliSME Platform na ZanAI hawachukui jukumu lolote kwa maamuzi ya mikopo au matumizi mengine "
        "ya ripoti hii. Kwa ushauri wa kisheria au wa fedha, tafadhali wasiliana na mshauri aliyehitimu."
        "<br/><br/>"
        "<b>IMPORTANT NOTICE (English):</b> This Business Health Card is generated by the SwahiliSME "
        "Platform for informational and business support purposes ONLY. The data herein is user-entered "
        "and unverified by any government registrar or financial institution. This document is NOT a "
        "legally certified financial statement. SwahiliSME Platform and ZanAI accept no liability for "
        "any lending decisions made based on this report."
    )
    story.append(Paragraph(disclaimer_text, disclaimer))
    story.append(Spacer(1, 24))

    # Signature block
    sig_data = [
        ["Saini ya Mmiliki:", "_______________________", "Tarehe:", datetime.utcnow().strftime("%d/%m/%Y")],
        [f"Jina: {owner_name}", "", "Muhuri wa Biashara:", ""],
    ]
    sig_table = Table(sig_data, colWidths=[100, 150, 90, 120])
    sig_table.setStyle(TableStyle([
        ("FONTNAME",  (0, 0), (-1, -1), "Helvetica"),
        ("FONTSIZE",  (0, 0), (-1, -1), 9),
        ("TEXTCOLOR", (0, 0), (-1, -1), DARK_TEXT),
        ("TOPPADDING",(0, 0), (-1, -1), 6),
    ]))
    story.append(sig_table)

    story.append(Spacer(1, 20))
    story.append(Paragraph(
        f"Ripoti hii ilitolewa tarehe {datetime.utcnow().strftime('%d %B %Y')} saa "
        f"{datetime.utcnow().strftime('%H:%M')} UTC na SwahiliSME Platform.",
        small
    ))

    # ── Build ────────────────────────────────────────────────────────────────
    doc.build(story)
    return buffer.getvalue()


# ── Helpers ───────────────────────────────────────────────────────────────────

def _kpi_cell(label: str, value: str, color) -> Table:
    """Returns a styled KPI box as a nested Table."""
    data = [[Paragraph(label, ParagraphStyle(
                "kl", fontName="Helvetica", fontSize=7.5,
                textColor=WHITE, alignment=TA_CENTER))],
            [Paragraph(value, ParagraphStyle(
                "kv", fontName="Helvetica-Bold", fontSize=14,
                textColor=WHITE, alignment=TA_CENTER))]]
    t = Table(data, colWidths=["100%"])
    t.setStyle(TableStyle([
        ("BACKGROUND",   (0, 0), (-1, -1), color),
        ("TOPPADDING",   (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING",(0, 0), (-1, -1), 10),
        ("LEFTPADDING",  (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("ROUNDEDCORNERS", (0, 0), (-1, -1), [4, 4, 4, 4]),
    ]))
    return t


def _default_table_style() -> TableStyle:
    return TableStyle([
        # Header row
        ("BACKGROUND",   (0, 0), (-1, 0), GREEN_DARK),
        ("TEXTCOLOR",    (0, 0), (-1, 0), WHITE),
        ("FONTNAME",     (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE",     (0, 0), (-1, 0), 9),
        # Data rows
        ("FONTNAME",     (0, 1), (-1, -1), "Helvetica"),
        ("FONTSIZE",     (0, 1), (-1, -1), 8.5),
        ("TEXTCOLOR",    (0, 1), (-1, -1), DARK_TEXT),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, GREEN_LIGHT]),
        # Alignment
        ("ALIGN",        (1, 0), (-1, -1), "RIGHT"),
        ("ALIGN",        (0, 0), (0, -1), "LEFT"),
        # Padding
        ("TOPPADDING",   (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING",(0, 0), (-1, -1), 6),
        ("LEFTPADDING",  (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        # Border
        ("GRID",         (0, 0), (-1, -1), 0.5, colors.HexColor("#D1FAE5")),
        ("BOX",          (0, 0), (-1, -1), 1, GREEN_MID),
    ])


_CATEGORY_LABELS = {
    "mauzo":             "Mauzo (Bidhaa)",
    "huduma":            "Huduma",
    "malighafi":         "Malighafi",
    "mishahara":         "Mishahara",
    "kodi":              "Kodi / Pango",
    "umeme":             "Umeme / Stima",
    "usafiri":           "Usafiri",
    "matangazo":         "Matangazo",
    "mkopo_uliolipwa":   "Mkopo Uliolipwa",
    "nyingine_gharama":  "Gharama Nyingine",
    "nyingine_mapato":   "Mapato Mengine",
}


def _category_label(cat) -> str:
    key = cat.value if hasattr(cat, "value") else str(cat)
    return _CATEGORY_LABELS.get(key, key.replace("_", " ").title())
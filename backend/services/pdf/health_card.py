"""
backend/services/pdf/health_card.py
1.3.4 – Business Health Card PDF Generator

Generates a professional, loan-application-ready PDF in Swahili.
Layout:
  Page 1: Cover – business name, period, summary KPIs
  Page 2: Revenue/Cost/Profit table + Bar chart + Top Products
  Page 3: Spending by category + Donut-style chart + Legal disclaimer
"""
import io
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

# ReportLab built-in graphics — no extra packages needed
from reportlab.graphics.shapes import (
    Drawing, Rect, String, Line, Circle, Wedge, Group,
)
from reportlab.graphics import renderPDF
from reportlab.graphics.charts.barcharts import HorizontalBarChart
from reportlab.graphics.charts.piecharts import Pie
from reportlab.graphics.charts.legends import Legend

# ── Brand colors ──────────────────────────────────────────────────────────────
GREEN_DARK  = colors.HexColor("#1A6B3A")
GREEN_MID   = colors.HexColor("#2E9E5B")
GREEN_LIGHT = colors.HexColor("#D4EDDA")
GOLD        = colors.HexColor("#C9A84C")
DARK_TEXT   = colors.HexColor("#1A1A2E")
GREY_TEXT   = colors.HexColor("#6B7280")
RED_COLOR   = colors.HexColor("#C0392B")
BLUE_COLOR  = colors.HexColor("#1A56DB")
WHITE       = colors.white
PAGE_BG     = colors.HexColor("#F9FBF9")

CHART_COLORS = [
    colors.HexColor("#1A6B3A"),
    colors.HexColor("#2E9E5B"),
    colors.HexColor("#C9A84C"),
    colors.HexColor("#C0392B"),
    colors.HexColor("#7e3af2"),
    colors.HexColor("#1A56DB"),
    colors.HexColor("#d97706"),
]

W, H = A4  # 595.27 x 841.89 pts


# ── Number formatting ─────────────────────────────────────────────────────────
def _tzs(amount: float) -> str:
    return f"TZS {amount:,.0f}"


def _pct(value: float) -> str:
    return f"{value:.1f}%"


# ── Page decorators ───────────────────────────────────────────────────────────
def _draw_header(c: pdfgen_canvas.Canvas, doc, business_name: str, period: str):
    c.saveState()
    c.setFillColor(GREEN_DARK)
    c.rect(0, H - 55, W, 55, fill=1, stroke=0)
    # Gold accent line
    c.setFillColor(GOLD)
    c.rect(0, H - 58, W, 3, fill=1, stroke=0)
    c.setFillColor(WHITE)
    c.setFont("Helvetica-Bold", 15)
    c.drawString(20, H - 28, "KADI YA AFYA YA BIASHARA")
    c.setFont("Helvetica", 8)
    c.drawString(20, H - 44, "Business Health Card  |  SwahiliSME Platform  |  DASUC 2026")
    c.setFont("Helvetica-Bold", 9)
    c.drawRightString(W - 20, H - 28, business_name[:40])
    c.setFont("Helvetica", 8)
    c.drawRightString(W - 20, H - 44, period)
    c.restoreState()


def _draw_footer(c: pdfgen_canvas.Canvas, doc):
    c.saveState()
    c.setFillColor(GREEN_DARK)
    c.rect(0, 0, W, 28, fill=1, stroke=0)
    c.setFillColor(GOLD)
    c.rect(0, 28, W, 2, fill=1, stroke=0)
    c.setFillColor(WHITE)
    c.setFont("Helvetica", 7)
    c.drawString(20, 10, "SwahiliSME Platform  |  Teknolojia kwa Lugha Yetu  |  Hii si hati rasmi ya kisheria.")
    c.drawRightString(W - 20, 10, f"Ukurasa {doc.page}")
    c.restoreState()


# ── Revenue vs Cost Bar Chart ─────────────────────────────────────────────────
def _revenue_cost_chart(revenue: float, cost: float, profit: float, width: float) -> Drawing:
    """Horizontal bar chart comparing Revenue, Cost, Profit."""
    chart_w = width
    chart_h = 120

    d = Drawing(chart_w, chart_h)

    max_val = max(revenue, cost, abs(profit), 1)
    bar_h   = 22
    gap     = 10
    label_w = 80
    bar_area = chart_w - label_w - 60

    data_rows = [
        ("Mapato",  revenue,  GREEN_DARK),
        ("Gharama", cost,     RED_COLOR),
        ("Faida",   profit,   BLUE_COLOR if profit >= 0 else RED_COLOR),
    ]

    for i, (label, value, color) in enumerate(data_rows):
        y        = chart_h - (i + 1) * (bar_h + gap) + gap
        bar_w    = max(2, abs(value) / max_val * bar_area)

        # Background track
        d.add(Rect(label_w, y, bar_area, bar_h,
                   fillColor=colors.HexColor("#F3F4F6"),
                   strokeColor=None))
        # Value bar
        d.add(Rect(label_w, y, bar_w, bar_h,
                   fillColor=color, strokeColor=None))
        # Label
        d.add(String(0, y + bar_h / 2 - 4, label,
                     fontName="Helvetica-Bold", fontSize=8,
                     fillColor=DARK_TEXT))
        # Value text
        d.add(String(label_w + bar_w + 4, y + bar_h / 2 - 4,
                     _tzs(value),
                     fontName="Helvetica", fontSize=7.5,
                     fillColor=GREY_TEXT))

    # Title
    d.add(String(0, chart_h - 8, "Muhtasari wa Fedha",
                 fontName="Helvetica-Bold", fontSize=9,
                 fillColor=GREEN_DARK))
    return d


# ── Spending Pie / Donut Chart ────────────────────────────────────────────────
def _spending_pie_chart(spending_by_category: list, width: float) -> Drawing:
    """Donut-style pie chart for spending breakdown."""
    if not spending_by_category:
        return None

    items = spending_by_category[:6]  # max 6 slices
    total = sum(s.get("amount", 0) for s in items) or 1

    chart_size = min(160, width * 0.45)
    d_width    = width
    d_height   = chart_size + 20

    d = Drawing(d_width, d_height)

    # Title
    d.add(String(0, d_height - 10, "Mchanganuo wa Gharama",
                 fontName="Helvetica-Bold", fontSize=9,
                 fillColor=GREEN_DARK))

    # Pie chart
    pie = Pie()
    pie.x         = 10
    pie.y         = 10
    pie.width     = chart_size
    pie.height    = chart_size
    pie.data      = [s.get("amount", 0) for s in items]
    pie.labels    = [f"{s.get('amount', 0) / total * 100:.0f}%" for s in items]
    pie.startAngle = 90
    pie.direction  = "clockwise"

    for i in range(len(items)):
        pie.slices[i].fillColor    = CHART_COLORS[i % len(CHART_COLORS)]
        pie.slices[i].strokeColor  = WHITE
        pie.slices[i].strokeWidth  = 1.5
        pie.slices[i].labelRadius  = 1.25
        pie.slices[i].fontSize     = 7

    d.add(pie)

    # Legend to the right of pie
    legend_x = chart_size + 20
    for i, item in enumerate(items):
        ly    = d_height - 30 - i * 18
        label = _category_label(item["category"])[:18]
        amt   = item.get("amount", 0)
        pct   = amt / total * 100

        # Color swatch
        d.add(Rect(legend_x, ly, 10, 10,
                   fillColor=CHART_COLORS[i % len(CHART_COLORS)],
                   strokeColor=None))
        # Label
        d.add(String(legend_x + 14, ly + 1,
                     f"{label}  {pct:.0f}%",
                     fontName="Helvetica", fontSize=7.5,
                     fillColor=DARK_TEXT))

    return d


# ── Top Products Bar Chart ────────────────────────────────────────────────────
def _top_products_chart(top_products: list, width: float) -> Drawing:
    """Horizontal bar chart for top products by revenue."""
    if not top_products:
        return None

    items   = top_products[:5]
    max_val = max((p.get("revenue", 0) for p in items), default=1) or 1

    bar_h    = 18
    gap      = 8
    label_w  = 110
    bar_area = width - label_w - 70
    chart_h  = len(items) * (bar_h + gap) + 30

    d = Drawing(width, chart_h)

    # Title
    d.add(String(0, chart_h - 10, "Bidhaa Bora Zaidi",
                 fontName="Helvetica-Bold", fontSize=9,
                 fillColor=GREEN_DARK))

    for i, item in enumerate(items):
        name    = str(item.get("name", item.get("product", "—")))[:20]
        revenue = item.get("revenue", 0)
        y       = chart_h - 25 - (i + 1) * (bar_h + gap) + gap
        bar_w   = max(2, revenue / max_val * bar_area)
        color   = CHART_COLORS[i % len(CHART_COLORS)]

        # Background
        d.add(Rect(label_w, y, bar_area, bar_h,
                   fillColor=colors.HexColor("#F3F4F6"),
                   strokeColor=None))
        # Bar
        d.add(Rect(label_w, y, bar_w, bar_h,
                   fillColor=color, strokeColor=None))
        # Product name
        d.add(String(0, y + bar_h / 2 - 4, name,
                     fontName="Helvetica", fontSize=7.5,
                     fillColor=DARK_TEXT))
        # Revenue amount
        d.add(String(label_w + bar_w + 4, y + bar_h / 2 - 4,
                     _tzs(revenue),
                     fontName="Helvetica", fontSize=7,
                     fillColor=GREY_TEXT))

    return d


# ── KPI Cell ──────────────────────────────────────────────────────────────────
def _kpi_cell(label: str, value: str, bg_color) -> Table:
    """Styled KPI box as a nested Table."""
    label_style = ParagraphStyle(
        "kl", fontName="Helvetica", fontSize=7.5,
        textColor=WHITE, alignment=TA_CENTER, leading=10,
    )
    value_style = ParagraphStyle(
        "kv", fontName="Helvetica-Bold", fontSize=13,
        textColor=WHITE, alignment=TA_CENTER, leading=16,
    )
    data = [
        [Paragraph(label, label_style)],
        [Paragraph(value, value_style)],
    ]
    t = Table(data, colWidths=["100%"])
    t.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, -1), bg_color),
        ("TOPPADDING",    (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("LEFTPADDING",   (0, 0), (-1, -1), 6),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 6),
    ]))
    return t


# ── Default table style ───────────────────────────────────────────────────────
def _default_table_style() -> TableStyle:
    return TableStyle([
        ("BACKGROUND",     (0, 0), (-1, 0),  GREEN_DARK),
        ("TEXTCOLOR",      (0, 0), (-1, 0),  WHITE),
        ("FONTNAME",       (0, 0), (-1, 0),  "Helvetica-Bold"),
        ("FONTSIZE",       (0, 0), (-1, 0),  9),
        ("FONTNAME",       (0, 1), (-1, -1), "Helvetica"),
        ("FONTSIZE",       (0, 1), (-1, -1), 8.5),
        ("TEXTCOLOR",      (0, 1), (-1, -1), DARK_TEXT),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, GREEN_LIGHT]),
        ("ALIGN",          (1, 0), (-1, -1), "RIGHT"),
        ("ALIGN",          (0, 0), (0,  -1), "LEFT"),
        ("TOPPADDING",     (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING",  (0, 0), (-1, -1), 6),
        ("LEFTPADDING",    (0, 0), (-1, -1), 8),
        ("RIGHTPADDING",   (0, 0), (-1, -1), 8),
        ("GRID",           (0, 0), (-1, -1), 0.5, colors.HexColor("#D1FAE5")),
        ("BOX",            (0, 0), (-1, -1), 1,   GREEN_MID),
    ])


# ── Category label map ────────────────────────────────────────────────────────
_CATEGORY_LABELS = {
    "mauzo":              "Mauzo (Bidhaa)",
    "huduma":             "Huduma",
    "malighafi":          "Malighafi",
    "mishahara":          "Mishahara",
    "kodi":               "Kodi / Pango",
    "umeme":              "Umeme / Stima",
    "usafiri":            "Usafiri",
    "matangazo":          "Matangazo",
    "mkopo_uliolipwa":    "Mkopo Uliolipwa",
    "mkopo_uliopokelewa": "Mkopo Uliopokelewa",
    "nyingine_gharama":   "Gharama Nyingine",
    "nyingine_mapato":    "Mapato Mengine",
}


def _category_label(cat) -> str:
    key = cat.value if hasattr(cat, "value") else str(cat)
    return _CATEGORY_LABELS.get(key, key.replace("_", " ").title())


# ── Main generator ────────────────────────────────────────────────────────────
def generate_health_card(
    business_name: str,
    owner_name: str,
    summary: dict,
    top_products: list,
    spending_by_category: list,
    transactions_count: int,
    days: int = 90,
    phone: Optional[str] = None,
) -> bytes:
    """
    Returns PDF bytes of the Business Health Card.

    Args:
        business_name:        e.g. "Duka la Mama Salma"
        owner_name:           e.g. "Salma Juma"
        summary:              dict from ledger_service.get_summary()
        top_products:         list from ledger_service.get_top_products()
        spending_by_category: list from ledger_service.get_spending_by_category()
        transactions_count:   total count for eligibility check
        days:                 reporting period in days
        phone:                optional phone number
    """
    buffer     = io.BytesIO()
    period_str = f"Kipindi: Siku {days}  |  Hadi: {datetime.utcnow().strftime('%d %B %Y')}"

    # ── Styles ────────────────────────────────────────────────────────────────
    title_style = ParagraphStyle(
        "title", fontName="Helvetica-Bold", fontSize=22,
        textColor=GREEN_DARK, alignment=TA_CENTER, spaceAfter=4,
    )
    subtitle_style = ParagraphStyle(
        "subtitle", fontName="Helvetica", fontSize=10,
        textColor=GREY_TEXT, alignment=TA_CENTER, spaceAfter=16,
    )
    section_header = ParagraphStyle(
        "section_header", fontName="Helvetica-Bold", fontSize=11,
        textColor=GREEN_DARK, spaceAfter=6, spaceBefore=12,
    )
    body_style = ParagraphStyle(
        "body_sw", fontName="Helvetica", fontSize=9,
        textColor=DARK_TEXT, leading=14,
    )
    small_style = ParagraphStyle(
        "small", fontName="Helvetica", fontSize=7.5,
        textColor=GREY_TEXT, leading=11,
    )
    notice_green = ParagraphStyle(
        "notice_green", fontName="Helvetica-Bold", fontSize=9,
        textColor=GREEN_DARK, backColor=GREEN_LIGHT,
        borderPad=8, leading=14,
    )
    notice_amber = ParagraphStyle(
        "notice_amber", fontName="Helvetica-Bold", fontSize=9,
        textColor=colors.HexColor("#92400e"),
        backColor=colors.HexColor("#FEF3C7"),
        borderPad=8, leading=14,
    )
    disclaimer_style = ParagraphStyle(
        "disclaimer", fontName="Helvetica-Oblique", fontSize=8,
        textColor=GREY_TEXT, leading=12,
        backColor=colors.HexColor("#FFFBF0"),
        borderColor=GOLD, borderWidth=1, borderPad=8,
    )

    # ── Page template ──────────────────────────────────────────────────────────
    def make_page(c, doc):
        _draw_header(c, doc, business_name, period_str)
        _draw_footer(c, doc)

    content_w = W - 30 * mm
    frame = Frame(15 * mm, 15 * mm, content_w, H - 80, id="main")
    doc   = BaseDocTemplate(
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

    # ── Extract summary values ─────────────────────────────────────────────────
    revenue = float(summary.get("total_revenue", 0) or 0)
    cost    = float(summary.get("total_cost",    0) or 0)
    profit  = float(summary.get("net_profit",    0) or 0)
    margin  = float(summary.get("profit_margin", 0) or 0)
    tx_count = int(summary.get("transactions_count", transactions_count) or 0)

    story = []

    # ═══════════════════════════════════════════════════════════════════════════
    # PAGE 1 — Cover + KPIs
    # ═══════════════════════════════════════════════════════════════════════════
    story.append(Spacer(1, 8))
    story.append(Paragraph(business_name.upper(), title_style))
    owner_line = f"Mmiliki: {owner_name}"
    if phone:
        owner_line += f"  |  Simu: {phone}"
    story.append(Paragraph(owner_line, subtitle_style))
    story.append(HRFlowable(width="100%", thickness=2, color=GOLD, spaceAfter=14))

    # ── 4 KPI boxes ──────────────────────────────────────────────────────────
    half_w = (content_w - 8) / 2
    kpi_data = [
        [
            _kpi_cell("MAPATO JUMLA", _tzs(revenue), GREEN_DARK),
            _kpi_cell("GHARAMA JUMLA", _tzs(cost), RED_COLOR),
        ],
        [
            _kpi_cell("FAIDA HALISI", _tzs(profit), GREEN_MID if profit >= 0 else RED_COLOR),
            _kpi_cell("ASILIMIA YA FAIDA", _pct(margin), GOLD),
        ],
    ]
    kpi_table = Table(kpi_data, colWidths=[half_w, half_w], rowHeights=[65, 65])
    kpi_table.setStyle(TableStyle([
        ("LEFTPADDING",   (0, 0), (-1, -1), 4),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 4),
        ("TOPPADDING",    (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(kpi_table)
    story.append(Spacer(1, 14))

    # ── Quick stats table ─────────────────────────────────────────────────────
    stats_data = [
        ["Idadi ya Miamala",      str(tx_count)],
        ["Kipindi cha Uchambuzi", f"Siku {days}"],
        ["Tarehe ya Ripoti",      datetime.utcnow().strftime("%d/%m/%Y")],
        ["Hali ya Usawazishaji",
         "Imesawazishwa" if tx_count >= 30 else f"{tx_count}/30 miamala"],
    ]
    stats_table = Table(stats_data, colWidths=[130, content_w - 130])
    stats_table.setStyle(TableStyle([
        ("FONTNAME",      (0, 0), (0,  -1), "Helvetica-Bold"),
        ("FONTNAME",      (1, 0), (1,  -1), "Helvetica"),
        ("FONTSIZE",      (0, 0), (-1, -1), 9),
        ("TEXTCOLOR",     (0, 0), (0,  -1), GREY_TEXT),
        ("TEXTCOLOR",     (1, 0), (1,  -1), DARK_TEXT),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LINEBELOW",     (0, 0), (-1, -2), 0.5, colors.HexColor("#E5E7EB")),
    ]))
    story.append(stats_table)
    story.append(Spacer(1, 14))

    # ── Eligibility notice ────────────────────────────────────────────────────
    if tx_count >= 30:
        notice_txt   = "Biashara hii inastahili ombi la mkopo. Ripoti hii inaweza kutumika kama hati ya msaada."
        notice_style = notice_green
    else:
        needed       = 30 - tx_count
        notice_txt   = f"Bado unahitaji miamala {needed} zaidi ili kustahili ombi la mkopo (unahitaji 30+)."
        notice_style = notice_amber
    story.append(Paragraph(notice_txt, notice_style))
    story.append(Spacer(1, 16))

    # ── Revenue vs Cost bar chart ─────────────────────────────────────────────
    story.append(HRFlowable(width="100%", thickness=1, color=GREEN_LIGHT, spaceAfter=10))
    story.append(Paragraph("MWELEKEO WA FEDHA", section_header))
    rc_chart = _revenue_cost_chart(revenue, cost, profit, content_w)
    story.append(rc_chart)
    story.append(Spacer(1, 8))

    # ═══════════════════════════════════════════════════════════════════════════
    # PAGE 2 — Detailed tables + Top Products chart
    # ═══════════════════════════════════════════════════════════════════════════
    story.append(HRFlowable(width="100%", thickness=1, color=GREEN_LIGHT, spaceAfter=10))
    story.append(Paragraph("MCHANGANUO WA MAPATO NA GHARAMA", section_header))

    breakdown_data = [
        ["Kipengele",      "Kiasi (TZS)",  "Asilimia"],
        ["Mapato Jumla",   f"{revenue:,.0f}", "100%"],
        ["Gharama Jumla",  f"{cost:,.0f}",
         _pct(cost / revenue * 100) if revenue else "0%"],
        ["Faida Halisi",   f"{profit:,.0f}", _pct(margin)],
    ]
    bd_table = Table(breakdown_data, colWidths=[200, 140, 90])
    bd_table.setStyle(_default_table_style())
    story.append(bd_table)
    story.append(Spacer(1, 14))

    # ── Top Products table ────────────────────────────────────────────────────
    if top_products:
        story.append(Paragraph("BIDHAA BORA ZAIDI", section_header))
        prod_data = [["Bidhaa", "Mapato (TZS)"]]
        for p in top_products[:5]:
            # ✅ Fixed: use "name" key (from ledger_service), fallback to "product"
            name = p.get("name", p.get("product", "—"))
            prod_data.append([
                name,
                f"{p.get('revenue', 0):,.0f}",
            ])
        prod_table = Table(prod_data, colWidths=[280, 150])
        prod_table.setStyle(_default_table_style())
        story.append(prod_table)
        story.append(Spacer(1, 10))

        # Top products bar chart
        tp_chart = _top_products_chart(top_products, content_w)
        if tp_chart:
            story.append(tp_chart)
            story.append(Spacer(1, 14))

    # ═══════════════════════════════════════════════════════════════════════════
    # PAGE 3 — Spending + Pie chart + Disclaimer
    # ═══════════════════════════════════════════════════════════════════════════
    if spending_by_category:
        story.append(HRFlowable(width="100%", thickness=1, color=GREEN_LIGHT, spaceAfter=10))
        story.append(Paragraph("GHARAMA KWA AINA", section_header))

        # ✅ Fixed: use "amount" key (from ledger_service), fallback to "total"
        total_spend = sum(
            s.get("amount", s.get("total", 0)) for s in spending_by_category
        ) or 1

        spend_data = [["Aina ya Gharama", "Kiasi (TZS)", "Asilimia"]]
        for s in spending_by_category:
            amt = s.get("amount", s.get("total", 0))
            pct = amt / total_spend * 100
            spend_data.append([
                _category_label(s.get("category", "—")),
                f"{amt:,.0f}",
                _pct(pct),
            ])
        spend_table = Table(spend_data, colWidths=[200, 130, 100])
        spend_table.setStyle(_default_table_style())
        story.append(spend_table)
        story.append(Spacer(1, 12))

        # Pie chart
        pie_chart = _spending_pie_chart(spending_by_category, content_w)
        if pie_chart:
            story.append(pie_chart)
            story.append(Spacer(1, 16))

    # ── Legal disclaimer ──────────────────────────────────────────────────────
    story.append(HRFlowable(width="100%", thickness=1.5, color=GOLD, spaceAfter=10))
    story.append(Paragraph("TANGAZO LA KISHERIA / DISCLAIMER", section_header))

    disclaimer_text = (
        "<b>TANGAZO MUHIMU (Kiswahili):</b><br/>"
        "Ripoti hii ya 'Kadi ya Afya ya Biashara' imetolewa na mfumo wa SwahiliSME Platform kwa madhumuni "
        "ya habari na msaada wa biashara TU. Taarifa zilizomo katika ripoti hii zinatokana na data "
        "iliyoingizwa na mtumiaji na hazijathibitishwa na msajili wowote wa serikali au taasisi ya fedha.<br/><br/>"
        "Ripoti hii <b>SI</b> hati rasmi ya kisheria, taarifa ya akaunti iliyothibitishwa, wala ushahidi "
        "wa mapato kwa madhumuni ya kodi. Mwombaji wa mkopo anatakiwa kujua kwamba taasisi za fedha "
        "zitahitaji uthibitisho wa ziada wa taarifa zilizomo hapa.<br/><br/>"
        "<b>IMPORTANT NOTICE (English):</b> This Business Health Card is generated by the SwahiliSME "
        "Platform for informational and business support purposes ONLY. The data herein is user-entered "
        "and unverified by any government registrar or financial institution. This document is NOT a "
        "legally certified financial statement. SwahiliSME Platform accepts no liability for any "
        "lending decisions made based on this report."
    )
    story.append(Paragraph(disclaimer_text, disclaimer_style))
    story.append(Spacer(1, 20))

    # ── Signature block ───────────────────────────────────────────────────────
    sig_data = [
        ["Saini ya Mmiliki:", "_______________________",
         "Tarehe:", datetime.utcnow().strftime("%d/%m/%Y")],
        [f"Jina: {owner_name}", "", "Muhuri wa Biashara:", ""],
    ]
    sig_table = Table(sig_data, colWidths=[110, 150, 100, 100])
    sig_table.setStyle(TableStyle([
        ("FONTNAME",      (0, 0), (-1, -1), "Helvetica"),
        ("FONTSIZE",      (0, 0), (-1, -1), 9),
        ("TEXTCOLOR",     (0, 0), (-1, -1), DARK_TEXT),
        ("TOPPADDING",    (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(sig_table)
    story.append(Spacer(1, 16))

    story.append(Paragraph(
        f"Ripoti hii ilitolewa tarehe {datetime.utcnow().strftime('%d %B %Y')} "
        f"saa {datetime.utcnow().strftime('%H:%M')} UTC na SwahiliSME Platform  |  DASUC 2026",
        small_style,
    ))

    # ── Build ──────────────────────────────────────────────────────────────────
    doc.build(story)
    return buffer.getvalue()

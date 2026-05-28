"""
export.py — Executive PDF Export Router
POST /api/export/brief
Accepts current signals data, returns a PDF executive operational briefing.

DISCLAIMER: All content in exported PDFs is for informational purposes only.
It does not constitute investment, trading, financial, or procurement advice.
"""
import io
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/export", tags=["Export"])


# ── Pydantic request model (mirrors frontend SignalsResponse) ─────────────────

class ExportRequest(BaseModel):
    # Core fields
    risk_score:          Optional[float] = None
    risk_level:          Optional[str]   = None
    risk_direction:      Optional[str]   = None
    signal_alignment:    Optional[str]   = None
    escalation_prob:     Optional[float] = None
    confidence:          Optional[float] = None
    location:            Optional[str]   = None

    # Demand / Supply / Market conditions
    demand_condition:    Optional[str]   = None
    supply_condition:    Optional[str]   = None
    market_condition:    Optional[str]   = None

    # AI reasoning
    ai_summary:          Optional[str]   = None
    operational_outlook: Optional[str]   = None

    # Phase 10 — predictive intelligence
    weather_persistence: Optional[Dict[str, Any]] = None
    early_warnings:      Optional[Dict[str, Any]] = None
    risk_trend:          Optional[Dict[str, Any]] = None
    interval_intelligence: Optional[Dict[str, Any]] = None

    # Phase 12 — enterprise operational
    operational_exposure:  Optional[Dict[str, Any]] = None
    market_transition:     Optional[Dict[str, Any]] = None
    scenarios:             Optional[List[Dict[str, Any]]] = None

    # Cost/impact
    cost_impact:  Optional[Dict[str, Any]] = None
    what_changed: Optional[List[str]]      = None


# ── Colour palette (used for PDF drawing) ────────────────────────────────────

def _risk_colour(level: Optional[str]):
    """Map risk level → (R, G, B) tuple 0-1 for reportlab."""
    mapping = {
        "critical":  (0.85, 0.15, 0.15),
        "high":      (0.90, 0.40, 0.05),
        "elevated":  (0.90, 0.65, 0.05),
        "moderate":  (0.20, 0.55, 0.90),
        "low":       (0.15, 0.75, 0.40),
    }
    return mapping.get((level or "").lower(), (0.50, 0.50, 0.50))


def _level_label(level: Optional[str]) -> str:
    return (level or "Unknown").upper()


# ── PDF builder ───────────────────────────────────────────────────────────────

def _build_pdf(data: ExportRequest) -> bytes:
    from reportlab.lib.pagesizes import letter
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import inch
    from reportlab.lib import colors
    from reportlab.platypus import (
        SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
        HRFlowable, KeepTogether
    )
    from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT

    buffer = io.BytesIO()

    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        leftMargin=0.75 * inch,
        rightMargin=0.75 * inch,
        topMargin=0.75 * inch,
        bottomMargin=0.75 * inch,
    )

    W, H = letter
    content_width = W - 1.5 * inch

    styles = getSampleStyleSheet()

    # Custom styles
    def make_style(name, **kw):
        base = kw.pop("parent", "Normal")
        s = ParagraphStyle(name, parent=styles[base], **kw)
        styles.add(s)
        return s

    # Dark header background colour
    DARK_BG   = colors.HexColor("#0a0f1a")
    ACCENT    = colors.HexColor("#1a6bb5")
    MID_GREY  = colors.HexColor("#334155")
    LIGHT_TXT = colors.HexColor("#e2e8f0")
    MUTED_TXT = colors.HexColor("#94a3b8")
    BODY_TXT  = colors.HexColor("#1e293b")
    RULE_CLR  = colors.HexColor("#e2e8f0")

    risk_r, risk_g, risk_b = _risk_colour(data.risk_level)
    RISK_CLR = colors.Color(risk_r, risk_g, risk_b)

    sTitle = make_style("sTitle",
        parent="Normal", fontSize=22, leading=28,
        textColor=LIGHT_TXT, fontName="Helvetica-Bold")

    sSubtitle = make_style("sSubtitle",
        parent="Normal", fontSize=10, leading=14,
        textColor=MUTED_TXT, fontName="Helvetica")

    sSection = make_style("sSection",
        parent="Normal", fontSize=11, leading=15,
        textColor=ACCENT, fontName="Helvetica-Bold",
        spaceBefore=12, spaceAfter=4)

    sBody = make_style("sBody",
        parent="Normal", fontSize=9, leading=13,
        textColor=BODY_TXT, fontName="Helvetica")

    sBodyMuted = make_style("sBodyMuted",
        parent="Normal", fontSize=8.5, leading=12.5,
        textColor=colors.HexColor("#475569"), fontName="Helvetica")

    sLabel = make_style("sLabel",
        parent="Normal", fontSize=7.5, leading=11,
        textColor=MUTED_TXT, fontName="Helvetica-Bold",
        spaceAfter=1)

    sValue = make_style("sValue",
        parent="Normal", fontSize=9.5, leading=13,
        textColor=BODY_TXT, fontName="Helvetica-Bold")

    sDisclaimer = make_style("sDisclaimer",
        parent="Normal", fontSize=7, leading=10,
        textColor=colors.HexColor("#94a3b8"), fontName="Helvetica",
        spaceBefore=6)

    sWarning = make_style("sWarning",
        parent="Normal", fontSize=8.5, leading=12.5,
        textColor=colors.HexColor("#b45309"), fontName="Helvetica")

    story = []

    # ── HEADER BLOCK ──────────────────────────────────────────────────────────

    now_utc = datetime.now(timezone.utc)
    ts_str  = now_utc.strftime("%B %d, %Y  %H:%M UTC")
    loc_str = data.location or "Texas / ERCOT"

    header_data = [[
        Paragraph("TEXAS ENERGY RISK", sTitle),
        Paragraph(f"Executive Operational Brief<br/><font size='8'>{ts_str} · {loc_str}</font>", sSubtitle),
    ]]
    header_table = Table(header_data, colWidths=[content_width * 0.55, content_width * 0.45])
    header_table.setStyle(TableStyle([
        ("BACKGROUND",  (0, 0), (-1, -1), DARK_BG),
        ("LEFTPADDING",  (0, 0), (-1, -1), 14),
        ("RIGHTPADDING", (0, 0), (-1, -1), 14),
        ("TOPPADDING",   (0, 0), (-1, -1), 14),
        ("BOTTOMPADDING",(0, 0), (-1, -1), 14),
        ("VALIGN",       (0, 0), (-1, -1), "MIDDLE"),
        ("ROUNDEDCORNERS", (0, 0), (-1, -1), [4, 4, 4, 4]),
    ]))
    story.append(header_table)
    story.append(Spacer(1, 10))

    # ── RISK STATUS BANNER ────────────────────────────────────────────────────

    risk_level   = _level_label(data.risk_level)
    risk_score   = f"{data.risk_score:.1f}/10" if data.risk_score is not None else "—"
    esc_prob     = f"{data.escalation_prob:.0f}%" if data.escalation_prob is not None else "—"
    confidence   = f"{data.confidence:.0f}%" if data.confidence is not None else "—"
    direction    = (data.risk_direction or "stable").capitalize()
    alignment    = (data.signal_alignment or "neutral").capitalize()

    banner_items = [
        ("RISK LEVEL", risk_level),
        ("RISK SCORE", risk_score),
        ("DIRECTION", direction),
        ("ESCALATION PROB.", esc_prob),
        ("SIGNAL CONF.", confidence),
        ("ALIGNMENT", alignment),
    ]

    def _kv_cell(label, value):
        return [Paragraph(label, sLabel), Paragraph(value, sValue)]

    banner_rows = [[_kv_cell(lbl, val) for lbl, val in banner_items]]
    col_w = content_width / len(banner_items)
    banner_table = Table(banner_rows, colWidths=[col_w] * len(banner_items))
    banner_table.setStyle(TableStyle([
        ("BACKGROUND",   (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
        ("BOX",          (0, 0), (-1, -1), 0.8, RULE_CLR),
        ("LINEBEFORE",   (1, 0), (-1, -1), 0.5, RULE_CLR),
        ("LEFTPADDING",  (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING",   (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING",(0, 0), (-1, -1), 6),
        ("VALIGN",       (0, 0), (-1, -1), "TOP"),
        # Risk level cell gets accent border on left
        ("LINEAFTER",    (0, 0), (0, -1), 2.5, RISK_CLR),
    ]))
    story.append(banner_table)
    story.append(Spacer(1, 8))

    def _section_rule(label):
        story.append(Spacer(1, 4))
        story.append(Paragraph(label, sSection))
        story.append(HRFlowable(width="100%", thickness=0.5, color=RULE_CLR, spaceAfter=4))

    # ── CURRENT CONDITIONS ────────────────────────────────────────────────────

    _section_rule("CURRENT CONDITIONS")

    cond_data = [
        [Paragraph("DEMAND", sLabel), Paragraph("SUPPLY", sLabel), Paragraph("MARKET", sLabel)],
        [
            Paragraph((data.demand_condition or "—").capitalize(), sValue),
            Paragraph((data.supply_condition or "—").capitalize(), sValue),
            Paragraph((data.market_condition or "—").capitalize(), sValue),
        ]
    ]
    cond_table = Table(cond_data, colWidths=[content_width / 3] * 3)
    cond_table.setStyle(TableStyle([
        ("BACKGROUND",   (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
        ("BOX",          (0, 0), (-1, -1), 0.8, RULE_CLR),
        ("LINEBEFORE",   (1, 0), (-1, -1), 0.5, RULE_CLR),
        ("LEFTPADDING",  (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING",   (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING",(0, 0), (-1, -1), 6),
        ("VALIGN",       (0, 0), (-1, -1), "TOP"),
    ]))
    story.append(cond_table)

    # ── WHAT CHANGED ─────────────────────────────────────────────────────────

    if data.what_changed:
        story.append(Spacer(1, 6))
        for item in data.what_changed[:5]:
            story.append(Paragraph(f"• {item}", sBody))

    # ── AI INTERPRETATION ─────────────────────────────────────────────────────

    if data.ai_summary or data.operational_outlook:
        _section_rule("AI INTERPRETATION")
        if data.ai_summary:
            story.append(Paragraph(data.ai_summary, sBody))
        if data.operational_outlook:
            story.append(Spacer(1, 4))
            story.append(Paragraph(
                f"<b>Operational Outlook:</b> {data.operational_outlook}", sBody))

    # ── EARLY WARNING / ESCALATION WATCH ─────────────────────────────────────

    ew = data.early_warnings or {}
    warnings = ew.get("warnings") or []
    if warnings:
        _section_rule("ESCALATION WATCH")
        severity = (ew.get("highest_severity") or "watch").upper()
        story.append(Paragraph(
            f"Highest Severity: <b>{severity}</b>  ·  {len(warnings)} condition(s) flagged",
            sBody))
        story.append(Spacer(1, 4))
        for w in warnings[:5]:
            story.append(Paragraph(f"▸  {w}", sWarning))

    # ── OPERATIONAL EXPOSURE ──────────────────────────────────────────────────

    oe = data.operational_exposure
    if oe:
        _section_rule("OPERATIONAL EXPOSURE")
        score     = oe.get("score", 0)
        level     = (oe.get("level") or "—").upper()
        short_d   = oe.get("short_desc") or ""
        detail    = oe.get("detail") or ""
        drivers   = oe.get("drivers") or []

        exp_data = [
            [Paragraph("EXPOSURE LEVEL", sLabel), Paragraph("SCORE", sLabel), Paragraph("SUMMARY", sLabel)],
            [
                Paragraph(level, sValue),
                Paragraph(f"{score:.1f}/10", sValue),
                Paragraph(short_d, sBody),
            ]
        ]
        exp_table = Table(exp_data, colWidths=[content_width * 0.22, content_width * 0.15, content_width * 0.63])
        exp_table.setStyle(TableStyle([
            ("BACKGROUND",   (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
            ("BOX",          (0, 0), (-1, -1), 0.8, RULE_CLR),
            ("LINEBEFORE",   (1, 0), (-1, -1), 0.5, RULE_CLR),
            ("LEFTPADDING",  (0, 0), (-1, -1), 8),
            ("RIGHTPADDING", (0, 0), (-1, -1), 8),
            ("TOPPADDING",   (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING",(0, 0), (-1, -1), 6),
            ("VALIGN",       (0, 0), (-1, -1), "TOP"),
        ]))
        story.append(exp_table)

        if detail:
            story.append(Spacer(1, 4))
            story.append(Paragraph(detail, sBodyMuted))
        if drivers:
            story.append(Spacer(1, 3))
            story.append(Paragraph(
                "Key drivers: " + " · ".join(drivers), sBodyMuted))

    # ── 24–48H OUTLOOK ────────────────────────────────────────────────────────

    ii = data.interval_intelligence
    if ii:
        _section_rule("24–48H OUTLOOK")
        intervals = [
            ("SHORT TERM (0–6h)",   ii.get("short_term")  or {}),
            ("NEAR TERM (6–24h)",   ii.get("near_term")   or {}),
            ("OUTLOOK (24–48h)",    ii.get("outlook")     or {}),
        ]
        for lbl, interval in intervals:
            if not interval:
                continue
            outlook_text = interval.get("outlook") or ""
            conf         = interval.get("confidence", 0)
            esc_pct      = interval.get("escalation_pct", 0)
            focus        = interval.get("monitoring_focus") or ""
            if not outlook_text:
                continue

            story.append(KeepTogether([
                Paragraph(lbl, sLabel),
                Paragraph(outlook_text, sBody),
                Paragraph(
                    f"Confidence: {conf:.0f}%  ·  Escalation probability: {esc_pct:.0f}%"
                    + (f"  ·  Monitor: {focus}" if focus else ""),
                    sBodyMuted),
                Spacer(1, 4),
            ]))

    # ── RISK TREND ────────────────────────────────────────────────────────────

    rt = data.risk_trend
    if rt and (rt.get("trajectory") or "stable") != "stable":
        _section_rule("RISK TREND")
        traj  = (rt.get("trajectory") or "stable").capitalize()
        label = rt.get("label") or traj
        desc  = rt.get("description") or ""
        story.append(Paragraph(f"<b>{label}</b>" + (f" — {desc}" if desc else ""), sBody))

    # ── SCENARIO MODELING ─────────────────────────────────────────────────────

    scenarios = data.scenarios or []
    if scenarios:
        _section_rule("SCENARIO MODELING")
        story.append(Paragraph(
            "Conditional scenarios — probabilistic only. Not a market forecast.",
            sBodyMuted))
        story.append(Spacer(1, 4))

        for sc in scenarios[:4]:
            trigger = sc.get("trigger") or ""
            outcome = sc.get("outcome") or ""
            prob    = (sc.get("probability") or "low").upper()
            if not trigger:
                continue
            story.append(KeepTogether([
                Paragraph(f"<b>{trigger}</b>  <font color='grey'>[{prob}]</font>", sBody),
                Paragraph(outcome, sBodyMuted),
                Spacer(1, 5),
            ]))

    # ── WEATHER PERSISTENCE ───────────────────────────────────────────────────

    wp = data.weather_persistence
    if wp and (wp.get("persistence_risk") or "low") not in ("low",):
        _section_rule("WEATHER PERSISTENCE")
        p_risk = (wp.get("persistence_risk") or "low").upper()
        chd    = wp.get("consecutive_high_days", 0)
        desc   = wp.get("description") or ""
        story.append(Paragraph(
            f"Persistence Risk: <b>{p_risk}</b>  ·  Consecutive high-temperature days: {chd}",
            sBody))
        if desc:
            story.append(Spacer(1, 3))
            story.append(Paragraph(desc, sBodyMuted))

    # ── MARKET TRANSITION ─────────────────────────────────────────────────────

    mt = data.market_transition
    if mt:
        _section_rule("MARKET TRANSITION")
        label   = mt.get("label") or ""
        urgency = (mt.get("urgency") or "low").upper()
        desc    = mt.get("description") or ""
        action  = mt.get("action") or ""
        if label:
            story.append(Paragraph(
                f"<b>{label}</b>  ·  Urgency: {urgency}", sBody))
        if desc:
            story.append(Spacer(1, 3))
            story.append(Paragraph(desc, sBodyMuted))
        if action:
            story.append(Spacer(1, 3))
            story.append(Paragraph(f"<b>Recommended action:</b> {action}", sBody))

    # ── DISCLAIMER ────────────────────────────────────────────────────────────

    story.append(Spacer(1, 14))
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#cbd5e1")))
    story.append(Paragraph(
        "DISCLAIMER: All content in this document is for informational purposes only. "
        "It does not constitute investment, trading, financial, procurement, or operational advice. "
        "Risk assessments are probabilistic and may not reflect actual market conditions. "
        "Consult qualified professionals before making decisions. "
        f"Generated {ts_str} by Texas Energy Risk Platform.",
        sDisclaimer,
    ))

    doc.build(story)
    return buffer.getvalue()


# ── Endpoint ──────────────────────────────────────────────────────────────────

@router.post("/brief")
async def export_brief(data: ExportRequest):
    """
    Generate and return an Executive Operational Brief as a PDF.
    Accepts current signals data; returns application/pdf.
    """
    try:
        pdf_bytes = _build_pdf(data)
    except Exception as exc:
        logger.error("[EXPORT] PDF generation failed: %s", exc, exc_info=True)
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail="PDF generation failed")

    now_str  = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M")
    filename = f"tx-energy-brief-{now_str}.pdf"

    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Content-Length": str(len(pdf_bytes)),
        },
    )

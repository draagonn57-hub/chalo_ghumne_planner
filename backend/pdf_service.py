"""
PDF generation service for Chalo Ghumne -- professional redesign.

Provides:
  build_confirmation_pdf(booking, user, images=None) -> bytes
  build_itinerary_pdf(booking_or_itinerary, images=None) -> bytes

Design system:
  - Shared page template (header + footer) on every page
  - DejaVuSans Regular + Bold (bundled TTF) -- supports Rs, ->, -, e-with-accent
  - Palette: Teal #0D5C75 * Coral #E76F51 * Cream #FDFBF7 * Slate text
  - Logo: backend/assets/images/logo-full.png
  - Photo watermark drawn BEHIND flowables via onPage callback
  - Platypus flowables: Paragraph (wrapped), Table (zebra), KeepTogether

Requirements:
  reportlab >= 4.0, Pillow
"""

from __future__ import annotations

import io
import logging
import os
from io import BytesIO
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Asset paths
# ---------------------------------------------------------------------------

_BASE      = Path(__file__).parent
FONTS_DIR  = _BASE / "assets" / "fonts"
IMAGES_DIR = _BASE / "assets" / "images"
LOGO_PATH  = IMAGES_DIR / "logo-full.png"

FONT_REGULAR = str(FONTS_DIR / "DejaVuSans.ttf")
FONT_BOLD    = str(FONTS_DIR / "DejaVuSans-Bold.ttf")

_FONTS_REGISTERED = False


def _ensure_fonts() -> bool:
    global _FONTS_REGISTERED
    if _FONTS_REGISTERED:
        return True
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    try:
        pdfmetrics.registerFont(TTFont("DejaVu",      FONT_REGULAR))
        pdfmetrics.registerFont(TTFont("DejaVu-Bold", FONT_BOLD))
        pdfmetrics.registerFontFamily(
            "DejaVu",
            normal="DejaVu",
            bold="DejaVu-Bold",
            italic="DejaVu",
            boldItalic="DejaVu-Bold",
        )
        _FONTS_REGISTERED = True
        return True
    except Exception as exc:
        logger.warning("Could not register DejaVuSans: %s", exc)
        return False


# ---------------------------------------------------------------------------
# Palette
# ---------------------------------------------------------------------------

from reportlab.lib import colors as _rl_colors

TEAL_HEX  = "#0D5C75"
CORAL_HEX = "#E76F51"
CREAM_HEX = "#FDFBF7"
SLATE_HEX = "#1A2530"
MUTED_HEX = "#64748B"
GREEN_HEX = "#16A34A"

TEAL_C       = _rl_colors.HexColor(TEAL_HEX)
CORAL_C      = _rl_colors.HexColor(CORAL_HEX)
CREAM_C      = _rl_colors.HexColor(CREAM_HEX)
SLATE_C      = _rl_colors.HexColor(SLATE_HEX)
MUTED_C      = _rl_colors.HexColor(MUTED_HEX)
GREEN_C      = _rl_colors.HexColor(GREEN_HEX)
WHITE_C      = _rl_colors.white
LT_TEAL_C    = _rl_colors.HexColor("#E8F4F7")
ZEBRA_C      = _rl_colors.HexColor("#F1F8FA")

# ---------------------------------------------------------------------------
# Page geometry
# ---------------------------------------------------------------------------

PAGE_W    = 595.27
PAGE_H    = 841.89
MARGIN    = 48
CONTENT_W = PAGE_W - 2 * MARGIN

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _support_email() -> str:
    return os.environ.get("SUPPORT_EMAIL", "chaloghumne.trips@gmail.com")


def _safe(value: Any, fallback: str = "\u2014") -> str:
    """HTML-escape value for use in Paragraph XML."""
    if value is None:
        return fallback
    s = str(value).strip()
    if not s:
        return fallback
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def _safe_plain(value: Any, fallback: str = "\u2014") -> str:
    """Plain string (no HTML escaping) for canvas drawString."""
    if value is None:
        return fallback
    s = str(value).strip()
    return s if s else fallback


def _title_case(s: str) -> str:
    if not s:
        return s
    return " ".join(w.capitalize() for w in s.strip().split())


def _format_inr(val: Any) -> str:
    if val is None or val == "":
        return "\u2014"
    if isinstance(val, (int, float)):
        return f"\u20b9{int(val):,}"
    s = str(val).strip()
    if s.isdigit():
        return f"\u20b9{int(s):,}"
    if not s.startswith("\u20b9") and not s.startswith("Rs") and not s.startswith("INR"):
        try:
            num = float(s.replace(",", ""))
            return f"\u20b9{int(num):,}"
        except ValueError:
            pass
    return s



def _font_name(bold: bool = False) -> str:
    reg = _ensure_fonts()
    if reg:
        return "DejaVu-Bold" if bold else "DejaVu"
    return "Helvetica-Bold" if bold else "Helvetica"


# ---------------------------------------------------------------------------
# Paragraph style factory
# ---------------------------------------------------------------------------

def _ps(
    name: str,
    font_size: int = 9,
    bold: bool = False,
    color=None,
    leading: Optional[float] = None,
    space_before: float = 0,
    space_after: float = 4,
    alignment: int = 0,
    left_indent: float = 0,
    back_color=None,
):
    from reportlab.lib.styles import ParagraphStyle
    fn = _font_name(bold)
    if color is None:
        color = SLATE_C
    return ParagraphStyle(
        name,
        fontName=fn,
        fontSize=font_size,
        textColor=color,
        leading=leading or (font_size * 1.38),
        spaceBefore=space_before,
        spaceAfter=space_after,
        alignment=alignment,
        leftIndent=left_indent,
        backColor=back_color,
        wordWrap="CJK",
    )


# ---------------------------------------------------------------------------
# Flowable helpers
# ---------------------------------------------------------------------------

def _para(text: str, **kw):
    from reportlab.platypus import Paragraph
    return Paragraph(text, _ps("_p", **kw))


def _spacer(h: float = 8):
    from reportlab.platypus import Spacer
    return Spacer(1, h)


def _section_heading(text: str):
    from reportlab.platypus import Paragraph, HRFlowable, KeepTogether
    p = Paragraph(
        "<b>" + _safe(text) + "</b>",
        _ps("_sh", font_size=11, bold=True, color=TEAL_C,
            space_before=10, space_after=2),
    )
    rule = HRFlowable(
        width=CONTENT_W, thickness=1.5, color=CORAL_C, spaceAfter=4,
    )
    return KeepTogether([_spacer(4), p, rule])


def _kv(label: str, value: str, bold_val: bool = False, val_color=None):
    from reportlab.platypus import Table, TableStyle, Paragraph
    vc = val_color or SLATE_C
    lp = Paragraph(_safe(label), _ps("_kl", font_size=8, color=MUTED_C))
    vp = Paragraph(_safe(value), _ps("_kv", font_size=9, bold=bold_val, color=vc))
    t = Table([[lp, vp]], colWidths=[140, CONTENT_W - 140])
    t.setStyle(TableStyle([
        ("VALIGN",        (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING",   (0, 0), (-1, -1), 0),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 0),
        ("TOPPADDING",    (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
    ]))
    return t


def _ztable(header_row: List[str], data_rows: List[List[str]],
            col_widths: Optional[List[float]] = None):
    """Teal header + zebra rows + word-wrap."""
    from reportlab.platypus import Table, TableStyle, Paragraph
    if not data_rows:
        return None
    nc = len(header_row)
    if col_widths is None:
        col_widths = [CONTENT_W / nc] * nc
    hcells = [
        Paragraph("<b>" + _safe(h) + "</b>",
                  _ps("_th", font_size=8, bold=True, color=WHITE_C, alignment=1))
        for h in header_row
    ]
    body = [
        [Paragraph(_safe(str(c)), _ps("_td", font_size=8)) for c in row]
        for row in data_rows
    ]
    rows = [hcells] + body
    t = Table(rows, colWidths=col_widths, repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, 0),  TEAL_C),
        ("TEXTCOLOR",     (0, 0), (-1, 0),  WHITE_C),
        ("ROWBACKGROUND", (0, 1), (-1, -1), [WHITE_C, ZEBRA_C]),
        ("LINEBELOW",     (0, 0), (-1, 0),  0.5, CORAL_C),
        ("LINEBELOW",     (0, 1), (-1, -1), 0.3, MUTED_C),
        ("BOX",           (0, 0), (-1, -1), 0.5, MUTED_C),
        ("TOPPADDING",    (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING",   (0, 0), (-1, -1), 6),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 6),
        ("VALIGN",        (0, 0), (-1, -1), "TOP"),
    ]))
    return t


def _closing_block(destination: str, kind: str = "confirmation"):
    from reportlab.platypus import KeepTogether, Table, TableStyle, Paragraph
    support = _safe(_support_email())
    if kind == "itinerary":
        msg = (
            "Thank you for planning your trip with <b>Chalo Ghumne</b>! "
            "We hope you have a wonderful time in <b>" + _safe(destination) + "</b>. "
            "Happy travels!"
        )
    else:
        msg = (
            "Thank you for booking with <b>Chalo Ghumne</b>! "
            "Your trip to <b>" + _safe(destination) + "</b> is confirmed. "
            "We wish you a safe and joyful journey. Happy travels!"
        )
    help_txt = (
        'Need help? <a href="mailto:' + support + '" color="' + TEAL_HEX + '">'
        + support + "</a>"
    )
    inner = [
        _spacer(6),
        Paragraph("\U0001f334 " + msg,
                  _ps("_cm", font_size=10, space_before=0, space_after=6)),
        Paragraph(help_txt, _ps("_ch", font_size=8, color=MUTED_C)),
        _spacer(4),
    ]
    t = Table([inner], colWidths=[CONTENT_W])
    t.setStyle(TableStyle([
        ("BACKGROUND",   (0, 0), (-1, -1), CREAM_C),
        ("BOX",          (0, 0), (-1, -1), 1.5, CORAL_C),
        ("LEFTPADDING",  (0, 0), (-1, -1), 14),
        ("RIGHTPADDING", (0, 0), (-1, -1), 14),
        ("TOPPADDING",   (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING",(0, 0), (-1, -1), 0),
        ("ROUNDEDCORNERS", [6]),
    ]))
    return KeepTogether([_spacer(14), t, _spacer(8)])


def _confirmed_badge():
    from reportlab.platypus import Table, TableStyle, Paragraph
    p = Paragraph(
        "<b>  \u2713  CONFIRMED  </b>",
        _ps("_badge", font_size=9, bold=True, color=WHITE_C, alignment=1),
    )
    t = Table([[p]], colWidths=[130])
    t.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, -1), GREEN_C),
        ("ROUNDEDCORNERS",(0, 0), (-1, -1), 6),
        ("TOPPADDING",    (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING",   (0, 0), (-1, -1), 10),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 10),
    ]))
    return t


def _status_badge(text: str, color=None):
    from reportlab.platypus import Table, TableStyle, Paragraph
    c = color or CORAL_C
    p = Paragraph(
        "<b>" + _safe(text) + "</b>",
        _ps("_sb", font_size=8, bold=True, color=WHITE_C, alignment=1),
    )
    t = Table([[p]], colWidths=[210])
    t.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, -1), c),
        ("ROUNDEDCORNERS",(0, 0), (-1, -1), 5),
        ("TOPPADDING",    (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING",   (0, 0), (-1, -1), 10),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 10),
    ]))
    return t


def _total_box(amount: str):
    from reportlab.platypus import Table, TableStyle, Paragraph
    lp = Paragraph("Total Paid",
                   _ps("_tl", font_size=10, bold=True, color=TEAL_C))
    vp = Paragraph(
        "<b>" + _safe(amount) + "</b>",
        _ps("_tv", font_size=14, bold=True, color=TEAL_C, alignment=2),
    )
    hw = CONTENT_W / 2
    t = Table([[lp, vp]], colWidths=[hw, hw])
    t.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, -1), LT_TEAL_C),
        ("BOX",           (0, 0), (-1, -1), 1, TEAL_C),
        ("ROUNDEDCORNERS",(0, 0), (-1, -1), 6),
        ("TOPPADDING",    (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("LEFTPADDING",   (0, 0), (-1, -1), 10),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 10),
        ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
    ]))
    return t


def _demo_note():
    from reportlab.platypus import Table, TableStyle, Paragraph
    p = Paragraph(
        "<b>Demo Payment</b>: no real money was charged. "
        "This is a simulated transaction for demonstration purposes only.",
        _ps("_dn", font_size=8, color=_rl_colors.HexColor("#92400E")),
    )
    t = Table([[p]], colWidths=[CONTENT_W])
    t.setStyle(TableStyle([
        ("BACKGROUND",   (0, 0), (-1, -1), _rl_colors.HexColor("#FFF7ED")),
        ("BOX",          (0, 0), (-1, -1), 0.5, _rl_colors.HexColor("#FED7AA")),
        ("TOPPADDING",   (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING",(0, 0), (-1, -1), 6),
        ("LEFTPADDING",  (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
    ]))
    return t


# ---------------------------------------------------------------------------
# Watermark / background
# ---------------------------------------------------------------------------

class _WatermarkState:
    """Mutable state shared between page-template callback and builder."""
    def __init__(self, images_bytes: List[bytes]):
        self.images_bytes = images_bytes
        self.page_index   = 0


def _draw_fallback_bg(c):
    """Cream page with very faint teal diagonal stripes."""
    c.saveState()
    c.setFillColor(CREAM_C)
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    c.setStrokeColor(TEAL_C)
    c.setStrokeAlpha(0.04)
    c.setLineWidth(10)
    step = 55
    lo = -int(PAGE_H / step)
    hi = int((PAGE_W + PAGE_H) / step) + 2
    for i in range(lo, hi):
        c.line(i * step, 0, i * step + PAGE_H, PAGE_H)
    c.restoreState()


def _draw_watermark(c, ws: _WatermarkState):
    imgs = ws.images_bytes
    if not imgs:
        _draw_fallback_bg(c)
        return
    pi = ws.page_index
    ws.page_index += 1

    _draw_fallback_bg(c)   # cream base first

    c.saveState()
    positions = [
        (0,           PAGE_H * 0.5, PAGE_W * 0.5, PAGE_H * 0.5),
        (PAGE_W * 0.5, PAGE_H * 0.5, PAGE_W * 0.5, PAGE_H * 0.5),
        (0,           0,            PAGE_W * 0.5, PAGE_H * 0.5),
        (PAGE_W * 0.5, 0,           PAGE_W * 0.5, PAGE_H * 0.5),
    ]
    n = len(imgs)
    for idx, (x, y, w, h) in enumerate(positions):
        raw = imgs[(pi * 4 + idx) % n]
        try:
            from reportlab.lib.utils import ImageReader
            from PIL import Image as PILImage
            pil = PILImage.open(io.BytesIO(raw))
            if pil.mode != "RGB":
                pil = pil.convert("RGB")
            buf = BytesIO()
            pil.save(buf, "JPEG", quality=55)
            buf.seek(0)
            ir = ImageReader(buf)
            c.setFillAlpha(0.09)
            c.drawImage(ir, x, y, w, h,
                        preserveAspectRatio=True, anchor="c", mask="auto")
        except Exception as exc:
            logger.debug("Watermark tile %d failed: %s", idx, exc)
    c.restoreState()


# ---------------------------------------------------------------------------
# Page template callback
# ---------------------------------------------------------------------------

def _draw_page(c, doc, title_text: str, ws: Optional[_WatermarkState],
               has_photos: bool, logo_path: Optional[str], doc_kind: str):
    """onPage callback: background + header band + footer."""
    page_num   = doc.page
    page_total = getattr(doc, "_page_count_final", "?")

    # Background
    if ws and has_photos:
        _draw_watermark(c, ws)
    else:
        _draw_fallback_bg(c)

    # --- Header band ---
    c.saveState()
    HEADER_H = 88
    c.setFillColor(TEAL_C)
    c.rect(0, PAGE_H - HEADER_H, PAGE_W, HEADER_H, fill=1, stroke=0)
    c.setFillColor(CORAL_C)
    c.rect(0, PAGE_H - HEADER_H - 3, PAGE_W, 3, fill=1, stroke=0)

    # Logo
    logo_gap = 0
    if logo_path:
        try:
            from reportlab.lib.utils import ImageReader
            c.setFillAlpha(1.0)
            c.drawImage(
                ImageReader(logo_path),
                MARGIN, PAGE_H - HEADER_H + 10,
                width=54, height=54,
                preserveAspectRatio=True, mask="auto",
            )
            logo_gap = 62
        except Exception as exc:
            logger.debug("Logo failed: %s", exc)

    fn_bold = _font_name(True)
    fn_reg  = _font_name(False)

    c.setFillColor(WHITE_C)
    c.setFont(fn_bold, 18)
    c.drawString(MARGIN + logo_gap + 2, PAGE_H - HEADER_H + 48, "Chalo Ghumne")

    c.setFont(fn_reg, 8)
    c.setFillColor(_rl_colors.HexColor("#B2D8E5"))
    c.drawString(MARGIN + logo_gap + 2, PAGE_H - HEADER_H + 33, "Plan smarter. Travel better.")

    c.setFillColor(WHITE_C)
    c.setFont(fn_bold, 11)
    c.drawRightString(PAGE_W - MARGIN, PAGE_H - HEADER_H + 48, title_text)
    c.restoreState()

    # Note: Footer is drawn in NumberedCanvas.save() so total page count is accurate.


# ---------------------------------------------------------------------------
# NumberedCanvas and doc build
# ---------------------------------------------------------------------------

def _make_numbered_canvas(has_photos: bool):
    from reportlab.pdfgen import canvas as _rl_canvas

    class NumberedCanvas(_rl_canvas.Canvas):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, **kwargs)
            self._saved_page_states = []

        def showPage(self):
            self._saved_page_states.append(dict(self.__dict__))
            self._startPage()

        def save(self):
            num_pages = len(self._saved_page_states)
            for state in self._saved_page_states:
                self.__dict__.update(state)
                self._draw_footer(num_pages)
                _rl_canvas.Canvas.showPage(self)
            _rl_canvas.Canvas.save(self)

        def _draw_footer(self, page_count: int):
            self.saveState()
            self.setFont(_font_name(False), 7)
            self.setFillColor(_rl_colors.HexColor("#94A3B8"))
            photo_credit = "  \u00b7  Photos: Unsplash" if has_photos else ""
            footer = (
                "Chalo Ghumne  \u00b7  " + _support_email() +
                "  \u00b7  Page " + str(self._pageNumber) + " of " + str(page_count) +
                photo_credit
            )
            self.drawCentredString(PAGE_W / 2, MARGIN - 8, footer)
            self.setStrokeColor(CORAL_C)
            self.setLineWidth(0.5)
            self.line(MARGIN, MARGIN + 4, PAGE_W - MARGIN, MARGIN + 4)
            self.restoreState()

    return NumberedCanvas


def _make_doc(buf, title_text, ws, has_photos, logo_p, doc_kind):
    from reportlab.platypus import BaseDocTemplate, PageTemplate, Frame

    frm = Frame(
        MARGIN, MARGIN + 22,
        CONTENT_W, PAGE_H - MARGIN - 116,
        id="main", showBoundary=0,
        leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0,
    )

    def _on_page(c, doc):
        _draw_page(c, doc, title_text=title_text, ws=ws,
                   has_photos=has_photos, logo_path=logo_p, doc_kind=doc_kind)

    tmpl = PageTemplate(id="main", frames=[frm], onPage=_on_page)
    d = BaseDocTemplate(
        buf,
        pagesize=(PAGE_W, PAGE_H),
        leftMargin=MARGIN, rightMargin=MARGIN,
        topMargin=112, bottomMargin=MARGIN + 22,
        title="Chalo Ghumne \u2014 " + title_text,
        author="Chalo Ghumne",
    )
    d.addPageTemplates([tmpl])
    return d


def _build(story, buf, title_text, ws, has_photos, logo_p, doc_kind):
    d = _make_doc(buf, title_text, ws, has_photos, logo_p, doc_kind)
    nc = _make_numbered_canvas(has_photos)
    d.build(story, canvasmaker=nc)


# ---------------------------------------------------------------------------
# PUBLIC API: build_confirmation_pdf
# ---------------------------------------------------------------------------

def build_confirmation_pdf(
    booking: Dict[str, Any],
    user: Dict[str, Any],
    images: Optional[List[bytes]] = None,
) -> bytes:
    """Build the booking confirmation PDF.  Returns PDF bytes."""
    _ensure_fonts()

    dest      = booking.get("destination") or {}
    flight    = booking.get("flight") or {}
    train     = booking.get("train") or {}
    hotel     = booking.get("hotel") or {}
    room      = booking.get("room") or {}
    pricing   = booking.get("pricing") or {}
    travelers = booking.get("travelers") or {}
    addons    = booking.get("addons") or []

    dest_name = _safe_plain(dest.get("name"), "Your Destination")
    booking_id = _safe_plain(booking.get("booking_id"), "\u2014")
    txn_id     = _safe_plain(booking.get("transaction_id"), "\u2014")
    transport_mode = (booking.get("transport_mode") or "flight").lower()

    buf   = BytesIO()
    logo_p = str(LOGO_PATH) if LOGO_PATH.exists() else None
    ws    = _WatermarkState(images) if images else None
    has_p = bool(images)
    story = []

    from reportlab.platypus import Table, TableStyle

    # Badges row
    story.append(_spacer(6))
    br = Table(
        [[_confirmed_badge(), "", _status_badge("DEMO PAYMENT SUCCESSFUL")]],
        colWidths=[135, CONTENT_W - 350, 215],
    )
    br.setStyle(TableStyle([
        ("VALIGN",      (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING",(0, 0), (-1, -1), 0),
    ]))
    story.append(br)
    story.append(_spacer(12))

    # Booking reference
    story.append(_section_heading("Booking Reference"))
    story.append(_kv("Booking ID",     booking_id, bold_val=True))
    story.append(_kv("Transaction ID", txn_id))
    story.append(_kv("Payment Status", "Demo Payment Successful", val_color=TEAL_C))
    story.append(_kv("Booking Status",
                     _title_case(_safe_plain(booking.get("booking_status"), "confirmed"))))
    created = booking.get("created_at") or ""
    if created:
        story.append(_kv("Booking Date", _safe_plain(created[:10])))
    story.append(_spacer(8))

    # Trip details
    story.append(_section_heading("Trip Details"))
    story.append(_kv("Destination",
                     _safe_plain(dest.get("name")) + ", " + _safe_plain(dest.get("country"))))
    story.append(_kv("Duration",
                     _safe_plain(booking.get("duration_days"), "0") + " days"))
    origin = booking.get("origin") or ""
    if origin:
        story.append(_kv("Departing From", _title_case(origin)))
    story.append(_spacer(8))

    # Transport
    if transport_mode == "train" and train:
        story.append(_section_heading("Train"))
        cls0 = (train.get("classes") or [{}])[0]
        story.append(_kv("Train",
                         _safe_plain(train.get("name")) + " (#" + _safe_plain(train.get("number")) + ")"))
        story.append(_kv("Route",
                         _safe_plain(train.get("from_station")) + " \u2192 " +
                         _safe_plain(train.get("to_station"))))
        story.append(_kv("Class",    _safe_plain(cls0.get("name"))))
        story.append(_kv("Departs",  _safe_plain(train.get("departure_time"))))
        story.append(_kv("Arrives",  _safe_plain(train.get("arrival_time"))))
        story.append(_kv("Duration", _safe_plain(train.get("duration"))))
        td = booking.get("travel_dates") or {}
        if td.get("start_date"):
            story.append(_kv("Travel Date", _safe_plain(td.get("start_date"))))
        story.append(_kv("Estimated Fare", _safe_plain(cls0.get("price")),
                         bold_val=True, val_color=TEAL_C))
        story.append(_para(
            "<i>Verify train availability and book at irctc.co.in. "
            "Fares shown are estimates.</i>",
            font_size=7, color=CORAL_C,
        ))
    else:
        story.append(_section_heading("Flight"))
        story.append(_kv("Airline",  _safe_plain(flight.get("airline"))))
        fn_num = _safe_plain(flight.get("flight_number"), "")
        if fn_num and fn_num != "\u2014":
            story.append(_kv("Flight No.", fn_num))
        fr = _safe_plain(flight.get("from_code") or flight.get("from"), "")
        to = _safe_plain(flight.get("to_code") or flight.get("to"), "")
        story.append(_kv("Route", fr + " \u2192 " + to))
        if flight.get("departure_time"):
            story.append(_kv("Departure", _safe_plain(flight.get("departure_time"))))
        if flight.get("arrival_time"):
            story.append(_kv("Arrival",   _safe_plain(flight.get("arrival_time"))))
        story.append(_kv("Duration", _safe_plain(flight.get("duration"))))
        story.append(_kv("Stops",    _safe_plain(flight.get("stops"))))
        story.append(_kv("Price",    _safe_plain(flight.get("price")),
                         bold_val=True, val_color=TEAL_C))
        story.append(_para(
            "<i>Flight details are estimates. "
            "Verify with the airline before travel.</i>",
            font_size=7, color=CORAL_C,
        ))
    story.append(_spacer(8))

    # Hotel & room
    story.append(_section_heading("Hotel & Room"))
    story.append(_kv("Hotel",     _safe_plain(hotel.get("name"))))
    story.append(_kv("Area",      _safe_plain(hotel.get("location"))))
    if hotel.get("rating"):
        story.append(_kv("Rating", "\u2605 " + str(hotel.get("rating")) + "/5"))
    story.append(_kv("Room Type", _safe_plain(room.get("label"))))
    story.append(_kv("Rooms",     str(booking.get("num_rooms") or 1)))
    story.append(_kv("Nights",    str(booking.get("num_nights") or 1)))
    ppn = room.get("price_per_night") or hotel.get("price_per_night")
    if ppn:
        story.append(_kv("Price / Night", _safe_plain(ppn), val_color=TEAL_C))
    amenities = hotel.get("amenities") or room.get("amenities") or []
    if amenities:
        story.append(_kv("Amenities",
                         ", ".join(_safe_plain(a) for a in amenities if a)))
    story.append(_spacer(8))

    # Travelers
    story.append(_section_heading("Travelers"))
    cname  = _safe_plain(travelers.get("fullName"), "")
    cemail = _safe_plain(travelers.get("email"), "")
    cphone = _safe_plain(travelers.get("phone"), "")
    if cname and cname != "\u2014":
        story.append(_kv("Contact Name", cname))
    if cemail and cemail not in ("\u2014", ""):
        story.append(_kv("Contact Email", cemail))
    if cphone and cphone not in ("\u2014", ""):
        story.append(_kv("Contact Phone", cphone))
    story.append(_kv("No. of Travelers", str(travelers.get("numTravelers") or 1)))

    pax = travelers.get("passengers") or []
    if pax:
        pax_hdr = ["#", "Name", "DOB", "Gender"]
        pax_rows = []
        for i, p in enumerate(pax, 1):
            pax_rows.append([
                str(i),
                _safe_plain(p.get("name"), "Passenger " + str(i)),
                _safe_plain(p.get("dob"), "\u2014"),
                _title_case(_safe_plain(p.get("gender"), "\u2014")),
            ])
        cw = [28, CONTENT_W * 0.44, CONTENT_W * 0.26, CONTENT_W * 0.18]
        t = _ztable(pax_hdr, pax_rows, col_widths=cw)
        if t:
            story.append(_spacer(6))
            story.append(t)
    story.append(_spacer(8))

    # Add-ons
    if addons:
        story.append(_section_heading("Add-on Services"))
        for a in addons:
            story.append(_kv(_safe_plain(a.get("name")), _safe_plain(a.get("price"))))
        story.append(_spacer(8))

    # Price breakdown
    story.append(_section_heading("Price Breakdown"))
    story.append(_kv("Subtotal",     _format_inr(pricing.get("subtotal"))))
    story.append(_kv("Taxes & Fees", _format_inr(pricing.get("taxes"))))
    disc = pricing.get("discount")
    if disc:
        story.append(_kv("Discount", "\u2212 " + _format_inr(disc), val_color=CORAL_C))
    story.append(_spacer(6))
    gt = pricing.get("grandTotal") or pricing.get("total")
    story.append(_total_box(_format_inr(gt)))
    story.append(_spacer(8))
    story.append(_demo_note())
    story.append(_spacer(10))

    # Closing block
    story.append(_closing_block(dest_name, kind="confirmation"))

    _build(story, buf, "Booking Confirmation", ws, has_p, logo_p, "confirmation")
    return buf.getvalue()


# ---------------------------------------------------------------------------
# PUBLIC API: build_itinerary_pdf
# ---------------------------------------------------------------------------

def build_itinerary_pdf(
    booking: Dict[str, Any],
    images: Optional[List[bytes]] = None,
) -> bytes:
    """
    Build the day-by-day itinerary PDF.
    `booking` may be a real booking doc (has itinerary_snapshot) or a raw
    itinerary dict (from POST /api/itinerary/pdf).
    Returns PDF bytes.
    """
    _ensure_fonts()

    # Accept either a booking doc or a raw itinerary payload
    it = (
        booking.get("itinerary_snapshot") or
        booking.get("itinerary") or
        booking
    )
    dest_obj = booking.get("destination") or {}

    # Determine primary destination name
    _dest_candidates = [
        it.get("title"),
        ((it.get("destinations") or [{}])[0].get("name") if it.get("destinations") else None),
        dest_obj.get("name"),
    ]
    dest_name = next((x for x in _dest_candidates if x), "Your Itinerary")

    booking_id = _safe_plain(booking.get("booking_id"), "")

    buf   = BytesIO()
    logo_p = str(LOGO_PATH) if LOGO_PATH.exists() else None
    ws    = _WatermarkState(images) if images else None
    has_p = bool(images)
    story = []

    from reportlab.platypus import Paragraph, KeepTogether, Table, TableStyle

    # Cover title
    story.append(_spacer(6))
    story.append(Paragraph(
        "<b>" + _safe(it.get("title") or dest_name) + "</b>",
        _ps("_ct", font_size=22, bold=True, color=TEAL_C, space_after=8),
    ))

    # Summary
    if it.get("summary"):
        story.append(Paragraph(
            _safe(it["summary"]),
            _ps("_cs", font_size=10, color=SLATE_C, space_after=10),
        ))

    # Trip facts
    facts = []
    nd = (it.get("duration_days") or booking.get("duration_days") or
          len(it.get("days") or []) or 0)
    if nd:
        facts.append("<b>" + str(nd) + " days</b>")
    origin = booking.get("origin") or ""
    if origin:
        facts.append("From <b>" + _safe(_title_case(origin)) + "</b>")
    budget = ((booking.get("preferences") or {}).get("budget") or
              it.get("budget") or "")
    if budget:
        facts.append("Budget: <b>" + _safe(_title_case(budget)) + "</b>")
    total = (it.get("estimated_total_cost") or
             (booking.get("pricing") or {}).get("grandTotal") or "")
    if total:
        facts.append("Est. Total: <b>" + _safe(str(total)) + "</b>")
    if facts:
        story.append(Paragraph(
            "  \u2022  ".join(facts),
            _ps("_cf", font_size=9, color=MUTED_C, space_after=12),
        ))

    # Destinations
    destinations = it.get("destinations") or []
    if destinations:
        story.append(_section_heading("Destinations"))
        for d in destinations:
            dn = _safe_plain(d.get("name"), "\u2014")
            dc = _safe_plain(d.get("country"), "")
            dw = _safe(d.get("why") or "")
            header_text = "<b>" + _safe(dn) + "</b>"
            if dc and dc != "\u2014":
                header_text += ", " + _safe(dc)
            story.append(Paragraph(
                header_text,
                _ps("_dh", font_size=10, bold=True, color=TEAL_C, space_after=2),
            ))
            if dw and dw != "\u2014":
                story.append(Paragraph(
                    dw,
                    _ps("_dw", font_size=8, color=MUTED_C,
                        space_after=6, left_indent=12),
                ))
    story.append(_spacer(8))

    # Day-by-day
    days = it.get("days") or []
    if days:
        story.append(_section_heading("Day-by-Day Itinerary"))
        for day in days:
            day_num   = _safe_plain(day.get("day"), "?")
            day_title = _safe_plain(day.get("title"), "")
            location  = _safe_plain(day.get("location"), "")
            label_parts = ["Day " + day_num]
            if day_title and day_title != "\u2014":
                label_parts.append(day_title)
            if location and location != "\u2014":
                label_parts.append(location)
            day_label = " \u00b7 ".join(label_parts)

            day_hdr = Paragraph(
                "<b>" + _safe(day_label) + "</b>",
                _ps("_dh2", font_size=10, bold=True, color=TEAL_C,
                    space_before=10, space_after=3),
            )
            day_items = [day_hdr]

            for slot in ("morning", "afternoon", "evening"):
                sd = day.get(slot) or {}
                act = sd.get("activity") or ""
                lmk = sd.get("landmark") or ""
                if not act:
                    continue
                text = (
                    "<font color='" + CORAL_HEX + "'><b>" +
                    slot.capitalize() + "</b></font>  " + _safe(act)
                )
                if lmk:
                    text += " \u2014 <i>" + _safe(lmk) + "</i>"
                day_items.append(Paragraph(
                    text,
                    _ps("_slot", font_size=9, space_after=3, left_indent=12),
                ))

            food = day.get("food") or {}
            meals = []
            for meal in ("breakfast", "lunch", "dinner"):
                if food.get(meal):
                    meals.append(
                        "<b>" + meal.capitalize() + "</b>: " +
                        _safe(food[meal])
                    )
            if meals:
                day_items.append(Paragraph(
                    "  \u00b7  ".join(meals),
                    _ps("_food", font_size=8, color=MUTED_C,
                        space_after=4, left_indent=12),
                ))

            day_items.append(_spacer(4))
            # Keep heading + first slot together to avoid orphan headings
            story.append(KeepTogether(day_items[:3]))
            story.extend(day_items[3:])
    else:
        # Fallback when no day data
        story.append(_section_heading("Trip Summary"))
        story.append(_kv("Destination",
                         _safe_plain(dest_obj.get("name")) + ", " +
                         _safe_plain(dest_obj.get("country"))))
        story.append(_kv("Duration",
                         _safe_plain(booking.get("duration_days"), "0") + " days"))
        if booking.get("origin"):
            story.append(_kv("From", _title_case(booking["origin"])))
        story.append(_para(
            "Full day-by-day itinerary was not captured with this booking. "
            "Generate a new booking from a saved itinerary to include full day plans.",
            font_size=8, color=MUTED_C,
        ))

    story.append(_spacer(8))

    # Hotels table
    hotels = it.get("hotels") or []
    if hotels:
        story.append(_section_heading("Suggested Stays"))
        h_hdr = ["Hotel", "Area", "Rating", "Price/Night", "Amenities"]
        h_rows = []
        for h in hotels:
            hn  = _safe_plain(h.get("name"), "\u2014")
            sel = h.get("selected") or h.get("is_selected")
            h_rows.append([
                ("\u2605 " if sel else "") + hn,
                _safe_plain(h.get("location"), "\u2014"),
                _safe_plain(h.get("rating"), "\u2014") + "/5",
                _safe_plain(h.get("price_per_night"), "\u2014"),
                ", ".join(_safe_plain(a) for a in (h.get("amenities") or []) if a) or "\u2014",
            ])
        cw = [CW * r for r in [0.22, 0.14, 0.1, 0.16, 0.38] for CW in [CONTENT_W]][::5]
        # rebuild cw properly
        cw = [
            CONTENT_W * 0.22,
            CONTENT_W * 0.14,
            CONTENT_W * 0.10,
            CONTENT_W * 0.16,
            CONTENT_W * 0.38,
        ]
        t = _ztable(h_hdr, h_rows, col_widths=cw)
        if t:
            story.append(t)
            story.append(_spacer(8))

    # Flights table (estimated)
    flights = it.get("flights") or []
    if flights:
        story.append(_section_heading("Flights (Estimated)"))
        f_hdr = ["Airline", "Route", "Duration", "Stops", "Price"]
        f_rows = [
            [
                _safe_plain(f.get("airline"), "\u2014"),
                _safe_plain(f.get("from"), "") + " \u2192 " + _safe_plain(f.get("to"), ""),
                _safe_plain(f.get("duration"), "\u2014"),
                _safe_plain(f.get("stops"), "\u2014"),
                _safe_plain(f.get("price"), "\u2014"),
            ]
            for f in flights
        ]
        cw = [
            CONTENT_W * 0.25,
            CONTENT_W * 0.28,
            CONTENT_W * 0.15,
            CONTENT_W * 0.12,
            CONTENT_W * 0.20,
        ]
        t = _ztable(f_hdr, f_rows, col_widths=cw)
        if t:
            story.append(t)
            story.append(_para(
                "<i>Flight prices are AI estimates. "
                "Verify with the airline before booking.</i>",
                font_size=7, color=CORAL_C,
            ))
            story.append(_spacer(8))

    # Train section
    transport_list = it.get("transport") or []
    real_trains = [
        tr for tr in transport_list
        if (tr.get("mode") or "").lower() == "train" and not tr.get("estimated")
    ]
    booked_train = booking.get("train") or {}
    if real_trains or booked_train:
        story.append(_section_heading("Train"))
        if booked_train:
            story.append(_kv("Train",
                             _safe_plain(booked_train.get("name")) + " (#" +
                             _safe_plain(booked_train.get("number")) + ")"))
            story.append(_kv("Route",
                             _safe_plain(booked_train.get("from_station")) + " \u2192 " +
                             _safe_plain(booked_train.get("to_station"))))
        for rt in real_trains:
            story.append(_kv(
                _safe_plain(rt.get("provider") or rt.get("name") or "Train"),
                _safe_plain(rt.get("from")) + " \u2192 " + _safe_plain(rt.get("to")) +
                " \u00b7 " + _safe_plain(rt.get("price")),
            ))
        story.append(_spacer(8))

    # Booked flight
    booked_flight = booking.get("flight") or {}
    if (booking.get("transport_mode") or "flight").lower() == "flight" and booked_flight:
        story.append(_section_heading("Selected Flight"))
        story.append(_kv("Airline",
                         _safe_plain(booked_flight.get("airline"))))
        story.append(_kv("Route",
                         _safe_plain(booked_flight.get("from")) + " \u2192 " +
                         _safe_plain(booked_flight.get("to"))))
        story.append(_kv("Price", _safe_plain(booked_flight.get("price")),
                         bold_val=True, val_color=TEAL_C))
        story.append(_spacer(8))

    # Landmarks
    landmarks = it.get("landmarks") or []
    if landmarks:
        story.append(_section_heading("Famous Landmarks"))
        for lm in landmarks:
            ln = _safe_plain(lm.get("name"), "\u2014")
            ll = _safe_plain(lm.get("location"), "")
            ld = _safe(lm.get("description") or "")
            hdr = "<b>" + _safe(ln) + "</b>"
            if ll and ll != "\u2014":
                hdr += " \u2014 " + _safe(ll)
            story.append(Paragraph(
                hdr,
                _ps("_lh", font_size=9, bold=True, color=TEAL_C, space_after=2),
            ))
            if ld and ld != "\u2014":
                story.append(Paragraph(
                    ld,
                    _ps("_ld", font_size=8, color=MUTED_C,
                        space_after=5, left_indent=12),
                ))
        story.append(_spacer(8))

    # Tips
    tips = it.get("tips") or []
    if tips:
        story.append(_section_heading("Travel Tips"))
        tip_items = [_spacer(4)]
        for i, tip in enumerate(tips, 1):
            tip_items.append(Paragraph(
                "<b>" + str(i) + ".</b> " + _safe(tip),
                _ps("_tip" + str(i), font_size=9, space_after=4, left_indent=8),
            ))
        tip_items.append(_spacer(4))
        tip_t = Table([tip_items], colWidths=[CONTENT_W])
        tip_t.setStyle(TableStyle([
            ("BACKGROUND",   (0, 0), (-1, -1), LT_TEAL_C),
            ("BOX",          (0, 0), (-1, -1), 0.5, TEAL_C),
            ("TOPPADDING",   (0, 0), (-1, -1), 0),
            ("BOTTOMPADDING",(0, 0), (-1, -1), 0),
            ("LEFTPADDING",  (0, 0), (-1, -1), 10),
            ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ]))
        story.append(tip_t)
        story.append(_spacer(8))

    # Cost summary
    pricing = booking.get("pricing") or {}
    if pricing.get("grandTotal"):
        story.append(_section_heading("Cost Summary"))
        story.append(_kv("Subtotal",     _safe_plain(pricing.get("subtotal"))))
        story.append(_kv("Taxes & Fees", _safe_plain(pricing.get("taxes"))))
        disc = pricing.get("discount")
        if disc:
            story.append(_kv("Discount", "\u2212 " + _safe_plain(disc), val_color=CORAL_C))
        story.append(_spacer(4))
        story.append(_total_box(_safe_plain(pricing.get("grandTotal"), "\u2014")))
        story.append(_spacer(8))

    # Booking reference
    if booking_id and booking_id != "\u2014":
        story.append(_section_heading("Booking Reference"))
        story.append(_kv("Booking ID", booking_id))
        story.append(_spacer(6))

    # Closing block
    story.append(_closing_block(dest_name, kind="itinerary"))

    _build(story, buf, "Trip Itinerary", ws, has_p, logo_p, "itinerary")
    return buf.getvalue()

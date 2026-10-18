"""
PDF generation service for Chalo Ghumne booking emails.

Provides:
  build_confirmation_pdf(booking, user) -> bytes
  build_itinerary_pdf(booking) -> bytes

Requirements:
  - reportlab
  - backend/assets/fonts/DejaVuSans.ttf
  - backend/assets/fonts/DejaVuSans-Bold.ttf

The ₹ symbol requires a TTF font; Helvetica cannot render it.
"""

import os
import html
import logging
from io import BytesIO
from pathlib import Path
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)

# ── Font registration ──────────────────────────────────────────────────────────

FONTS_DIR = Path(__file__).parent / "assets" / "fonts"
FONT_REGULAR = str(FONTS_DIR / "DejaVuSans.ttf")
FONT_BOLD    = str(FONTS_DIR / "DejaVuSans-Bold.ttf")

_FONTS_REGISTERED = False


def _ensure_fonts():
    global _FONTS_REGISTERED
    if _FONTS_REGISTERED:
        return
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    try:
        pdfmetrics.registerFont(TTFont("DejaVuSans", FONT_REGULAR))
        pdfmetrics.registerFont(TTFont("DejaVuSans-Bold", FONT_BOLD))
        _FONTS_REGISTERED = True
    except Exception as exc:
        logger.warning("Could not register DejaVuSans fonts: %s", exc)
        # Fallback: use Helvetica (₹ will render as □ but won't crash)


# ── Palette & layout constants ─────────────────────────────────────────────────

TEAL       = (13 / 255, 92 / 255, 117 / 255)   # #0D5C75
CORAL      = (231 / 255, 111 / 255, 81 / 255)  # #E76F51
WHITE      = (1, 1, 1)
DARK       = (26 / 255, 37 / 255, 48 / 255)    # #1A2530
MUTED      = (100 / 255, 116 / 255, 139 / 255) # #64748B
LIGHTBG    = (253 / 255, 251 / 255, 247 / 255) # #FDFBF7
LIGHT_TEAL = (13 / 255, 92 / 255, 117 / 255, 0.08)


def _support_email():
    """Read the support email fresh from the environment on every call.

    Reading at module import time is unsafe (load_dotenv may run later); this
    helper guarantees we always see the current value.
    """
    return os.environ.get("SUPPORT_EMAIL", "chaloghumne.trips@gmail.com")


PAGE_W = 595.27   # A4 width in pt
PAGE_H = 841.89   # A4 height in pt
MARGIN = 48


# ── Low-level drawing helpers ──────────────────────────────────────────────────

def _safe(value, fallback="—") -> str:
    """Convert any value to a safe, non-empty string. Strips HTML entities."""
    if value is None:
        return fallback
    s = str(value).strip()
    if not s:
        return fallback
    # Escape chars that could break Paragraph (< > &)
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def _title_case(s: str) -> str:
    if not s:
        return s
    return " ".join(w.capitalize() for w in s.strip().split())


class _Canvas:
    """Thin wrapper around reportlab canvas for structured layout."""

    def __init__(self, buf: BytesIO):
        from reportlab.pdfgen import canvas as rl_canvas
        _ensure_fonts()
        self.c = rl_canvas.Canvas(buf, pagesize=(PAGE_W, PAGE_H))
        self.y = PAGE_H - MARGIN
        self.page = 1

    # ── Font helpers ─────────────────────────────────────────────────

    def _font(self, bold=False, size=10):
        name = "DejaVuSans-Bold" if bold else "DejaVuSans"
        if not _FONTS_REGISTERED:
            name = "Helvetica-Bold" if bold else "Helvetica"
        self.c.setFont(name, size)

    def _color(self, rgb):
        self.c.setFillColorRGB(*rgb[:3])

    # ── Page management ──────────────────────────────────────────────

    def _new_page(self):
        self._draw_page_footer()
        self.c.showPage()
        self.y = PAGE_H - MARGIN
        self.page += 1
        self.c.setFillColorRGB(*DARK)

    def _check_space(self, needed=30):
        if self.y < MARGIN + 60 + needed:
            self._new_page()

    def _draw_page_footer(self):
        self.c.saveState()
        self._font(size=7)
        self._color(MUTED)
        footer_text = f"Chalo Ghumne  ·  {_support_email()}  ·  Demo project — no real money charged  ·  Page {self.page}"
        self.c.drawCentredString(PAGE_W / 2, MARGIN - 20, footer_text)
        self.c.restoreState()

    # ── Drawing primitives ───────────────────────────────────────────

    def header_band(self, title: str, subtitle: str = ""):
        """Teal header band at top of first page."""
        self.c.setFillColorRGB(*TEAL)
        self.c.rect(0, PAGE_H - 80, PAGE_W, 80, fill=1, stroke=0)
        self._color(WHITE)
        self._font(bold=True, size=20)
        self.c.drawString(MARGIN, PAGE_H - 34, "Chalo Ghumne")
        self._font(size=9)
        self.c.drawString(MARGIN, PAGE_H - 52, title)
        if subtitle:
            self._font(bold=True, size=11)
            self.c.drawRightString(PAGE_W - MARGIN, PAGE_H - 42, subtitle)
        # coral accent line
        self.c.setFillColorRGB(*CORAL)
        self.c.rect(0, PAGE_H - 82, PAGE_W, 2, fill=1, stroke=0)
        self.y = PAGE_H - 100

    def section_heading(self, text: str):
        self._check_space(24)
        self.y -= 6
        # teal left bar
        self.c.setFillColorRGB(*TEAL)
        self.c.rect(MARGIN, self.y - 12, 3, 16, fill=1, stroke=0)
        self._font(bold=True, size=11)
        self._color(TEAL)
        self.c.drawString(MARGIN + 9, self.y, text)
        self.y -= 18

    def line(self, label: str, value: str, bold_val=False, color_val=None):
        self._check_space(16)
        self._font(size=9)
        self._color(MUTED)
        self.c.drawString(MARGIN + 9, self.y, label)
        self._font(bold=bold_val, size=9)
        self._color(color_val or DARK)
        self.c.drawRightString(PAGE_W - MARGIN, self.y, value)
        self.y -= 14

    def para(self, text: str, size=9, bold=False, indent=9, gap=12, color=None):
        """Word-wrapped paragraph."""
        self._check_space(16)
        self._font(bold=bold, size=size)
        self._color(color or DARK)
        avail = PAGE_W - MARGIN * 2 - indent
        words = text.split()
        current_line = ""
        for word in words:
            test = (current_line + " " + word).strip()
            w = self.c.stringWidth(test, "DejaVuSans" if _FONTS_REGISTERED else "Helvetica", size)
            if w > avail and current_line:
                self._check_space(size + 4)
                self.c.drawString(MARGIN + indent, self.y, current_line)
                self.y -= size + 4
                current_line = word
            else:
                current_line = test
        if current_line:
            self._check_space(size + 4)
            self.c.drawString(MARGIN + indent, self.y, current_line)
            self.y -= size + 4
        self.y -= gap - 4

    def divider(self, gap=8):
        self._check_space(gap + 4)
        self.y -= gap
        self.c.setStrokeColorRGB(*MUTED)
        self.c.setLineWidth(0.3)
        self.c.line(MARGIN, self.y, PAGE_W - MARGIN, self.y)
        self.y -= gap

    def badge(self, text: str, color=None):
        """Small inline badge."""
        self._check_space(20)
        clr = color or CORAL
        self._font(bold=True, size=8)
        w = self.c.stringWidth(text, "DejaVuSans-Bold" if _FONTS_REGISTERED else "Helvetica-Bold", 8) + 16
        self.c.setFillColorRGB(*clr)
        self.c.roundRect(MARGIN + 9, self.y - 2, w, 14, 4, fill=1, stroke=0)
        self._color(WHITE)
        self.c.drawString(MARGIN + 17, self.y + 2, text)
        self.y -= 22

    def spacer(self, h=10):
        self.y -= h

    def finish(self):
        self._draw_page_footer()
        self.c.save()


# ── Confirmation PDF ──────────────────────────────────────────────────────────

def build_confirmation_pdf(booking: Dict[str, Any], user: Dict[str, Any]) -> bytes:
    """
    Build the booking confirmation PDF.
    Returns PDF bytes.
    """
    buf = BytesIO()
    cv = _Canvas(buf)

    dest     = booking.get("destination") or {}
    flight   = booking.get("flight") or {}
    train    = booking.get("train") or {}
    hotel    = booking.get("hotel") or {}
    room     = booking.get("room") or {}
    pricing  = booking.get("pricing") or {}
    travelers = booking.get("travelers") or {}
    addons   = booking.get("addons") or []

    dest_name = _safe(dest.get("name"))
    dest_country = _safe(dest.get("country"))
    booking_id = _safe(booking.get("booking_id"))
    txn_id     = _safe(booking.get("transaction_id"))

    # ── Header ──────────────────────────────────────────────────────
    cv.header_band("Booking Confirmation", dest_name)

    # ── Booking status badges ────────────────────────────────────────
    cv.spacer(6)
    cv.badge("BOOKING CONFIRMED", color=TEAL)
    cv.badge("DEMO PAYMENT SUCCESSFUL", color=CORAL)
    cv.spacer(4)

    # ── IDs ──────────────────────────────────────────────────────────
    cv.section_heading("Booking Reference")
    cv.line("Booking ID",    booking_id, bold_val=True)
    cv.line("Transaction ID", txn_id)
    cv.line("Payment Status", "Demo Payment Successful", color_val=TEAL)
    cv.line("Booking Status", _safe(booking.get("booking_status"), "confirmed").capitalize())

    # ── Trip ─────────────────────────────────────────────────────────
    cv.divider()
    cv.section_heading("Trip Details")
    cv.line("Destination", f"{dest_name}, {dest_country}")
    cv.line("Duration",    f"{_safe(booking.get('duration_days'), '0')} days")
    origin = booking.get("origin") or ""
    if origin:
        cv.line("From", _title_case(origin))

    # ── Transport (flight OR train) ───────────────────────────────────
    transport_mode = (booking.get("transport_mode") or "flight").lower()
    cv.divider()

    if transport_mode == "train" and train:
        cv.section_heading("Train")
        cv.line("Train", f"{_safe(train.get('name'))} ({_safe(train.get('number'))})")
        cv.line("Route",  f"{_safe(train.get('from_station'))} → {_safe(train.get('to_station'))}")
        cv.line("Class",  _safe((train.get("classes") or [{}])[0].get("name")))
        cv.line("Times",  f"{_safe(train.get('departure_time'))} → {_safe(train.get('arrival_time'))}")
        cv.line("Duration", _safe(train.get("duration")))
        travel_date = booking.get("travel_dates", {})
        if travel_date:
            cv.line("Travel Date", _safe(travel_date.get("start_date") or travel_date.get("duration_days")))
        price = (train.get("classes") or [{}])[0].get("price") or "—"
        cv.line("Estimated Fare", _safe(price), bold_val=True, color_val=TEAL)
        cv.para("Verify train availability and book at irctc.co.in. Fares are estimates.", size=8, color=CORAL, indent=9)
    else:
        cv.section_heading("Flight")
        airline = _safe(flight.get("airline"))
        cv.line("Airline",   airline)
        cv.line("Route",     f"{_safe(flight.get('from'))} → {_safe(flight.get('to'))}")
        cv.line("Duration",  _safe(flight.get("duration")))
        cv.line("Stops",     _safe(flight.get("stops")))
        cv.line("Price",     _safe(flight.get("price")), bold_val=True, color_val=TEAL)
        cv.para("Flight details are estimates. Verify with the airline before travel.", size=8, color=CORAL)

    # ── Hotel & Room ──────────────────────────────────────────────────
    cv.divider()
    cv.section_heading("Hotel & Room")
    cv.line("Hotel",    f"{_safe(hotel.get('name'))} — {_safe(hotel.get('location'))}")
    if hotel.get("rating"):
        cv.line("Rating",   f"\u2605 {hotel.get('rating')}/5")
    cv.line("Room Type", _safe(room.get("label")))
    cv.line("Rooms",     str(booking.get("num_rooms") or 1))
    cv.line("Nights",    str(booking.get("num_nights") or 1))

    # ── Travelers ─────────────────────────────────────────────────────
    cv.divider()
    cv.section_heading("Travelers")
    cv.line("Contact Name",  _safe(travelers.get("fullName")))
    cv.line("No. of Travelers", str(travelers.get("numTravelers") or 1))
    passengers = travelers.get("passengers") or []
    for i, p in enumerate(passengers, 1):
        name = _safe(p.get("name"))
        dob  = _safe(p.get("dob"), "")
        gend = _safe(p.get("gender"), "")
        detail = name
        if dob and dob != "—":
            detail += f"  ·  DOB: {dob}"
        if gend and gend != "—":
            detail += f"  ·  {gend.capitalize()}"
        cv.line(f"Passenger {i}", detail)

    # ── Add-ons ───────────────────────────────────────────────────────
    if addons:
        cv.divider()
        cv.section_heading("Add-on Services")
        for addon in addons:
            cv.line(_safe(addon.get("name")), _safe(addon.get("price")))

    # ── Price Breakdown ───────────────────────────────────────────────
    cv.divider()
    cv.section_heading("Price Breakdown")
    cv.line("Subtotal",     _safe(pricing.get("subtotal")))
    cv.line("Taxes & Fees", _safe(pricing.get("taxes")))
    discount = pricing.get("discount")
    if discount:
        cv.line("Discount", f"- {_safe(discount)}")
    cv.divider(gap=4)
    cv.line("Total Paid",   _safe(pricing.get("grandTotal")), bold_val=True, color_val=TEAL)

    # ── Demo note ─────────────────────────────────────────────────────
    cv.spacer(10)
    cv.para("Demo Payment — no real money was charged. This is a simulated booking for demonstration only.", size=8, color=CORAL)

    # ── Support ───────────────────────────────────────────────────────
    cv.spacer(6)
    cv.para(f"Need help with this booking? Email {_support_email()} with booking ID {booking_id}.", size=8)

    cv.finish()
    return buf.getvalue()


# ── Itinerary PDF ─────────────────────────────────────────────────────────────

def build_itinerary_pdf(booking: Dict[str, Any]) -> bytes:
    """
    Build the day-by-day itinerary PDF from the itinerary snapshot stored
    in the booking. If no snapshot is found, builds a shorter summary.
    Returns PDF bytes.
    """
    buf = BytesIO()
    cv = _Canvas(buf)

    it = booking.get("itinerary_snapshot") or {}
    dest = booking.get("destination") or {}
    dest_name = _safe(it.get("title") or dest.get("name"))
    dest_country = _safe(it.get("destinations", [{}])[0].get("country") if it.get("destinations") else dest.get("country"))
    booking_id = _safe(booking.get("booking_id"))

    # ── Header ──────────────────────────────────────────────────────
    cv.header_band("Trip Itinerary", dest_name)
    cv.spacer(6)

    # ── Summary ──────────────────────────────────────────────────────
    if it.get("summary"):
        cv.para(_safe(it.get("summary")), size=9, gap=8)

    # ── Destination overview ──────────────────────────────────────────
    if it.get("destinations"):
        cv.section_heading("Destinations")
        for d in (it.get("destinations") or []):
            cv.line(_safe(d.get("name")), _safe(d.get("country")))
            if d.get("why"):
                cv.para(_safe(d.get("why")), size=8, indent=18, gap=6, color=MUTED)

    # ── Day-by-day ────────────────────────────────────────────────────
    days = it.get("days") or []
    if days:
        cv.divider()
        cv.section_heading("Day-by-Day Itinerary")
        for day in days:
            cv._check_space(40)
            day_num   = _safe(day.get("day"), "?")
            day_title = _safe(day.get("title"), "")
            location  = _safe(day.get("location"), "")
            cv.spacer(4)
            cv._font(bold=True, size=10)
            cv._color(TEAL)
            label = f"Day {day_num}"
            if day_title and day_title != "—":
                label += f"  —  {day_title}"
            if location and location != "—":
                label += f"  ({location})"
            cv.c.drawString(MARGIN + 9, cv.y, label)
            cv.y -= 14

            for slot in ("morning", "afternoon", "evening"):
                slot_data = day.get(slot) or {}
                activity = slot_data.get("activity") or ""
                landmark = slot_data.get("landmark") or ""
                if activity:
                    text = f"  {slot.capitalize()}: {_safe(activity)}"
                    if landmark:
                        text += f" ({_safe(landmark)})"
                    cv.para(text, size=8, indent=18, gap=5)

            food = day.get("food") or {}
            meals = []
            for meal in ("breakfast", "lunch", "dinner"):
                if food.get(meal):
                    meals.append(f"{meal.capitalize()}: {_safe(food.get(meal))}")
            if meals:
                cv.para("  Food: " + "  ·  ".join(meals), size=8, indent=18, gap=6, color=MUTED)
    else:
        # Fallback: no itinerary snapshot
        cv.section_heading("Trip Summary")
        cv.line("Destination",  f"{_safe(dest.get('name'))}, {_safe(dest.get('country'))}")
        cv.line("Duration",     f"{_safe(booking.get('duration_days'), '0')} days")
        origin = booking.get("origin") or ""
        if origin:
            cv.line("From", _title_case(origin))
        cv.para("Full day-by-day itinerary was not captured with this booking. Generate a new booking from a saved itinerary to include full day plans.", size=8, color=MUTED)

    # ── Hotels ───────────────────────────────────────────────────────
    hotels = it.get("hotels") or []
    if hotels:
        cv.divider()
        cv.section_heading("Suggested Stays")
        for h in hotels:
            cv.line(_safe(h.get("name")), f"{_safe(h.get('location'))}  ·  {_safe(h.get('price_per_night'))}/night")

    # ── Selected transport ────────────────────────────────────────────
    flight = booking.get("flight") or {}
    train  = booking.get("train") or {}
    transport_mode = (booking.get("transport_mode") or "flight").lower()
    cv.divider()
    if transport_mode == "train" and train:
        cv.section_heading("Train")
        cv.line(_safe(train.get("name")), f"#{_safe(train.get('number'))}")
        cv.line("Route", f"{_safe(train.get('from_station'))} → {_safe(train.get('to_station'))}")
    elif flight:
        cv.section_heading("Flight")
        cv.line(_safe(flight.get("airline")), f"{_safe(flight.get('from'))} → {_safe(flight.get('to'))}")
        cv.line("Price", _safe(flight.get("price")))

    # ── Landmarks ─────────────────────────────────────────────────────
    landmarks = it.get("landmarks") or []
    if landmarks:
        cv.divider()
        cv.section_heading("Famous Landmarks")
        for l in landmarks:
            cv.line(_safe(l.get("name")), _safe(l.get("location")))
            if l.get("description"):
                cv.para(_safe(l.get("description")), size=8, indent=18, gap=5, color=MUTED)

    # ── Tips ──────────────────────────────────────────────────────────
    tips = it.get("tips") or []
    if tips:
        cv.divider()
        cv.section_heading("Travel Tips")
        for i, tip in enumerate(tips, 1):
            cv.para(f"{i}. {_safe(tip)}", size=8, indent=9, gap=5)

    # ── Cost summary ──────────────────────────────────────────────────
    pricing = booking.get("pricing") or {}
    if pricing.get("grandTotal"):
        cv.divider()
        cv.section_heading("Cost Summary")
        cv.line("Total Paid", _safe(pricing.get("grandTotal")), bold_val=True, color_val=TEAL)

    # ── Booking reference ──────────────────────────────────────────────
    cv.divider()
    cv.section_heading("Booking Reference")
    cv.line("Booking ID", booking_id)
    cv.spacer(6)
    cv.para(f"Questions? Email {_support_email()} with your booking ID.", size=8)
    cv.para("Demo project — no real money was charged.", size=8, color=CORAL)

    cv.finish()
    return buf.getvalue()

"""
Email service for Chalo Ghumne booking confirmations.

Uses only Python stdlib: smtplib, ssl, email.message.EmailMessage.
Generates both PDFs and attaches them to the booking confirmation email.

Environment variables (see .env.example):
  SMTP_HOST          (default smtp.gmail.com)
  SMTP_PORT          (default 587)
  SMTP_USER          Gmail address
  SMTP_APP_PASSWORD  Gmail App Password (spaces stripped)
  MAIL_FROM_NAME     (default "Chalo Ghumne")
  SUPPORT_EMAIL      (default chaloghumne.trips@gmail.com)
  FRONTEND_BASE_URL  (default http://localhost:3000)
"""

import asyncio
import html
import logging
import os
import smtplib
import ssl
import time
from email.message import EmailMessage
from typing import Any, Dict, Optional

from pdf_service import build_confirmation_pdf, build_itinerary_pdf

logger = logging.getLogger(__name__)

# ── Config (read at call time so load_dotenv() ordering never matters) ─────────

# Module-level constant kept for code that imports the symbol at import time
# (send_test_email.py, test_email_pdf.py). Functions below always re-read the
# live environment via _cfg() so values set after import (e.g. by load_dotenv
# or a test's patch.dict) are honoured.
SUPPORT_EMAIL = os.environ.get("SUPPORT_EMAIL", "chaloghumne.trips@gmail.com")


def _cfg():
    """Read SMTP / mail settings fresh from the environment on every call.

    Reading once at import time is unsafe: load_dotenv() may run *after* this
    module is imported (e.g. by a test runner or a script), leaving the values
    empty. Calling this helper inside each function guarantees we always see
    the current environment.
    """
    return {
        "host": os.environ.get("SMTP_HOST", "smtp.gmail.com"),
        "port": int(os.environ.get("SMTP_PORT", "587")),
        "user": os.environ.get("SMTP_USER", "").strip(),
        "pw": os.environ.get("SMTP_APP_PASSWORD", "").replace(" ", ""),
        "from_name": os.environ.get("MAIL_FROM_NAME", "Chalo Ghumne"),
        "support": os.environ.get("SUPPORT_EMAIL", "chaloghumne.trips@gmail.com"),
        "frontend_url": (os.environ.get("FRONTEND_BASE_URL") or "http://localhost:3000").rstrip("/"),
    }


# /bookings/:bookingId  — matches App.js route
BOOKING_ROUTE = "/bookings/{booking_id}"

MAX_MSG_BYTES   = 20 * 1024 * 1024   # 20 MB warning threshold
RETRY_DELAY_S   = 4


# ── Email masking ─────────────────────────────────────────────────────────────

def _mask_email(email: str) -> str:
    """Return j***@gmail.com style masked address for logging."""
    if not email or "@" not in email:
        return "***"
    local, domain = email.split("@", 1)
    return f"{local[0]}***@{domain}"


# ── HTML helpers ──────────────────────────────────────────────────────────────

def _e(value: Any, fallback: str = "—") -> str:
    """HTML-escape a value. Returns fallback if empty."""
    if value is None:
        return fallback
    s = str(value).strip()
    return html.escape(s) if s else fallback


def _title_case(s: str) -> str:
    if not s:
        return s
    return " ".join(w.capitalize() for w in s.strip().split())


# ── Email body builders ───────────────────────────────────────────────────────

def _build_plain(booking: Dict, user: Dict) -> str:
    dest     = booking.get("destination") or {}
    flight   = booking.get("flight") or {}
    train    = booking.get("train") or {}
    hotel    = booking.get("hotel") or {}
    room     = booking.get("room") or {}
    pricing  = booking.get("pricing") or {}
    travelers = booking.get("travelers") or {}
    tips     = (booking.get("itinerary_snapshot") or {}).get("tips") or []
    bid      = booking.get("booking_id", "—")
    txn      = booking.get("transaction_id", "—")
    dest_name = dest.get("name") or "your destination"
    origin    = booking.get("origin") or ""
    num_days  = booking.get("duration_days") or 0
    transport_mode = (booking.get("transport_mode") or "flight").lower()

    booking_url = _cfg()["frontend_url"] + BOOKING_ROUTE.format(booking_id=bid)

    lines = [
        "Thank you for booking with Chalo Ghumne!",
        f"Your trip to {dest_name} is confirmed.",
        "",
        f"Booking ID  : {bid}",
        f"Transaction : {txn}",
        f"Payment     : Demo Payment Successful",
        "",
        f"Destination : {dest_name}, {dest.get('country') or ''}",
        f"Duration    : {num_days} days",
    ]
    if origin:
        lines.append(f"From        : {_title_case(origin)}")

    if transport_mode == "train" and train:
        lines += [
            "",
            f"Train       : {train.get('name') or '—'} (#{train.get('number') or '—'})",
            f"Route       : {train.get('from_station') or '—'} -> {train.get('to_station') or '—'}",
        ]
    elif flight:
        lines += [
            "",
            f"Flight      : {flight.get('airline') or '—'}",
            f"Route       : {flight.get('from') or '—'} -> {flight.get('to') or '—'}",
            f"Price       : {flight.get('price') or '—'}",
        ]

    lines += [
        "",
        f"Hotel       : {hotel.get('name') or '—'}",
        f"Room        : {room.get('label') or '—'}  x{booking.get('num_rooms', 1)} room(s) x{booking.get('num_nights', 1)} night(s)",
        f"Travelers   : {travelers.get('numTravelers', 1)}  (Contact: {travelers.get('fullName') or '—'})",
        "",
        f"Total Paid  : {pricing.get('grandTotal') or '—'}",
        "",
        "Note: Demo Payment — no real money was charged.",
        "",
        f"View booking: {booking_url}",
    ]

    if tips:
        lines += ["", "Before you travel:"]
        for tip in tips[:3]:
            lines.append(f"  • {tip}")

    lines += [
        "",
        f"Verify all train/flight details with IRCTC or the airline before travel.",
        "",
        f"Questions? Reply to this email or write to {_cfg()['support']}",
        "",
        "— Chalo Ghumne  (demo project, no real money charged)",
    ]
    return "\n".join(lines)


def _build_html(booking: Dict, user: Dict) -> str:
    dest     = booking.get("destination") or {}
    flight   = booking.get("flight") or {}
    train    = booking.get("train") or {}
    hotel    = booking.get("hotel") or {}
    room     = booking.get("room") or {}
    pricing  = booking.get("pricing") or {}
    travelers = booking.get("travelers") or {}
    tips     = (booking.get("itinerary_snapshot") or {}).get("tips") or []
    bid      = _e(booking.get("booking_id"))
    txn      = _e(booking.get("transaction_id"))
    dest_name = _e(dest.get("name"), "your destination")
    origin    = booking.get("origin") or ""
    num_days  = booking.get("duration_days") or 0
    transport_mode = (booking.get("transport_mode") or "flight").lower()

    booking_url = html.escape(_cfg()["frontend_url"] + BOOKING_ROUTE.format(booking_id=booking.get("booking_id", "")))

    # transport row
    if transport_mode == "train" and train:
        transport_row = f"""
        <tr><td style="color:#64748b;padding:4px 8px">Train</td>
            <td style="padding:4px 8px">{_e(train.get('name'))} #{_e(train.get('number'))}</td></tr>
        <tr><td style="color:#64748b;padding:4px 8px">Route</td>
            <td style="padding:4px 8px">{_e(train.get('from_station'))} &rarr; {_e(train.get('to_station'))}</td></tr>
        """
        verify_note = "Verify train details and book tickets at <a href='https://www.irctc.co.in' style='color:#0D5C75'>irctc.co.in</a>."
    else:
        transport_row = f"""
        <tr><td style="color:#64748b;padding:4px 8px">Flight</td>
            <td style="padding:4px 8px">{_e(flight.get('airline'))}</td></tr>
        <tr><td style="color:#64748b;padding:4px 8px">Route</td>
            <td style="padding:4px 8px">{_e(flight.get('from'))} &rarr; {_e(flight.get('to'))} &bull; {_e(flight.get('price'))}</td></tr>
        """
        verify_note = "Verify flight details with the airline before travel."

    origin_row = f"<tr><td style='color:#64748b;padding:4px 8px'>From</td><td style='padding:4px 8px'>{_e(_title_case(origin))}</td></tr>" if origin else ""

    tips_section = ""
    if tips:
        tip_items = "".join(f"<li style='margin:4px 0'>{_e(t)}</li>" for t in tips[:3])
        tips_section = f"""
        <h3 style="color:#1A2530;margin:24px 0 8px;font-size:15px">Before you travel</h3>
        <ul style="margin:0;padding-left:20px;color:#1A2530;font-size:14px">{tip_items}</ul>
        """

    # passengers list
    passengers = travelers.get("passengers") or []
    pax_rows = ""
    for i, p in enumerate(passengers, 1):
        pname = _e(p.get("name"), f"Passenger {i}")
        pdob  = _e(p.get("dob"), "")
        pgend = _e(p.get("gender"), "")
        detail = pname
        if pdob and pdob != "—":
            detail += f", DOB: {pdob}"
        if pgend and pgend != "—":
            detail += f", {pgend.capitalize()}"
        pax_rows += f"<li style='margin:2px 0;font-size:13px'>{detail}</li>"

    travelers_detail = f"<ul style='margin:4px 0;padding-left:20px'>{pax_rows}</ul>" if pax_rows else ""

    return f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Booking Confirmed — Chalo Ghumne</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 0">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">

        <!-- Header -->
        <tr><td style="background:#0D5C75;padding:28px 32px;border-radius:12px 12px 0 0">
          <h1 style="margin:0;color:#fff;font-size:24px;font-weight:700;letter-spacing:-0.5px">Chalo Ghumne</h1>
          <p style="margin:4px 0 0;color:rgba(255,255,255,0.75);font-size:13px">Booking Confirmation</p>
        </td></tr>

        <!-- Body -->
        <tr><td style="background:#ffffff;padding:32px">

          <!-- Hero message -->
          <div style="text-align:center;margin-bottom:28px">
            <div style="width:56px;height:56px;background:#0D5C75;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px">
              <span style="color:#fff;font-size:28px">✓</span>
            </div>
            <h2 style="margin:0;color:#1A2530;font-size:22px;font-weight:700">Your trip is confirmed!</h2>
            <p style="margin:8px 0 0;color:#64748b;font-size:15px">
              Thank you for booking with Chalo Ghumne!<br>Your trip to <strong>{dest_name}</strong> is confirmed.
            </p>
          </div>

          <!-- Booking IDs -->
          <table width="100%" cellpadding="0" cellspacing="0"
                 style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:24px">
            <tr><td style="padding:16px 20px">
              <p style="margin:0 0 4px;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:.06em">Booking ID</p>
              <p style="margin:0;font-family:monospace;font-size:16px;font-weight:700;color:#0D5C75">{bid}</p>
            </td></tr>
            <tr><td style="padding:0 20px 16px">
              <p style="margin:0 0 4px;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:.06em">Transaction ID</p>
              <p style="margin:0;font-family:monospace;font-size:13px;color:#1A2530">{txn}</p>
            </td></tr>
            <tr><td style="padding:0 20px 16px">
              <span style="display:inline-block;background:#E76F51;color:#fff;font-size:11px;font-weight:700;
                           padding:3px 10px;border-radius:20px;letter-spacing:.04em">DEMO PAYMENT SUCCESSFUL</span>
            </td></tr>
          </table>

          <!-- Trip summary card -->
          <h3 style="margin:0 0 12px;color:#1A2530;font-size:15px;font-weight:700">Trip Summary</h3>
          <table width="100%" cellpadding="0" cellspacing="4"
                 style="background:#fdfbf7;border:1px solid #e2e8f0;border-radius:8px;padding:8px;margin-bottom:24px;font-size:14px">
            <tr><td style="color:#64748b;padding:4px 8px">Destination</td>
                <td style="padding:4px 8px;font-weight:600">{dest_name}, {_e(dest.get('country'))}</td></tr>
            <tr><td style="color:#64748b;padding:4px 8px">Duration</td>
                <td style="padding:4px 8px">{num_days} days</td></tr>
            {origin_row}
            {transport_row}
            <tr><td style="color:#64748b;padding:4px 8px">Hotel</td>
                <td style="padding:4px 8px">{_e(hotel.get('name'))}</td></tr>
            <tr><td style="color:#64748b;padding:4px 8px">Room</td>
                <td style="padding:4px 8px">{_e(room.get('label'))} &bull; {booking.get('num_rooms',1)} room(s) &times; {booking.get('num_nights',1)} night(s)</td></tr>
            <tr><td style="color:#64748b;padding:4px 8px">Travelers</td>
                <td style="padding:4px 8px">{_e(travelers.get('fullName'))} &bull; {travelers.get('numTravelers',1)} traveler(s)</td></tr>
            <tr><td style="color:#64748b;padding:4px 8px;border-top:1px solid #e2e8f0;padding-top:8px;font-weight:600">Total Paid</td>
                <td style="padding:4px 8px;border-top:1px solid #e2e8f0;padding-top:8px;font-weight:700;color:#0D5C75;font-size:16px">{_e(pricing.get('grandTotal'))}</td></tr>
          </table>

          <!-- Passengers -->
          {f'<h3 style="margin:0 0 8px;color:#1A2530;font-size:14px;font-weight:700">Passengers</h3>{travelers_detail}' if travelers_detail else ''}

          <!-- Tips -->
          {tips_section}

          <!-- Verify note -->
          <p style="margin:20px 0 0;font-size:12px;color:#64748b;border-left:3px solid #E76F51;padding-left:10px">
            {verify_note}
          </p>

          <!-- CTA button -->
          <div style="text-align:center;margin:28px 0">
            <a href="{booking_url}"
               style="display:inline-block;background:#0D5C75;color:#fff;font-size:15px;font-weight:600;
                      padding:14px 32px;border-radius:40px;text-decoration:none">
              View my booking &rarr;
            </a>
          </div>

          <!-- Demo note -->
          <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:14px 16px;
                      font-size:12px;color:#92400e;margin-top:8px">
            <strong>Demo Payment</strong> — No real money was charged.
            This is a simulated booking for demonstration purposes only.
          </div>
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#f8fafc;padding:20px 32px;border-top:1px solid #e2e8f0;
                       border-radius:0 0 12px 12px;text-align:center">
          <p style="margin:0 0 8px;font-size:13px;color:#1A2530">
            Questions? Reply to this email or write to
            <a href="mailto:{html.escape(_cfg()['support'])}?subject=Booking%20{bid}" style="color:#0D5C75">{html.escape(_cfg()['support'])}</a>
          </p>
          <p style="margin:0;font-size:11px;color:#94a3b8">
            &copy; 2026 Chalo Ghumne &mdash; Demo project. No real money charged.
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>"""


# ── SMTP send (blocking, runs in thread) ─────────────────────────────────────

def _send_sync(msg: EmailMessage, attempt: int = 1) -> bool:
    """
    Attempt to send via Gmail SMTP.
    Returns True on success. Raises on auth failure. Returns False on transient error
    after one retry.
    """
    cfg = _cfg()
    ctx = ssl.create_default_context()
    try:
        with smtplib.SMTP(cfg["host"], cfg["port"], timeout=20) as server:
            server.ehlo()
            server.starttls(context=ctx)
            server.ehlo()
            server.login(cfg["user"], cfg["pw"])
            server.send_message(msg)
            return True
    except smtplib.SMTPAuthenticationError as exc:
        logger.error(
            "Gmail SMTP login failed. Check SMTP_USER (%s) and SMTP_APP_PASSWORD. Error: %s",
            _mask_email(cfg["user"]), exc.smtp_error
        )
        raise   # do NOT retry on auth error
    except (smtplib.SMTPException, OSError, TimeoutError) as exc:
        if attempt < 2:
            logger.warning("SMTP transient error (attempt %d/2): %s — retrying in %ds", attempt, exc, RETRY_DELAY_S)
            time.sleep(RETRY_DELAY_S)
            return _send_sync(msg, attempt + 1)
        logger.error("SMTP failed after 2 attempts: %s", exc)
        return False


# ── Main async entry point ────────────────────────────────────────────────────

async def send_booking_email(booking: Dict[str, Any], user: Dict[str, Any]) -> bool:
    """
    Build both PDFs, compose the email, and send via Gmail SMTP.
    Returns True if sent, False if failed/skipped.
    The booking dict should already have 'account_email' set to the VERIFIED user email.
    """
    account_email = user.get("email", "").strip().lower()

    cfg = _cfg()

    # ── Credential check ─────────────────────────────────────────────
    if not cfg["user"] or not cfg["pw"]:
        logger.warning("SMTP credentials missing — email skipped for booking %s", booking.get("booking_id"))
        return False   # caller sets email_status = "skipped"

    if not account_email:
        logger.warning("No account email for user %s — email skipped", user.get("id"))
        return False

    bid      = booking.get("booking_id", "unknown")
    dest     = (booking.get("destination") or {}).get("name") or "your destination"

    # ── Build PDFs ───────────────────────────────────────────────────
    try:
        conf_pdf = build_confirmation_pdf(booking, user)
        itin_pdf = build_itinerary_pdf(booking)
    except Exception as exc:
        logger.error("PDF generation failed for booking %s: %s", bid, exc)
        conf_pdf = b""
        itin_pdf = b""

    # ── Compose email ────────────────────────────────────────────────
    msg = EmailMessage()
    msg["From"]     = f"{cfg['from_name']} <{cfg['user']}>"
    msg["To"]       = account_email    # ALWAYS the account email
    msg["Reply-To"] = cfg["support"]
    msg["Subject"]  = f"Your Chalo Ghumne booking to {dest} is confirmed ({bid})"

    msg.set_content(_build_plain(booking, user))
    msg.add_alternative(_build_html(booking, user), subtype="html")

    if conf_pdf:
        msg.add_attachment(conf_pdf, maintype="application", subtype="pdf",
                           filename=f"ChaloGhumne-Confirmation-{bid}.pdf")
    if itin_pdf:
        msg.add_attachment(itin_pdf, maintype="application", subtype="pdf",
                           filename=f"ChaloGhumne-Itinerary-{bid}.pdf")

    total_size = len(bytes(msg))
    if total_size > MAX_MSG_BYTES:
        logger.warning("Email for booking %s is %.1f MB (>20 MB threshold)", bid, total_size / 1_048_576)

    # ── Send in thread so event loop is not blocked ──────────────────
    try:
        result = await asyncio.to_thread(_send_sync, msg)
        if result:
            logger.info("Booking email sent to %s for booking %s", _mask_email(account_email), bid)
        return result
    except smtplib.SMTPAuthenticationError:
        return False   # already logged in _send_sync
    except Exception as exc:
        logger.error("Unexpected error sending email for booking %s: %s", bid, exc)
        return False

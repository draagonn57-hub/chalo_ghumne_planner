"""
Test script: send a sample booking confirmation email.

Usage:
    python send_test_email.py you@example.com

Loads credentials from backend/.env. Never prints real secrets.
Prints only masked email addresses and success/failure status.
"""

import asyncio
import os
import sys
from pathlib import Path

# Load .env from the same directory as this script
try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent / ".env")
except ImportError:
    pass   # fall through; env vars must already be set

from email_service import send_booking_email, _mask_email, _cfg, SUPPORT_EMAIL

SAMPLE_BOOKING = {
    "booking_id": "CG-2026-TESTXX",
    "transaction_id": "TXN-DEMO-999999",
    "booking_status": "confirmed",
    "payment_status": "demo_paid",
    "duration_days": 5,
    "origin": "mumbai",
    "transport_mode": "flight",
    "destination": {"name": "Jaipur", "country": "India"},
    "flight": {
        "airline": "IndiGo",
        "from": "Mumbai (BOM)",
        "to": "Jaipur (JAI)",
        "duration": "1h 45m",
        "stops": "Non-stop",
        "price": "₹4,500",
        "estimated": True,
    },
    "hotel": {
        "name": "The Raj Palace",
        "location": "Jaipur, Rajasthan",
        "rating": 4.5,
        "price_per_night": "₹6,200",
    },
    "room": {"label": "Deluxe Room"},
    "num_rooms": 1,
    "num_nights": 4,
    "travelers": {
        "fullName": "Ravi Kumar",
        "numTravelers": 2,
        "passengers": [
            {"name": "Ravi Kumar", "dob": "1990-05-15", "gender": "male"},
            {"name": "Priya Kumar", "dob": "1993-08-20", "gender": "female"},
        ],
    },
    "pricing": {
        "subtotal": 45000,
        "taxes": 5400,
        "discount": 2250,
        "grandTotal": 48150,
    },
    "addons": [{"id": "travel_insurance", "name": "Travel Insurance", "price": 1200}],
    "itinerary_snapshot": {
        "title": "Royal Rajasthan — Jaipur",
        "summary": "5 days exploring the Pink City's forts, palaces, and bazaars.",
        "destinations": [{"name": "Jaipur", "country": "India", "why": "The Pink City of India"}],
        "days": [
            {
                "day": 1, "title": "Arrival & Amber Fort", "location": "Jaipur",
                "morning": {"activity": "Arrive at Jaipur, check into hotel", "landmark": "Jaipur Airport"},
                "afternoon": {"activity": "Visit Amber Fort", "landmark": "Amber Fort"},
                "evening": {"activity": "Dinner at local dhaba", "landmark": ""},
                "food": {"breakfast": "Hotel breakfast", "lunch": "Dal Baati Churma", "dinner": "Rajasthani thali"},
            },
        ],
        "tips": [
            "Carry a light shawl for evenings — it can get cool.",
            "Bargain at bazaars, but do it with a smile.",
            "Book Amber Fort tickets online to skip queues.",
        ],
    },
    "email_status": "pending",
    "email_attempts": 0,
}


async def main():
    if len(sys.argv) < 2:
        print("Usage: python send_test_email.py <recipient@example.com>")
        sys.exit(1)

    recipient = sys.argv[1].strip()
    if "@" not in recipient:
        print("Error: provide a valid email address.")
        sys.exit(1)

    cfg = _cfg()

    print(f"\nChalo Ghumne — Test Email Sender")
    print(f"{'─' * 42}")
    print(f"SMTP sender  : {_mask_email(cfg['user']) if cfg['user'] else '(not set)'}")
    print(f"Support email: {SUPPORT_EMAIL}")
    print(f"Recipient    : {_mask_email(recipient)}")
    print(f"{'─' * 42}")

    if not cfg["user"] or not cfg["pw"]:
        print("\n❌  SMTP credentials missing — SMTP_USER or SMTP_APP_PASSWORD not configured in .env")
        print("    Add them to backend/.env and try again.")
        sys.exit(1)

    # Use recipient as account email
    test_user = {
        "id": "test-user-id",
        "name": "Test User",
        "email": recipient,
    }

    print("\nGenerating PDFs and sending email…")
    try:
        success = await send_booking_email(SAMPLE_BOOKING, test_user)
        if success:
            print(f"\n✅  Email sent successfully to {_mask_email(recipient)}")
            print("    Check the inbox (and spam folder).")
        else:
            print(f"\n❌  Email sending failed. Check SMTP credentials and logs.")
    except Exception as exc:
        print(f"\n❌  Unexpected error: {exc}")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())

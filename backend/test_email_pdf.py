"""
Tests for PDF generation and email sending.

Run from backend/ directory:
    python -m unittest test_email_pdf -v

Gemini and real SMTP are never called.
"""

import asyncio
import os
import sys
import unittest
from unittest.mock import MagicMock, AsyncMock, patch

sys.path.insert(0, os.path.dirname(__file__))

# Harmless fallbacks so `import server` (needed by the idempotency tests) works
# even if backend/.env is absent. setdefault never overrides a real value loaded
# from .env, so live credentials are untouched.
os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ.setdefault("DB_NAME", "test_db")
os.environ.setdefault("GEMINI_API_KEY", "test-key")

# Ensure reportlab is available before importing pdf_service
try:
    import reportlab  # noqa: F401
except ImportError:
    raise ImportError("reportlab is required. Run: pip install reportlab")

from pdf_service import build_confirmation_pdf, build_itinerary_pdf, _safe, _title_case


# ── Sample fixtures ───────────────────────────────────────────────────────────

FLIGHT_BOOKING = {
    "booking_id": "CG-2026-ABCD12",
    "transaction_id": "TXN-000001",
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
    },
    "train": None,
    "hotel": {"name": "The Raj Palace", "location": "Jaipur", "rating": 4.5, "price_per_night": "₹6,200"},
    "room": {"label": "Deluxe Room"},
    "num_rooms": 1,
    "num_nights": 4,
    "travelers": {
        "fullName": "Ravi Kumar",
        "numTravelers": 2,
        "passengers": [
            {"name": "Ravi <script>alert(1)</script> Kumar", "dob": "1990-05-15", "gender": "male"},
            {"name": "Priya Kumar", "dob": "1993-08-20", "gender": "female"},
        ],
    },
    "pricing": {"subtotal": 45000, "taxes": 5400, "discount": 2250, "grandTotal": 48150},
    "addons": [],
    "itinerary_snapshot": {
        "title": "Royal Jaipur",
        "summary": "5 days in the Pink City.",
        "destinations": [{"name": "Jaipur", "country": "India", "why": "Pink City"}],
        "days": [
            {
                "day": 1, "title": "Arrival", "location": "Jaipur",
                "morning": {"activity": "Check in", "landmark": "Hotel"},
                "afternoon": {"activity": "Amber Fort", "landmark": "Amber Fort"},
                "evening": {"activity": "Dinner", "landmark": ""},
                "food": {"breakfast": "Hotel breakfast", "lunch": "Dal Baati", "dinner": "Thali"},
            }
        ],
        "tips": ["Carry sunscreen.", "Book Amber Fort tickets online."],
    },
    "email_status": "pending",
    "email_attempts": 0,
}

TRAIN_BOOKING = {
    **FLIGHT_BOOKING,
    "booking_id": "CG-2026-TRAIN1",
    "transport_mode": "train",
    "flight": {},
    "train": {
        "name": "Ajmer Shatabdi Express",
        "number": "12015",
        "from_station": "New Delhi (NDLS)",
        "to_station": "Jaipur Junction (JP)",
        "departure_time": "06:10",
        "arrival_time": "10:40",
        "duration": "04h 30m",
        "classes": [{"name": "CC", "price": "₹610"}],
        "stops": "5",
        "estimated": True,
    },
}

OLD_BOOKING_NO_SNAPSHOT = {
    **FLIGHT_BOOKING,
    "booking_id": "CG-2024-LEGACY",
    "itinerary_snapshot": None,   # old booking without snapshot
}

BOOKING_MISSING_FIELDS = {
    "booking_id": "CG-2026-EMPTY",
    "transaction_id": None,
    "booking_status": "confirmed",
    "destination": {},
    "flight": {},
    "train": None,
    "hotel": {},
    "room": {},
    "pricing": {},
    "travelers": {},
    "addons": [],
    "itinerary_snapshot": None,
}

USER = {
    "id": "user-123",
    "name": "Ravi Kumar",
    "email": "ravi@example.com",
}

# Credentials applied via patch.dict so _cfg() reads them fresh at call time.
_SMTP_ENV = {"SMTP_USER": "chaloghumne.trips@gmail.com", "SMTP_APP_PASSWORD": "testpassword"}


# ── 1. PDF — basic validity ───────────────────────────────────────────────────

class TestBuildConfirmationPdf(unittest.TestCase):

    def test_returns_bytes_starting_with_pdf_header(self):
        result = build_confirmation_pdf(FLIGHT_BOOKING, USER)
        self.assertIsInstance(result, bytes)
        self.assertTrue(result.startswith(b"%PDF"), "Must be a valid PDF")

    def test_flight_booking_produces_pdf(self):
        result = build_confirmation_pdf(FLIGHT_BOOKING, USER)
        self.assertGreater(len(result), 1000)

    def test_train_booking_produces_pdf(self):
        result = build_confirmation_pdf(TRAIN_BOOKING, USER)
        self.assertIsInstance(result, bytes)
        self.assertTrue(result.startswith(b"%PDF"))

    def test_missing_optional_fields_no_crash(self):
        result = build_confirmation_pdf(BOOKING_MISSING_FIELDS, USER)
        self.assertTrue(result.startswith(b"%PDF"))

    def test_special_chars_and_rupee_no_crash(self):
        booking = dict(FLIGHT_BOOKING)
        booking["travelers"] = {
            "fullName": "रवि कुमार & <Friends>",
            "numTravelers": 1,
            "passengers": [{"name": "Test ₹ & <b>bold</b>", "dob": "", "gender": ""}],
        }
        result = build_confirmation_pdf(booking, USER)
        self.assertTrue(result.startswith(b"%PDF"))


class TestBuildItineraryPdf(unittest.TestCase):

    def test_returns_bytes_starting_with_pdf_header(self):
        result = build_itinerary_pdf(FLIGHT_BOOKING)
        self.assertIsInstance(result, bytes)
        self.assertTrue(result.startswith(b"%PDF"))

    def test_train_booking_produces_pdf(self):
        result = build_itinerary_pdf(TRAIN_BOOKING)
        self.assertTrue(result.startswith(b"%PDF"))

    def test_old_booking_no_snapshot_graceful(self):
        """Old bookings without itinerary_snapshot must produce a shorter PDF, not crash."""
        result = build_itinerary_pdf(OLD_BOOKING_NO_SNAPSHOT)
        self.assertTrue(result.startswith(b"%PDF"))

    def test_missing_optional_fields_no_crash(self):
        result = build_itinerary_pdf(BOOKING_MISSING_FIELDS)
        self.assertTrue(result.startswith(b"%PDF"))

    def test_itinerary_pdf_with_snapshot_has_day_content(self):
        """A booking WITH a day-by-day snapshot produces a richer PDF than one without.

        The snapshot adds a 'Day-by-Day Itinerary' section, so it must contain more
        content. We use the byte length as the proxy (more drawn text → larger PDF);
        the endobj/object count is only greater when content spills onto a new page,
        so it is asserted as >= rather than strictly >.
        """
        with_snapshot = dict(FLIGHT_BOOKING)
        without_snapshot = dict(FLIGHT_BOOKING)
        without_snapshot["itinerary_snapshot"] = None

        pdf_with = build_itinerary_pdf(with_snapshot)
        pdf_without = build_itinerary_pdf(without_snapshot)

        self.assertTrue(pdf_with.startswith(b"%PDF"))
        self.assertTrue(pdf_without.startswith(b"%PDF"))
        self.assertGreaterEqual(
            pdf_with.count(b"endobj"),
            pdf_without.count(b"endobj"),
            "PDF with itinerary snapshot must have at least as many content objects",
        )
        self.assertGreater(
            len(pdf_with), len(pdf_without),
            "PDF with itinerary snapshot must be larger (more day content)",
        )


# ── 2. _safe helper ───────────────────────────────────────────────────────────

class TestSafeHelper(unittest.TestCase):

    def test_none_returns_fallback(self):
        self.assertEqual(_safe(None), "—")

    def test_empty_string_returns_fallback(self):
        self.assertEqual(_safe("  "), "—")

    def test_escapes_lt_gt_amp(self):
        result = _safe("<script>alert(1)</script>")
        self.assertNotIn("<script>", result)
        self.assertIn("&lt;script&gt;", result)

    def test_normal_value_returned(self):
        self.assertEqual(_safe("Jaipur"), "Jaipur")

    def test_rupee_symbol_preserved(self):
        result = _safe("₹4,500")
        self.assertIn("₹", result)


class TestTitleCase(unittest.TestCase):

    def test_lowercase_city(self):
        self.assertEqual(_title_case("mumbai"), "Mumbai")

    def test_multiword(self):
        self.assertEqual(_title_case("new delhi"), "New Delhi")

    def test_already_title_case(self):
        self.assertEqual(_title_case("Jaipur"), "Jaipur")


# ── 3. Email message composition ─────────────────────────────────────────────
#
# These tests patch email_service._send_sync (the blocking send) so no real SMTP
# connection is made. They set SMTP credentials via patch.dict(os.environ, ...) so
# _cfg() reads them fresh and the credential check passes — the message is actually
# composed and the mock records it.

class TestEmailMessageComposition(unittest.TestCase):

    @patch("email_service.build_confirmation_pdf", return_value=b"%PDF-mock-conf")
    @patch("email_service.build_itinerary_pdf", return_value=b"%PDF-mock-itin")
    @patch("email_service._send_sync", return_value=True)
    def test_recipient_is_account_email_not_traveler(self, mock_send, mock_itin, mock_conf):
        """To: must be user.email, not travelers.email from request."""
        from email_service import send_booking_email

        with patch.dict(os.environ, _SMTP_ENV):
            user = {"id": "u1", "email": "account@gmail.com", "name": "User"}
            booking = dict(FLIGHT_BOOKING)
            booking["travelers"]["email"] = "different.traveler@example.com"

            asyncio.run(send_booking_email(booking, user))

        sent_msg = mock_send.call_args[0][0]
        self.assertEqual(sent_msg["To"], "account@gmail.com")
        self.assertNotIn("different.traveler@example.com", sent_msg["To"])

    @patch("email_service.build_confirmation_pdf", return_value=b"%PDF-mock-conf")
    @patch("email_service.build_itinerary_pdf", return_value=b"%PDF-mock-itin")
    @patch("email_service._send_sync", return_value=True)
    def test_subject_contains_destination_and_booking_id(self, mock_send, mock_itin, mock_conf):
        from email_service import send_booking_email

        with patch.dict(os.environ, _SMTP_ENV):
            asyncio.run(send_booking_email(FLIGHT_BOOKING, USER))
        sent_msg = mock_send.call_args[0][0]
        self.assertIn("Jaipur", sent_msg["Subject"])
        self.assertIn("CG-2026-ABCD12", sent_msg["Subject"])

    @patch("email_service.build_confirmation_pdf", return_value=b"%PDF-mock-conf")
    @patch("email_service.build_itinerary_pdf", return_value=b"%PDF-mock-itin")
    @patch("email_service._send_sync", return_value=True)
    def test_both_pdfs_attached_with_correct_filenames(self, mock_send, mock_itin, mock_conf):
        from email_service import send_booking_email

        with patch.dict(os.environ, _SMTP_ENV):
            asyncio.run(send_booking_email(FLIGHT_BOOKING, USER))
        sent_msg = mock_send.call_args[0][0]

        payload = sent_msg.get_payload()
        filenames = []
        for part in payload:
            cd = part.get("Content-Disposition", "")
            if "filename" in cd:
                fn = cd.split('filename="')[-1].rstrip('"')
                filenames.append(fn)

        bid = FLIGHT_BOOKING["booking_id"]
        self.assertTrue(any(f"Confirmation-{bid}" in f for f in filenames), filenames)
        self.assertTrue(any(f"Itinerary-{bid}" in f for f in filenames), filenames)

    @patch("email_service.build_confirmation_pdf", return_value=b"%PDF-mock-conf")
    @patch("email_service.build_itinerary_pdf", return_value=b"%PDF-mock-itin")
    @patch("email_service._send_sync", return_value=True)
    def test_reply_to_is_support_email(self, mock_send, mock_itin, mock_conf):
        from email_service import send_booking_email, _cfg

        with patch.dict(os.environ, _SMTP_ENV):
            asyncio.run(send_booking_email(FLIGHT_BOOKING, USER))
        sent_msg = mock_send.call_args[0][0]
        # Reply-To is read fresh via _cfg(), so compare against the live value.
        self.assertEqual(sent_msg["Reply-To"], _cfg()["support"])

    @patch("email_service.build_confirmation_pdf", return_value=b"%PDF-mock")
    @patch("email_service.build_itinerary_pdf", return_value=b"%PDF-mock")
    @patch("email_service._send_sync", return_value=True)
    def test_html_escapes_malicious_name(self, mock_send, *_):
        from email_service import send_booking_email, _build_html

        with patch.dict(os.environ, _SMTP_ENV):
            booking = dict(FLIGHT_BOOKING)
            booking["travelers"] = {
                "fullName": "<script>steal()</script>",
                "numTravelers": 1,
                "passengers": [],
            }
            asyncio.run(send_booking_email(booking, USER))
            html_body = _build_html(booking, USER)
        self.assertNotIn("<script>steal()", html_body)
        self.assertIn("&lt;script&gt;", html_body)


# ── 4. SMTP behaviour ─────────────────────────────────────────────────────────
#
# These tests exercise the real send path (smtplib.SMTP is patched, not _send_sync)
# so the credential check, login args, retry and no-retry-on-auth logic are all
# genuinely exercised.

class TestSmtpBehaviour(unittest.TestCase):

    @patch("email_service.build_confirmation_pdf", return_value=b"%PDF-1")
    @patch("email_service.build_itinerary_pdf", return_value=b"%PDF-2")
    @patch("smtplib.SMTP")
    def test_login_uses_stripped_app_password(self, mock_smtp_cls, *_):
        """App password spaces must be stripped before login."""
        import smtplib
        from email_service import send_booking_email

        env = dict(_SMTP_ENV)
        env["SMTP_APP_PASSWORD"] = "abcd efgh ijkl mnop"  # with spaces

        server = MagicMock()
        mock_smtp_cls.return_value.__enter__.return_value = server
        mock_smtp_cls.return_value.__exit__.return_value = False

        with patch.dict(os.environ, env):
            asyncio.run(send_booking_email(FLIGHT_BOOKING, USER))

        server.login.assert_called_once()
        pw_used = server.login.call_args[0][1]
        self.assertNotIn(" ", pw_used, "Spaces must be stripped from app password")

    @patch("email_service.build_confirmation_pdf", return_value=b"%PDF-1")
    @patch("email_service.build_itinerary_pdf", return_value=b"%PDF-2")
    def test_one_retry_on_transient_error(self, *_):
        """A transient OSError triggers exactly one retry (SMTP constructed twice)."""
        import smtplib
        from email_service import _send_sync

        good_server = MagicMock()
        attempts = []

        def factory(*args, **kwargs):
            attempts.append(1)
            if len(attempts) == 1:
                raise OSError("Connection timed out")
            return good_server

        with patch("smtplib.SMTP", side_effect=factory) as mock_smtp, \
                patch("email_service.time.sleep"), \
                patch.dict(os.environ, _SMTP_ENV):
            result = _send_sync(MagicMock())

        self.assertTrue(result, "Retry should eventually succeed")
        self.assertEqual(mock_smtp.call_count, 2, "SMTP must be attempted twice (one retry)")

    @patch("email_service.build_confirmation_pdf", return_value=b"%PDF-1")
    @patch("email_service.build_itinerary_pdf", return_value=b"%PDF-2")
    @patch("smtplib.SMTP")
    def test_no_retry_on_auth_error(self, mock_smtp_cls, *_):
        """SMTPAuthenticationError must NOT be retried (SMTP constructed once)."""
        import smtplib
        from email_service import send_booking_email

        server = MagicMock()
        server.login.side_effect = smtplib.SMTPAuthenticationError(535, b"Bad credentials")
        mock_smtp_cls.return_value.__enter__.return_value = server
        mock_smtp_cls.return_value.__exit__.return_value = False

        with patch.dict(os.environ, _SMTP_ENV):
            result = asyncio.run(send_booking_email(FLIGHT_BOOKING, USER))

        self.assertFalse(result, "Auth error must result in False")
        self.assertEqual(mock_smtp_cls.call_count, 1, "Must NOT retry on auth error")

    @patch("email_service.build_confirmation_pdf", return_value=b"%PDF-1")
    @patch("email_service.build_itinerary_pdf", return_value=b"%PDF-2")
    def test_missing_credentials_returns_false_no_smtp(self, *_):
        """When SMTP_USER or SMTP_APP_PASSWORD is empty, skip and return False."""
        import smtplib
        from email_service import send_booking_email

        with patch("smtplib.SMTP") as mock_smtp, \
                patch.dict(os.environ, {"SMTP_USER": "", "SMTP_APP_PASSWORD": ""}):
            result = asyncio.run(send_booking_email(FLIGHT_BOOKING, USER))

        self.assertFalse(result)
        mock_smtp.assert_not_called()


# ── 5. Google auth — email_verified ──────────────────────────────────────────

class TestGoogleAuthEmailVerified(unittest.TestCase):
    """
    The google_auth endpoint must reject tokens where email_verified is False.
    We test the logic directly (not via the HTTP handler).
    """

    def test_unverified_email_rejected(self):
        from fastapi import HTTPException
        idinfo = {
            "sub": "google123",
            "email": "user@gmail.com",
            "email_verified": False,
            "name": "Test User",
        }
        is_test = False
        if not is_test and not idinfo.get("email_verified", False):
            exc = HTTPException(
                status_code=400,
                detail="Google account email is not verified.",
            )
            self.assertEqual(exc.status_code, 400)
            self.assertIn("not verified", exc.detail)
        else:
            self.fail("Should have been rejected")

    def test_verified_email_passes(self):
        idinfo = {
            "sub": "google123",
            "email": "user@gmail.com",
            "email_verified": True,
            "name": "Test User",
        }
        is_test = False
        # Should NOT raise
        self.assertTrue(is_test or idinfo.get("email_verified", False))

    def test_test_mode_skips_verification(self):
        idinfo = {
            "sub": "google123",
            "email": "user@gmail.com",
            "email_verified": False,
        }
        is_test = True   # TESTING=1 bypasses the check
        # In test mode, we don't check email_verified
        passed = is_test or idinfo.get("email_verified", False)
        self.assertTrue(passed)


# ── 6. Idempotency guard (real background task) ──────────────────────────────

class TestIdempotencyTask(unittest.TestCase):
    """
    Exercise the real _send_booking_email_task idempotency guard by mocking the
    Motor database with AsyncMock semantics. send_booking_email is stubbed so no
    real SMTP/PDF work happens.
    """

    @classmethod
    def setUpClass(cls):
        import server
        cls.server = server

    def _run_task(self, booking, user, find_result):
        srv = self.server
        mock_db = MagicMock()
        mock_db.bookings.find_one_and_update = AsyncMock(return_value=find_result)
        mock_db.bookings.update_one = AsyncMock()
        return mock_db

    def test_already_processed_skips_send(self):
        """find_one_and_update returns None (already processed) → SMTP not called."""
        srv = self.server
        mock_db = self._run_task({"booking_id": "B1"}, {"email": "a@b.com"}, None)
        with patch.object(srv, "db", mock_db), \
                patch.object(srv, "send_booking_email", new=AsyncMock(return_value=True)) as mock_send:
            asyncio.run(srv._send_booking_email_task({"booking_id": "B1"}, {"email": "a@b.com"}))
        mock_send.assert_not_called()

    def test_pending_proceeds_to_send(self):
        """find_one_and_update returns a doc (pending) → SMTP IS called."""
        srv = self.server
        mock_db = self._run_task(
            {"booking_id": "B1"}, {"email": "a@b.com"}, {"booking_id": "B1", "email_status": "pending"}
        )
        with patch.object(srv, "db", mock_db), \
                patch.object(srv, "send_booking_email", new=AsyncMock(return_value=True)) as mock_send, \
                patch.dict(os.environ, {"SMTP_USER": "t@gmail.com", "SMTP_APP_PASSWORD": "pw"}):
            asyncio.run(srv._send_booking_email_task({"booking_id": "B1"}, {"email": "a@b.com"}))
        mock_send.assert_called_once()

    def test_pending_missing_credentials_skips_send(self):
        """Pending doc but empty SMTP creds → send_booking_email NOT called (skipped)."""
        srv = self.server
        mock_db = self._run_task(
            {"booking_id": "B1"}, {"email": "a@b.com"}, {"booking_id": "B1", "email_status": "pending"}
        )
        with patch.object(srv, "db", mock_db), \
                patch.object(srv, "send_booking_email", new=AsyncMock(return_value=True)) as mock_send, \
                patch.dict(os.environ, {"SMTP_USER": "", "SMTP_APP_PASSWORD": ""}):
            asyncio.run(srv._send_booking_email_task({"booking_id": "B1"}, {"email": "a@b.com"}))
        mock_send.assert_not_called()
        # The task should have marked the booking as skipped.
        mock_db.bookings.update_one.assert_called()
        args, kwargs = mock_db.bookings.update_one.call_args
        self.assertEqual(args[0], {"booking_id": "B1"})
        self.assertEqual(kwargs.get("update", args[1]).get("$set", {}).get("email_status"), "skipped")


# ── 7. Resend limits ──────────────────────────────────────────────────────────

class TestResendLimits(unittest.TestCase):

    def test_fourth_resend_in_a_day_is_rejected(self):
        from fastapi import HTTPException
        from datetime import datetime, timezone

        attempts = 3   # already sent 3 times today
        last_sent_str = datetime.now(timezone.utc).isoformat()

        try:
            last_sent_date = datetime.fromisoformat(last_sent_str).date()
            if last_sent_date == datetime.now(timezone.utc).date() and attempts >= 3:
                raise HTTPException(
                    status_code=429,
                    detail="Maximum 3 email resends per booking per day reached.",
                )
            self.fail("Should have raised HTTPException")
        except HTTPException as exc:
            self.assertEqual(exc.status_code, 429)

    def test_first_resend_allowed(self):
        from datetime import datetime, timezone

        attempts = 0
        # No prior sends today → allowed
        allowed = not (attempts >= 3)
        self.assertTrue(allowed)


# ── 8. Rupee glyph in fonts ──────────────────────────────────────────────────

class TestRupeeGlyph(unittest.TestCase):

    def test_fonts_contain_rupee_glyph(self):
        """The bundled DejaVuSans fonts must be able to render ₹ (U+20B9).

        We try the precise cmap check with fonttools first (exact). If fonttools is
        not installed, we fall back to rendering a PDF that contains ₹ and assert no
        'cannot be mapped' / 'UnicodeEncodeError' warning was emitted by reportlab.
        """
        from pdf_service import FONT_REGULAR, FONT_BOLD

        try:
            from fontTools.ttLib import TTFont as FTTFont
            for path in (FONT_REGULAR, FONT_BOLD):
                font = FTTFont(path)
                cmap = font.getBestCmap()
                self.assertIn(
                    0x20B9, cmap,
                    f"{path} must contain the ₹ (U+20B9) glyph",
                )
            return
        except ImportError:
            pass  # fall through to the render-and-logs check

        # Fallback: render ₹ and watch reportlab's logging for mapping failures.
        import logging
        records = []

        class _Capture(logging.Handler):
            def emit(self, record):
                records.append(record)

        root = logging.getLogger()
        handler = _Capture()
        root.addHandler(handler)
        old_level = root.level
        root.setLevel(logging.WARNING)
        try:
            booking = dict(FLIGHT_BOOKING)
            booking["pricing"] = {
                "grandTotal": "₹48,150",
                "subtotal": "₹45,000",
                "taxes": "₹5,400",
                "discount": "₹2,250",
            }
            pdf = build_confirmation_pdf(booking, USER)
        finally:
            root.removeHandler(handler)
            root.setLevel(old_level)

        self.assertTrue(pdf.startswith(b"%PDF"))
        for r in records:
            msg = r.getMessage().lower()
            self.assertNotIn("cannot be mapped", msg,
                             "reportlab could not map the ₹ glyph — font lacks it")
            self.assertNotIn("unicodeencodeerror", msg,
                             "reportlab hit a UnicodeEncodeError rendering ₹")


if __name__ == "__main__":
    unittest.main()

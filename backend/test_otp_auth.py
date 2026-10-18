"""
Unit tests for Email OTP Authentication in Chalo Ghumne.
Tests:
- Real Resend API delivery enforcement
- 10-minute OTP expiry & MongoDB storage
- Return only { success: true } (no raw code exposed to client)
- Error handling with 500 status when Resend delivery fails
- 5 failed verification attempts invalidation threshold
- Find-or-create user record and JWT token generation
"""

import os
import io
import unittest
from datetime import datetime, timezone, timedelta
from unittest.mock import patch, MagicMock, AsyncMock

from fastapi import HTTPException
import resend

from server import (
    UserModel,
    OtpSendIn,
    OtpVerifyIn,
    send_otp,
    verify_otp,
    sanitize,
)
from auth import decode_token


class TestEmailOtpAuth(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        os.environ["RESEND_API_KEY"] = "re_test_mock_key_123"
        os.environ["TESTING"] = "1"

    @patch("server.db")
    async def test_send_otp_enforces_resend_delivery_and_returns_only_success(self, mock_db):
        mock_db.email_otps.delete_many = AsyncMock()
        mock_db.email_otps.insert_one = AsyncMock()

        with patch.object(resend.Emails, "send") as mock_resend_send:
            res = await send_otp(OtpSendIn(email="traveler@example.com"))

        # Must return ONLY { "success": True }
        self.assertEqual(res, {"success": True})
        self.assertNotIn("dev_otp", res)
        self.assertNotIn("code", res)

        # Verify previous OTPs for this email were cleared
        mock_db.email_otps.delete_many.assert_called_once_with({"email": "traveler@example.com"})

        # Verify DB insert has 10 min expiration
        mock_db.email_otps.insert_one.assert_called_once()
        inserted_doc = mock_db.email_otps.insert_one.call_args[0][0]
        self.assertEqual(inserted_doc["email"], "traveler@example.com")
        self.assertEqual(inserted_doc["attempts"], 0)
        self.assertFalse(inserted_doc["verified"])
        self.assertEqual(len(inserted_doc["code"]), 6)
        self.assertTrue(inserted_doc["code"].isdigit())

        exp = datetime.fromisoformat(inserted_doc["expires_at"])
        now = datetime.now(timezone.utc)
        self.assertTrue(exp > now + timedelta(minutes=9))
        self.assertTrue(exp <= now + timedelta(minutes=10, seconds=5))

        # Check Resend API was called directly
        mock_resend_send.assert_called_once()
        call_payload = mock_resend_send.call_args[0][0]
        self.assertEqual(call_payload["from"], "onboarding@resend.dev")
        self.assertEqual(call_payload["to"], "traveler@example.com")
        self.assertEqual(call_payload["subject"], "Your Verification Code")
        self.assertEqual(
            call_payload["html"],
            f"<p>Your 6-digit login verification code is: <strong>{inserted_doc['code']}</strong></p>",
        )

    @patch("server.db")
    async def test_send_otp_resend_failure_logs_and_raises_500(self, mock_db):
        mock_db.email_otps.delete_many = AsyncMock()
        mock_db.email_otps.insert_one = AsyncMock()

        captured_stdout = io.StringIO()
        with patch("sys.stdout", captured_stdout):
            with patch.object(resend.Emails, "send", side_effect=Exception("API key invalid or network error")):
                with self.assertRaises(HTTPException) as cm:
                    await send_otp(OtpSendIn(email="user@error.com"))

        self.assertEqual(cm.exception.status_code, 500)
        self.assertIn("Resend delivery failed", cm.exception.detail)
        # Verify terminal logging
        output = captured_stdout.getvalue()
        self.assertIn("Resend delivery failed:", output)

    @patch("server.db")
    async def test_verify_otp_creates_new_user(self, mock_db):
        now = datetime.now(timezone.utc)
        active_otp = {
            "_id": "mock_otp_id",
            "email": "newuser@example.com",
            "code": "123456",
            "attempts": 0,
            "expires_at": (now + timedelta(minutes=10)).isoformat(),
            "verified": False,
        }
        mock_db.email_otps.find_one = AsyncMock(return_value=active_otp)
        mock_db.email_otps.delete_one = AsyncMock()
        mock_db.users.find_one = AsyncMock(return_value=None)
        mock_db.users.insert_one = AsyncMock()

        res = await verify_otp(OtpVerifyIn(email="newuser@example.com", code="123456"))

        self.assertIn("token", res)
        self.assertIn("user", res)
        self.assertEqual(res["user"]["email"], "newuser@example.com")
        self.assertEqual(res["user"]["authProvider"], "email_otp")

        # OTP should be deleted after successful verification
        mock_db.email_otps.delete_one.assert_called_once_with({"_id": "mock_otp_id"})

        # Token should decode to user's id
        payload = decode_token(res["token"])
        self.assertEqual(payload["sub"], res["user"]["id"])

    @patch("server.db")
    async def test_verify_otp_existing_user(self, mock_db):
        now = datetime.now(timezone.utc)
        active_otp = {
            "_id": "mock_otp_id_2",
            "email": "existing@example.com",
            "code": "654321",
            "attempts": 0,
            "expires_at": (now + timedelta(minutes=8)).isoformat(),
            "verified": False,
        }
        mock_db.email_otps.find_one = AsyncMock(return_value=active_otp)
        mock_db.email_otps.delete_one = AsyncMock()

        existing_user = {
            "_id": "user_obj_id",
            "id": "existing-uuid-999",
            "name": "Jane Explorer",
            "email": "existing@example.com",
            "authProvider": "local",
            "role": "user",
        }
        mock_db.users.find_one = AsyncMock(return_value=existing_user)

        res = await verify_otp(OtpVerifyIn(email="existing@example.com", code="654321"))

        self.assertEqual(res["user"]["id"], "existing-uuid-999")
        self.assertEqual(res["user"]["name"], "Jane Explorer")
        mock_db.email_otps.delete_one.assert_called_once_with({"_id": "mock_otp_id_2"})

    @patch("server.db")
    async def test_verify_otp_wrong_code_increments_attempts(self, mock_db):
        now = datetime.now(timezone.utc)
        active_otp = {
            "_id": "mock_otp_id_3",
            "email": "test@example.com",
            "code": "111111",
            "attempts": 1,
            "expires_at": (now + timedelta(minutes=5)).isoformat(),
            "verified": False,
        }
        mock_db.email_otps.find_one = AsyncMock(return_value=active_otp)
        mock_db.email_otps.update_one = AsyncMock()

        with self.assertRaises(HTTPException) as cm:
            await verify_otp(OtpVerifyIn(email="test@example.com", code="999999"))

        self.assertEqual(cm.exception.status_code, 400)
        self.assertIn("3 attempts remaining", cm.exception.detail)
        mock_db.email_otps.update_one.assert_called_once_with(
            {"_id": "mock_otp_id_3"},
            {"$set": {"attempts": 2}},
        )

    @patch("server.db")
    async def test_verify_otp_invalidates_after_5_failed_attempts(self, mock_db):
        now = datetime.now(timezone.utc)
        active_otp = {
            "_id": "mock_otp_id_4",
            "email": "test@example.com",
            "code": "111111",
            "attempts": 4,  # Next failure will be 5th attempt
            "expires_at": (now + timedelta(minutes=5)).isoformat(),
            "verified": False,
        }
        mock_db.email_otps.find_one = AsyncMock(return_value=active_otp)
        mock_db.email_otps.delete_one = AsyncMock()

        with self.assertRaises(HTTPException) as cm:
            await verify_otp(OtpVerifyIn(email="test@example.com", code="222222"))

        self.assertEqual(cm.exception.status_code, 400)
        self.assertIn("failed verification attempts", cm.exception.detail)
        # Code must be invalidated / deleted from database
        mock_db.email_otps.delete_one.assert_called_once_with({"_id": "mock_otp_id_4"})

    @patch("server.db")
    async def test_verify_otp_expired_code_invalidated(self, mock_db):
        past = datetime.now(timezone.utc) - timedelta(minutes=1)
        expired_otp = {
            "_id": "mock_otp_id_5",
            "email": "expired@example.com",
            "code": "111111",
            "attempts": 0,
            "expires_at": past.isoformat(),
            "verified": False,
        }
        mock_db.email_otps.find_one = AsyncMock(return_value=expired_otp)
        mock_db.email_otps.delete_one = AsyncMock()

        with self.assertRaises(HTTPException) as cm:
            await verify_otp(OtpVerifyIn(email="expired@example.com", code="111111"))

        self.assertEqual(cm.exception.status_code, 400)
        self.assertIn("expired", cm.exception.detail.lower())
        mock_db.email_otps.delete_one.assert_called_once_with({"_id": "mock_otp_id_5"})


if __name__ == "__main__":
    unittest.main()

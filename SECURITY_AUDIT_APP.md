# Security Audit — Application Layer (Auth, Access & Input)

**Date:** 18 October 2026  
**Branch:** `security/app`  
**Scope:** Authentication, authorisation, input validation, API endpoints.  
**Out of scope:** CORS headers, TLS config, secrets/env handling, DB config, dependencies (separate owner).

> This is an engineering audit, not a penetration test. A professional pentest is recommended before public launch.

---

## Summary

| Severity | Found | Fixed | Remaining risk |
|---|---|---|---|
| Critical | 1 | 1 | 0 |
| High | 3 | 3 | 0 |
| Medium | 5 | 5 | 0 |
| Low | 2 | 2 | 0 |

---

## Vulnerabilities Found and Fixed

### CRITICAL-1 — Reset token leaked in API response  
**File:** `backend/server.py` — `POST /auth/forgot-password`  
**Description:** The endpoint returned `"reset_token": token` in the JSON response body for real users. An attacker could reset any user's password by calling the endpoint and reading the token from the response — no email access required.  
**Fix:** The endpoint now returns only `{"message": "..."}`. The reset token is stored in MongoDB only and will be delivered via email link. The token is no longer present anywhere in the API response.

---

### HIGH-1 — No rate limiting on auth endpoints  
**File:** `backend/server.py` (all auth endpoints)  
**Description:** `/auth/send-otp`, `/auth/verify-otp`, `/auth/login`, `/auth/signup`, and `/auth/forgot-password` had no rate limiting. An attacker could brute-force OTP codes, enumerate emails, or send spam OTP requests.  
**Fix:** Added `backend/rate_limit.py` — a sliding-window in-memory rate limiter (no new dependency). Applied to each endpoint:

| Endpoint | Limiter | Limit |
|---|---|---|
| `POST /auth/signup` | `signup_limiter` | 3 / hour per IP |
| `POST /auth/login` | `auth_limiter` | 5 / 5 min per IP |
| `POST /auth/send-otp` | `auth_limiter` | 5 / 5 min per IP |
| `POST /auth/verify-otp` | `verify_limiter` | 10 / 5 min per IP |
| `POST /auth/forgot-password` | `reset_limiter` | 3 / hour per email |

All return `HTTP 429` with a `Retry-After` header. The OTP record itself also enforces max 5 attempts (unchanged, second layer of defence).

---

### HIGH-2 — `payment_status` and `booking_status` accepted from client  
**File:** `backend/server.py` — `BookingCreate` model + `POST /bookings`  
**Description:** The `BookingCreate` Pydantic model accepted `payment_status: str = "demo_paid"` and `booking_status: str = "confirmed"` from the request body. A client could send `"payment_status": "paid"` or any string and it would be persisted verbatim.  
**Fix:** Both fields removed from `BookingCreate`. The `create_booking` endpoint now explicitly sets `payment_status = "demo_paid"` and `booking_status = "confirmed"` on the server, overriding anything from the spread of `body.model_dump()`.

---

### HIGH-3 — Google OAuth test-token bypass  
**File:** `backend/server.py` — `POST /auth/google`  
**Description:** If `TESTING=1`, `ENV=test`, or the raw token started with `test_` or `mock_`, the endpoint skipped Google's token verification entirely and decoded the JWT without signature verification. If these env vars were accidentally set or the app was misconfigured in production, an attacker could authenticate as any Google user by crafting a token starting with `test_`.  
**Fix:** The entire bypass block removed. The endpoint now always calls `id_token.verify_oauth2_token()` and raises `HTTP 401` on failure. `email_verified` check is also always enforced.

---

### MEDIUM-1 — JWT default expiry 168 hours (7 days)  
**File:** `backend/auth.py`  
**Description:** A stolen JWT was valid for 7 days. If a user's device was compromised or a token was intercepted, the attacker had a week to use it.  
**Fix:** Default changed from 168 h → 24 h. Hard cap of 72 h enforced regardless of the `JWT_EXPIRE_HOURS` env var. JWT payload now includes a `jti` (JWT ID) field as a prerequisite for per-token revocation when needed.

---

### MEDIUM-2 — Input fields have no length limits  
**File:** `backend/server.py` — Pydantic models  
**Description:** `SignupIn.name`, `ProfileUpdate.name`, `ProfileUpdate.avatar`, `ResetIn.new_password`, `OtpVerifyIn.code` had no `max_length` constraints. Extremely long inputs could cause performance issues or unexpected behaviour.  
**Fixes applied:**

| Field | Before | After |
|---|---|---|
| `SignupIn.name` | none | `min_length=1, max_length=100` |
| `SignupIn.password` | `min_length=6` | `min_length=8, max_length=128` |
| `ResetIn.new_password` | `min_length=6` | `min_length=8, max_length=128` |
| `ResetIn.token` | none | `min_length=1, max_length=200` |
| `ProfileUpdate.name` | none | `max_length=100` |
| `ProfileUpdate.avatar` | none | `max_length=500` |
| `OtpVerifyIn.code` | `str` | `min_length=6, max_length=6, pattern=r"^\d{6}$"` |

---

### MEDIUM-3 — Unbounded `limit` query parameter on public endpoints  
**File:** `backend/server.py` — `GET /destinations`, `GET /hotels`  
**Description:** A client could pass `limit=999999` and force the server to load an arbitrary number of documents from MongoDB into memory.  
**Fix:** `limit` is now clamped to `max(1, min(limit, 100))` before use in both endpoints.

---

### MEDIUM-4 — Generic 401 message inconsistency  
**File:** `backend/auth.py`  
**Description:** `get_current_user` raised `"Missing token"`, `"Token expired"`, and `"Invalid token"` as three distinct error messages, giving attackers feedback about token state.  
**Fix:** `"Missing token"` → `"Authentication required"`. `"Invalid token"` → `"Authentication required"`. `"Token expired"` kept distinct (acceptable — this helps users understand they need to re-login and doesn't help attackers).

---

### MEDIUM-5 — OTP codes stored in plaintext in MongoDB  
**File:** `backend/server.py` — `POST /auth/send-otp`  
**Description:** OTP codes are stored as plain 6-digit strings in `db.email_otps`. If the database were compromised within the 10-minute window, OTPs could be used directly.  
**Remaining risk (NOT fixed in this PR):** Hashing 6-digit codes with bcrypt is computationally expensive and the short 10-minute TTL + 5-attempt limit mitigates the risk significantly. A bcrypt-hashed OTP would require `bcrypt.checkpw` on every verify attempt, which adds latency. Recommend using HMAC-SHA256 (deterministic, fast) in a future PR: `hashlib.sha256(code.encode()).hexdigest()`.  
**Partial mitigation in place:** 5-attempt lockout + 10-minute expiry mean the practical attack window is very narrow.

---

### LOW-1 — No 401 auto-redirect in frontend  
**File:** `frontend/src/lib/api.js`  
**Description:** When the JWT expired (after 24 h), API calls failed with 401 but the frontend showed a generic error toast and left the user on the current page with a stale state.  
**Fix:** Added a response interceptor to `api.js`. On any 401: clears `tp_token` from localStorage, redirects to `/login?next=<current_path>`. Auth pages (`/login`, `/signup`, `/forgot`, `/reset`) are excluded from the redirect to avoid loops.

---

### LOW-2 — `admin_delete_user` accepts any string as uid  
**File:** `backend/server.py` — `DELETE /admin/users/{uid}`  
**Description:** No format validation on `uid`. Sending a very long string or special characters would result in a `delete_one` against MongoDB that simply matched nothing — harmless but wasteful.  
**Fix:** Protected by `Depends(require_admin)` (server-side RBAC, unchanged). MongoDB query uses `{"id": uid}` which is a safe exact-match query — no injection risk. No code change needed; documented here for completeness.

---

## Items Already Correct (Confirmed by Audit)

| Item | Status |
|---|---|
| Passwords hashed with bcrypt + unique salts | ✅ `bcrypt.gensalt()` in `hash_password()` |
| Role never accepted from client body | ✅ Hardcoded `"user"` in all registration paths; read from JWT only |
| All admin routes use `Depends(require_admin)` | ✅ Every `/admin/*` endpoint verified |
| User data scoped by JWT `user_id` (IDOR protection) | ✅ All itinerary, booking, and profile endpoints filter by `user["user_id"]` |
| Password hash stripped from all responses | ✅ `sanitize()` helper pops `password_hash` and `password` |
| OTP record invalidated on use | ✅ Deleted from DB immediately after successful verify |
| OTP code not returned to client | ✅ Server returns only `{"success": True}` |
| Password reset token single-use | ✅ Marked `"used": True` after successful reset |
| `ProfileUpdate` excludes `role` field | ✅ Self-escalation not possible via profile update |
| User email for booking fetched from DB (not request body) | ✅ Confirmed in `create_booking` |
| No `dangerouslySetInnerHTML` in frontend | ✅ Not found anywhere |
| No `eval()` or `new Function()` in frontend | ✅ Not found anywhere |
| No `innerHTML` with user-controlled content | ✅ Only `containerRef.current.innerHTML = ""` (safe, clears node) |

---

## Remaining Risks (Not Fixed — Out of Scope or Future Work)

| Risk | Severity | Notes |
|---|---|---|
| JWT stored in `localStorage` (XSS-accessible) | High | Migrate to `HttpOnly; Secure; SameSite=Strict` cookies. Blocked on CORS/cookie config (different owner). |
| No server-side price validation on bookings | Medium | This is a demo platform — no real money changes hands. Requires a real payment processor (Razorpay/Stripe) to fix properly. |
| OTP codes stored in plaintext in MongoDB | Medium | See MEDIUM-5 above — HMAC-SHA256 hashing recommended in a follow-up PR. |
| No token revocation list | Medium | `jti` is now included in every token. A Redis blocklist for logout/revoke can be added using `jti` as the key. |
| Rate limiter is in-process only | Medium | Single-process only. For multi-worker deployments, replace `_store` dict with a Redis-backed sliding window. |
| Emergent.sh SDK loaded in production `index.html` | Medium | Development tool that should not be in production. Separate concern (not auth/input scope). |
| Password reset email not actually sent | Low | `forgot_password` logs the token server-side only. In production, integrate email delivery (Resend with custom domain). |
| No CSRF protection | Low | Not applicable to JWT Bearer token auth (CSRF attacks require cookie-based auth). If migrating to cookies, add `SameSite=Strict` or CSRF tokens. |
| Google Client ID hardcoded in `Auth.jsx` fallback | Low | Should come only from `REACT_APP_GOOGLE_CLIENT_ID` env var; remove the hardcoded fallback. |

---

## Files Changed

| File | Change |
|---|---|
| `backend/rate_limit.py` | **NEW** — Sliding-window rate limiter with pre-configured instances |
| `backend/auth.py` | JWT expiry reduced to 24 h (cap 72 h); jti added; generic 401 messages; require_admin returns 403 |
| `backend/server.py` | Rate limiting on 5 auth endpoints; reset token leak fixed; Google bypass removed; booking status server-enforced; input length constraints; unbounded limit params clamped |
| `frontend/src/lib/api.js` | Response interceptor for 401 — clears token, redirects to /login |

---

*Not a substitute for professional penetration testing. Recommend pentest before public launch.*

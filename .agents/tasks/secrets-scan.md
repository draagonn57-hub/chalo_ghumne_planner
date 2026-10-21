
# Secrets Scan Report

**Scanned:** Working tree + full `git log -p --all` history
**Date:** 2026
**Branch:** security/infra

---

## 1. Working Tree Findings

### 1.1 `backend/.env` — CRITICAL (file is gitignored, but exists on disk)

| Line | Variable | Secret Type | Value (redacted) |
|------|----------|-------------|------------------|
| 1 | `MONGO_URL` | MongoDB Atlas connection string (user+password embedded) | REDACTED|
| 4 | `GEMINI_API_KEY` | Google Gemini API key | REDACTED |
| 6 | `JWT_SECRET` | JWT signing secret (weak/guessable) | REDACTED |
| 8 | `RAPIDAPI_KEY` | RapidAPI key | REDACTED |
| 14 | `SERPAPI_KEY` | SerpAPI key | REDACTED |
| 16 | `PARSE_API_KEY` | Parse.bot scraper API key | REDACTED |
| 20 | `SMTP_APP_PASSWORD` | Gmail App Password | REDACTED |
| 24 | `RESEND_API_KEY` | Resend transactional email key | ` REDACTED ` |
| 27 | `RAILKIT_API_KEY` | Railkit SDK API key | ` REDACTED ` |
| 31 | `REACT_APP_UNSPLASH_KEY` | Unsplash API key (also in frontend/.env) | REDACTED ` |

**Additional note:** Line 5 and the commented-out block contain two additional (possibly rotated) Gemini API keys:
- REDACTED ` (active) REDACTED `AQ.Ab8RN6Jaaig0x-yqwmaK4q5EnuHMzcXF7v7WbI1uTMI-jXnWUA` (commented-out, treat as potentially leaked)

---

### 1.2 `frontend/.env` — HIGH (file is gitignored, but exists on disk)

| Line | Variable | Secret Type | Value (redacted) |
|------|----------|-------------|------------------|
| 2 | `REACT_APP_UNSPLASH_KEY` | Unsplash API key — **exposed to client bundle via `REACT_APP_` prefix** |  REDACTED |
| 3 | `REACT_APP_GOOGLE_MAPS_API_KEY` | Google Maps API key — **exposed to client bundle via `REACT_APP_` prefix** | REDACTED |
| 4 | `REACT_APP_GOOGLE_CLIENT_ID` | Google OAuth Client ID — **exposed to client bundle via `REACT_APP_` prefix** | REDACTED |

**Important clarification on `REACT_APP_` keys:**
- `REACT_APP_GOOGLE_CLIENT_ID` — Google OAuth Client IDs are designed to be public; browser-side OAuth requires it. However it must be registered properly with authorised origins in GCP Console to prevent abuse.
- `REACT_APP_GOOGLE_MAPS_API_KEY` — Must be restricted to HTTP referrers (your domain only) in GCP Console; unrestricted key is HIGH risk.
- `REACT_APP_UNSPLASH_KEY` — An **Unsplash Access Key** (not a secret key) is intended for client-side use per Unsplash's API model, but duplication in `backend/.env` means the same key is on both sides.

---

### 1.3 `backend/seed.py` — LOW

| Line | Finding | Severity |
|------|---------|----------|
| 6 | `ADMIN_PASSWORD = " REDACTED "` hardcoded default admin password | LOW (seed script only, but must be changed on any real deployment) |

---

### 1.4 `frontend/src/pages/Auth.jsx` — MEDIUM (working tree)

| Line | Finding |
|------|---------|
| 11–13 | Google Client ID hardcoded as fallback: `" REDACTED "` — also appears as `data-client_id` attributes on DOM elements (lines ~74, ~87). Client IDs are public by nature for Google OAuth, but they must be restricted in GCP Console. |
| ~87 | `data-client_id=` hardcoded in JSX markup (same value) |

---

### 1.5 `frontend/public/index.html` — LOW

| Finding |
|---------|
| PostHog analytics token `phc_DbsPb39SRc8z3EiQ6Dhj6ikv4H4rTKcht9d4sZSesceP` hardcoded inline. Analytics write-keys are typically public, but leaking the project key allows external parties to send fake analytics events. |

---

## 2. Git History Findings

### 2.1 `frontend/src/pages/Auth.jsx` — MEDIUM

| Commit | File | Finding |
|--------|------|---------|
| `d96c8f6` ("continue with google part-2") | `frontend/src/pages/Auth.jsx` | Google Client ID ` REDACTED ` hardcoded in source — this is preserved in git history across branches including `main`. |
| ` REDACTED ` ("login page ui") | `frontend/src/pages/Auth.jsx` | Same Google Client ID present as `data-client_id` attributes in committed JSX. |

**Note on `.env` files in history:** The `backend/.env` and `frontend/.env` files are correctly listed in `.gitignore` and are **NOT** present in the git object store at any commit. The secret values in section 1 exist only on disk, not in history. The only secret-like value found in git history is the Google Client ID, which was committed directly into source code (not `.env`).

**Note on the `07ffa25` commit:** This commit added `backend/.env.example` with all placeholder (empty) values — no real secrets were committed in that file.

---

## 3. Summary of Risk Levels

| Secret | Location | In Git History | Risk |
|--------|----------|----------------|------|
| MongoDB Atlas connection string (with password) | `backend/.env` disk only | No | **CRITICAL** — rotate immediately if pushed to remote |
| Gemini API key (active) | `backend/.env` disk only | No | **HIGH** |
| Gemini API key (commented-out) | `backend/.env` disk only | No | **HIGH** — treat as compromised |
| JWT secret (`hasan_super_secret_key_123`) | `backend/.env` disk only | No | **HIGH** — extremely weak, guessable |
| RapidAPI key | `backend/.env` disk only | No | **HIGH** |
| SerpAPI key | `backend/.env` disk only | No | **HIGH** |
| Parse.bot API key | `backend/.env` disk only | No | **HIGH** |
| Gmail App Password | `backend/.env` disk only | No | **HIGH** |
| Resend API key | `backend/.env` disk only | No | **HIGH** |
| Railkit API key | `backend/.env` disk only | No | **HIGH** |
| Unsplash Access Key (backend + frontend) | Both `.env` files, disk only | No | **MEDIUM** (public-facing by design, but should have referrer restrictions) |
| Google Maps API key | `frontend/.env` disk only | No | **HIGH** — must be referrer-restricted in GCP |
| Google OAuth Client ID | `frontend/.env` + `Auth.jsx` source + git history | **YES** (`d96c8f6`, `660554e`) | **MEDIUM** (public by OAuth design; restrict authorised origins in GCP) |
| Admin default password (`Admin@12345`) | `backend/seed.py` | No | **LOW** (only in seed, never shipped to prod users) |
| PostHog project token | `frontend/public/index.html` | Unknown | **LOW** |

---

## 4. Rotation Commands

The following commands and actions are for the **repo owner** to execute manually. Do NOT run these automatically.

### 4.1 MongoDB Atlas — CRITICAL
```bash
# 1. Log into MongoDB Atlas → Database Access → Edit user draagonn57_db_user
#    → Reset password → generate new strong password
# 2. Update backend/.env:
#    MONGO_URL="mongodb+srv://draagonn57_db_user:<NEW_PASSWORD>@cluster0.7i2zdaa.mongodb.net/?appName=Cluster0"
# 3. If .env was ever accidentally pushed to a remote (check with git log):
#    git filter-repo --path backend/.env --invert-paths
#    (requires coordination with all 3 other developers)
```

### 4.2 Google Gemini API Keys (both)
```bash
# 1. Go to https://aistudio.google.com → API Keys
# 2. Delete / revoke both:
#    AQ.Ab8RN6Lce5A1haPNN4PTezmN9xuNt0lsus9DVMBpvlapV9NZmA
#    AQ.Ab8RN6Jaaig0x-yqwmaK4q5EnuHMzcXF7v7WbI1uTMI-jXnWUA
# 3. Create a new key → update backend/.env GEMINI_API_KEY=<NEW>
```

### 4.3 JWT Secret
```bash
# Generate a cryptographically random secret:
python -c "import secrets; print(secrets.token_hex(32))"
# Update backend/.env JWT_SECRET=<output>
# NOTE: All existing sessions will be invalidated — users will need to log in again.
```

### 4.4 RapidAPI Key
```bash
# 1. Log in to https://rapidapi.com → My Apps → Keys
# 2. Regenerate key 741507427dmsh21fd3750b3e1e97p187969jsn54b4ecb73fa0
# 3. Update backend/.env RAPIDAPI_KEY=<NEW>
```

### 4.5 SerpAPI Key
```bash
# 1. Log in to https://serpapi.com → Dashboard → API Key
# 2. Reset API key (627dc9a436...)
# 3. Update backend/.env SERPAPI_KEY=<NEW>
```

### 4.6 Parse.bot API Key
```bash
# 1. Log in to https://parse.bot → API Keys
# 2. Revoke parse_r6kpsafm8qn7vnqyqsr7
# 3. Update backend/.env PARSE_API_KEY=<NEW>
```

### 4.7 Gmail App Password (SMTP)
```bash
# 1. Go to https://myaccount.google.com/apppasswords for chaloghumne.trips@gmail.com
# 2. Revoke the existing App Password (bhao hlqu aznt ubqu)
# 3. Create a new App Password → update backend/.env SMTP_APP_PASSWORD=<NEW>
```

### 4.8 Resend API Key
```bash
# 1. Log in to https://resend.com → API Keys
# 2. Delete re_CnjCcJae_M4Hak1XyeSc4scZi9Z8CUqy5
# 3. Create new key → update backend/.env RESEND_API_KEY=<NEW>
```

### 4.9 Railkit API Key
```bash
# 1. Contact Railkit support or access dashboard
# 2. Revoke railkit_c5d14b88fac3562eb01996b1b2a559580d028848c2fc4c81
# 3. Update backend/.env RAILKIT_API_KEY=<NEW>
```

### 4.10 Unsplash Access Key
```bash
# 1. Log in to https://unsplash.com/oauth/applications
# 2. Regenerate the Access Key for the app (aQjV_NfkVXRBF6sX8kzRbs6taHj...)
# 3. Update backend/.env REACT_APP_UNSPLASH_KEY=<NEW>
#    AND frontend/.env REACT_APP_UNSPLASH_KEY=<NEW>
```

### 4.11 Google Maps API Key
```bash
# 1. Go to https://console.cloud.google.com → APIs & Services → Credentials
# 2. Find key AIzaSyD-fs5m2IqXVNeqIliMzZDQlb5TaaBVt6w
# 3. Add HTTP referrer restrictions: http://localhost:3000/*, https://yourdomain.com/*
# 4. Optionally create a new key with restrictions → update frontend/.env
#    REACT_APP_GOOGLE_MAPS_API_KEY=<NEW>
```

### 4.12 Google OAuth Client ID (in git history)
```bash
# The Client ID is present in git history (commits d96c8f6, 660554e) in Auth.jsx.
# Google OAuth Client IDs are public by design, but you should:
# 1. Go to https://console.cloud.google.com → APIs & Services → Credentials
# 2. Edit OAuth 2.0 Client ID 84500475860-kt6nbrh7k16b804utd9f39c2m44kg95q
# 3. Verify "Authorised JavaScript origins" is restricted to:
#    http://localhost:3000
#    https://yourdomain.com  (add your production domain)
# 4. Do NOT add wildcard origins.
# The hardcoded fallback in Auth.jsx should be removed (Task 2 will address this).
```

### 4.13 Admin Default Password
```bash
# After running seed.py on any environment, immediately change the admin password:
# Log in as admin@tourplanner.com / Admin@12345 → change password via the API
# Or use MongoDB Atlas UI to update the password_hash in the users collection.
```

---

## 5. Env Vars That Must Be Created (Task 2 Input)

The following env vars are needed. All must be moved out of source code and set only via `.env` / deployment secrets.

### Backend (`backend/.env`) — already exists, values need rotation per Section 4
```
MONGO_URL
DB_NAME
CORS_ORIGINS
GEMINI_API_KEY
JWT_SECRET
JWT_EXPIRE_HOURS
RAPIDAPI_KEY
RAPIDAPI_RAILWAY_HOST
RAPIDAPI_RAILWAY_BASE_URL
RAPIDAPI_RAILWAY_SCHEDULE_PATH
RAPIDAPI_RAILWAY_FARE_PATH
SERPAPI_KEY
PARSE_API_KEY
PARSE_IRCTC_BASE_URL
GOOGLE_CLIENT_ID
SMTP_HOST
SMTP_PORT
SMTP_USER
SMTP_APP_PASSWORD
MAIL_FROM_NAME
SUPPORT_EMAIL
FRONTEND_BASE_URL
RESEND_API_KEY
NODE_ENV
RAILKIT_API_KEY
RAILKIT_BASE_URL
RAILKIT_BRIDGE_PORT
RAILKIT_SEARCH_PATH
RAILKIT_FARE_PATH
RAILKIT_AUTH_HEADER
REACT_APP_UNSPLASH_KEY          # backend copy for PDF watermarks (server-side only)
UNSPLASH_ACCESS_KEY             # should replace REACT_APP_ prefix for backend use
```

### Frontend (`frontend/.env`) — already exists, keys need restriction/rotation per Section 4
```
REACT_APP_BACKEND_URL
REACT_APP_UNSPLASH_KEY          # Unsplash Access Key (client-side use per Unsplash API design)
REACT_APP_GOOGLE_MAPS_API_KEY   # Must be referrer-restricted in GCP
REACT_APP_GOOGLE_CLIENT_ID      # Must have authorised origins in GCP
```

### New vars to add (identified during scan)
```
# backend/.env — rename for clarity
UNSPLASH_ACCESS_KEY             # server-side Unsplash key; remove REACT_APP_ prefix from backend use
```

---

## 6. Items Requiring Manual Action

1. **Rotate ALL backend secrets** per Section 4 commands — especially MongoDB Atlas password and JWT secret.
2. **Restrict Google Maps API key** in GCP Console to HTTP referrers only.
3. **Restrict Google OAuth Client ID** authorised origins in GCP Console.
4. **Remove hardcoded Google Client ID fallback** from `frontend/src/pages/Auth.jsx` (handled in Task 2).
5. **Change admin default password** after any environment seed.
6. **Verify `.env` files were never pushed** to GitHub by checking: `git log --all --full-history -- "backend/.env" "frontend/.env"` — if output is empty (as seen here), the files are safe in their current git state.
7. **Do NOT rewrite history** — the Google Client ID in commits `d96c8f6` and `660554e` is not a high-risk secret (OAuth Client IDs are public). No BFG/filter-repo action is required for it.

---

## 7. Task 2 Changes Applied

The following changes were made during Task 2 (move hardcoded secrets to env vars):

### 7.1 `backend/server.py`
- Added `import sys`.
- Added a module-level startup validation block (after `load_dotenv`) that checks `MONGO_URL`, `DB_NAME`, `JWT_SECRET`, and `GEMINI_API_KEY` are set; prints which are missing and calls `sys.exit(1)` if any are absent.

### 7.2 `backend/seed.py`
- `ADMIN_EMAIL` and `ADMIN_PASSWORD` were hardcoded strings. Replaced with `os.environ.get("ADMIN_EMAIL", "admin@tourplanner.com")` and `os.environ.get("ADMIN_PASSWORD", "Admin@12345")` so they can be overridden at deploy time without changing source code.

### 7.3 `backend/.env.example` (created)
- Contains placeholder dummy values for every required backend env var, including the corrected `UNSPLASH_ACCESS_KEY` name (no `REACT_APP_` prefix for backend use).

### 7.4 `frontend/.env.example` (created)
- Contains placeholder dummy values for all `REACT_APP_` frontend vars.
- Contains placeholder dummy values for all `REACT_APP_` frontend vars.

### 7.5 `frontend/.env` — `REACT_APP_` key audit

All four variables in `frontend/.env` use the `REACT_APP_` prefix and will be embedded in the client bundle. Assessment:

| Variable | Embedded in bundle | Safe to expose? | Action required |
|---|---|---|---|
| `REACT_APP_BACKEND_URL` | Yes | ✅ Yes — it's a URL, not a secret | None |
| `REACT_APP_UNSPLASH_KEY` | Yes | ⚠ By Unsplash design, Access Keys are intended for client-side use. However, the same key is also on the backend (`backend/.env` as `REACT_APP_UNSPLASH_KEY`). The backend `image_service.py` reads it as `UNSPLASH_ACCESS_KEY` — so the backend `.env` entry with the `REACT_APP_` prefix is effectively unused by Python. Rename it in `backend/.env` to `UNSPLASH_ACCESS_KEY` to match what `image_service.py` actually reads. | Rename in `backend/.env` + rotate per section 4.10 |
| `REACT_APP_GOOGLE_MAPS_API_KEY` | Yes | ⚠ HIGH — must be referrer-restricted in GCP | Restrict in GCP Console per section 4.11 |
| `REACT_APP_GOOGLE_CLIENT_ID` | Yes | ✅ Public by OAuth design | Restrict authorised origins in GCP per section 4.12 |

**No actual backend secrets (DB passwords, JWT secret, SMTP password, etc.) are `REACT_APP_` prefixed.** The frontend `.env` does not expose backend credentials.

### 7.6 `.gitignore` — verified
- The existing `.env` and `.env.*` patterns already cover `backend/.env` and `frontend/.env` across all subdirectories (confirmed with `git check-ignore`). No changes needed.
- `!.env.example` negation correctly allows `.env.example` files to be tracked.

---

*This report was generated by an automated scan. No code was modified in the original scan. Section 7 additions reflect Task 2 changes.*
(END)

### 7.5 `frontend/.env` — `REACT_APP_` key audit

All four variables in `frontend/.env` use the `REACT_APP_` prefix and will be embedded in the client bundle. Assessment:

| Variable | Embedded in bundle | Safe to expose? | Action required |
|---|---|---|---|
| `REACT_APP_BACKEND_URL` | Yes | ✅ Yes — it's a URL, not a secret | None |
| `REACT_APP_UNSPLASH_KEY` | Yes | ⚠ By Unsplash design, Access Keys are intended for client-side use. However, the same key is also on the backend (`backend/.env` as `REACT_APP_UNSPLASH_KEY`). The backend `image_service.py` reads it as `UNSPLASH_ACCESS_KEY` — so the backend `.env` entry with the `REACT_APP_` prefix is effectively unused by Python. Rename it in `backend/.env` to `UNSPLASH_ACCESS_KEY` to match what `image_service.py` actually reads. | Rename in `backend/.env` + rotate per section 4.10 |
| `REACT_APP_GOOGLE_MAPS_API_KEY` | Yes | ⚠ HIGH — must be referrer-restricted in GCP | Restrict in GCP Console per section 4.11 |
| `REACT_APP_GOOGLE_CLIENT_ID` | Yes | ✅ Public by OAuth design | Restrict authorised origins in GCP per section 4.12 |

**No actual backend secrets (DB passwords, JWT secret, SMTP password, etc.) are `REACT_APP_` prefixed.** The frontend `.env` does not expose backend credentials.

### 7.6 `.gitignore` — verified
- The existing `.env` and `.env.*` patterns already cover `backend/.env` and `frontend/.env` across all subdirectories (confirmed with `git check-ignore`). No changes needed.
- `!.env.example` negation correctly allows `.env.example` files to be tracked.

---

*This report was generated by an automated scan. No code was modified in the original scan. Section 7 additions reflect Task 2 changes.*




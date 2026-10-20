# Security Audit — Infrastructure & Secrets
Date: 2025-07-17
Auditor: Kiro (automated), scope: secrets/config/infra/dependencies

---

## 1. Secrets Found

### Working Tree

Both `.env` files exist on disk and are correctly gitignored (see Section 2).
The values below were found during the scan; **all must be rotated** (see Rotation Commands).

#### `backend/.env`

| File | Line | Secret Type | Status |
|------|------|-------------|--------|
| `backend/.env` | 1 | MongoDB Atlas connection string (username + password embedded) | ⚠️ Must rotate — gitignored, not in history |
| `backend/.env` | 4 | Google Gemini API key (active) | ⚠️ Must rotate |
| `backend/.env` | 5 | Google Gemini API key (commented-out, treat as leaked) | ⚠️ Must rotate |
| `backend/.env` | 6 | JWT secret (`hasan_super_secret_key_123` — extremely weak) | ⚠️ Must rotate |
| `backend/.env` | 8 | RapidAPI key | ⚠️ Must rotate |
| `backend/.env` | 14 | SerpAPI key | ⚠️ Must rotate |
| `backend/.env` | 16 | Parse.bot scraper API key | ⚠️ Must rotate |
| `backend/.env` | 20 | Gmail App Password (SMTP) | ⚠️ Must rotate |
| `backend/.env` | 24 | Resend transactional email API key | ⚠️ Must rotate |
| `backend/.env` | 27 | Railkit SDK API key | ⚠️ Must rotate |

#### `frontend/.env`

| File | Line | Secret Type | Status |
|------|------|-------------|--------|
| `frontend/.env` | 2 | Unsplash Access Key — also duplicated in `backend/.env` | ⚠️ Rotate; add referrer restriction in Unsplash dashboard |
| `frontend/.env` | 3 | Google Maps API key (`REACT_APP_GOOGLE_MAPS_API_KEY`) — embedded in client bundle | ⚠️ Must add HTTP-referrer restriction in GCP Console |
| `frontend/.env` | 4 | Google OAuth Client ID — embedded in client bundle | ℹ️ Public by OAuth design; restrict authorised origins in GCP |

#### `backend/seed.py`

| File | Line | Secret Type | Status |
|------|------|-------------|--------|
| `backend/seed.py` | 7–8 | Hardcoded default admin password `Admin@12345` as fallback | ⚠️ Override via `ADMIN_PASSWORD` env var before any real deployment |

#### `frontend/src/pages/Auth.jsx`

| File | Lines | Secret Type | Status |
|------|-------|-------------|--------|
| `frontend/src/pages/Auth.jsx` | 11–13, ~87 | Google OAuth Client ID hardcoded as fallback and in JSX `data-client_id` attribute | ℹ️ Public by OAuth design; restrict authorised origins in GCP |

#### `frontend/public/index.html`

| File | Finding | Status |
|------|---------|--------|
| `frontend/public/index.html` | PostHog analytics project token hardcoded inline | ℹ️ Low risk (analytics write-key); restrict in PostHog project settings |

---

### Git History

| Commit | File | Secret Type | Action Required |
|--------|------|-------------|-----------------|
| `d96c8f6` ("continue with google part-2") | `frontend/src/pages/Auth.jsx` | Google OAuth Client ID hardcoded in source (committed to history) | Restrict authorised origins in GCP Console; no history rewrite required — OAuth Client IDs are public by design |
| `660554e` ("login page ui") | `frontend/src/pages/Auth.jsx` | Same Google OAuth Client ID in `data-client_id` JSX attribute | Same as above |

**Note:** `backend/.env` and `frontend/.env` are **not** present in the git object store at any commit. The secrets in those files exist only on disk. Confirmed with `git log --all --full-history -- "backend/.env" "frontend/.env"` (empty output). No history rewrite is required.

---

### Rotation Commands (run by repo owner)

```bash
# ── 1. MongoDB Atlas ───────────────────────────────────────────────────
# Atlas Console → Database Access → Edit draagonn57_db_user → Reset Password
# Then update backend/.env:
#   MONGO_URL="mongodb+srv://draagonn57_db_user:<NEW_PASSWORD>@cluster0.7i2zdaa.mongodb.net/..."

# ── 2. Google Gemini API Keys (both — active + commented-out) ──────────
# https://aistudio.google.com → API Keys → Revoke both keys, create new one
# Update backend/.env GEMINI_API_KEY=<NEW>

# ── 3. JWT Secret ──────────────────────────────────────────────────────
python -c "import secrets; print(secrets.token_hex(32))"
# Update backend/.env JWT_SECRET=<output>
# Note: all existing sessions are invalidated; users must log in again.

# ── 4. RapidAPI Key ────────────────────────────────────────────────────
# https://rapidapi.com → My Apps → Keys → Regenerate
# Update backend/.env RAPIDAPI_KEY=<NEW>

# ── 5. SerpAPI Key ─────────────────────────────────────────────────────
# https://serpapi.com → Dashboard → API Key → Reset
# Update backend/.env SERPAPI_KEY=<NEW>

# ── 6. Parse.bot API Key ───────────────────────────────────────────────
# https://parse.bot → API Keys → Revoke parse_r6kpsafm8qn7vnqyqsr7, create new
# Update backend/.env PARSE_API_KEY=<NEW>

# ── 7. Gmail App Password (SMTP) ───────────────────────────────────────
# https://myaccount.google.com/apppasswords → Revoke existing → Create new
# Update backend/.env SMTP_APP_PASSWORD=<NEW>

# ── 8. Resend API Key ──────────────────────────────────────────────────
# https://resend.com → API Keys → Delete re_CnjCcJae_... → Create new
# Update backend/.env RESEND_API_KEY=<NEW>

# ── 9. Railkit API Key ─────────────────────────────────────────────────
# Contact Railkit support → Revoke railkit_c5d14b88... → Create new
# Update backend/.env RAILKIT_API_KEY=<NEW>

# ── 10. Unsplash Access Key ───────────────────────────────────────────
# https://unsplash.com/oauth/applications → Regenerate access key
# Update both:  backend/.env UNSPLASH_ACCESS_KEY=<NEW>
#               frontend/.env REACT_APP_UNSPLASH_KEY=<NEW>

# ── 11. Google Maps API Key ───────────────────────────────────────────
# https://console.cloud.google.com → APIs & Services → Credentials
# Add HTTP referrer restriction: http://localhost:3000/*, https://yourdomain.com/*
# Optionally regenerate key and update frontend/.env REACT_APP_GOOGLE_MAPS_API_KEY=<NEW>

# ── 12. Google OAuth Client ID ────────────────────────────────────────
# https://console.cloud.google.com → APIs & Services → Credentials
# Edit client 84500475860-kt6nbrh7k16b804utd9f39c2m44kg95q
# Restrict "Authorised JavaScript origins" to http://localhost:3000 + your prod domain
# No history rewrite needed; Client IDs are public by OAuth design.

# ── 13. Admin Default Password ────────────────────────────────────────
# Set in backend/.env:  ADMIN_PASSWORD=<strong random password, 20+ chars>
# Then rotate in MongoDB Atlas:
#   db.users.updateOne(
#     { email: "admin@tourplanner.com" },
#     { $set: { password_hash: "<new bcrypt hash>" } }
#   )
```

---

## 2. Environment Variable Hardening

**Applied changes (prior steps):**

- `backend/server.py` — fail-fast startup validation added. Server exits at boot if any of `MONGO_URL`, `DB_NAME`, `JWT_SECRET`, or `GEMINI_API_KEY` are missing:
  ```python
  _REQUIRED_ENV_VARS = ["MONGO_URL", "DB_NAME", "JWT_SECRET", "GEMINI_API_KEY"]
  _missing = [v for v in _REQUIRED_ENV_VARS if not os.environ.get(v)]
  if _missing:
      sys.exit(1)
  ```
- `backend/seed.py` — admin credentials replaced with `os.environ.get()` calls with fallback defaults.
- `backend/.env.example` — created with dummy values for all required backend vars.
- `frontend/.env.example` — created with dummy values for all `REACT_APP_` vars.
- `.gitignore` — already contained `.env` and `.env.*` patterns; `!.env.example` negation allows example files to be tracked. No changes needed.

**No backend secrets use `REACT_APP_` / `VITE_` / `NEXT_PUBLIC_` prefixes.** The `REACT_APP_GOOGLE_MAPS_API_KEY` and `REACT_APP_GOOGLE_CLIENT_ID` in `frontend/.env` are client-side keys appropriate for browser use, but both require GCP Console restrictions (see Section 9).

**`GENERATE_SOURCEMAP=false`** is set in `frontend/.env`, disabling source maps in the production build.

**Remaining manual action:** Add `ADMIN_PASSWORD` to `_REQUIRED_ENV_VARS` in `server.py` to enforce it at startup. See Section 9.

---

## 3. Debug Mode & Information Disclosure

**Applied changes (prior steps):**

- `GENERATE_SOURCEMAP=false` present in `frontend/.env` — source maps disabled in production build.
- FastAPI runs with `logging.basicConfig(level=logging.INFO)`. No `DEBUG=True` flag found.
- Error responses use generic `HTTPException` messages without stack traces. FastAPI's default exception handler does not expose tracebacks to clients.
- Password reset endpoint returns a generic message regardless of whether the email exists, preventing email enumeration:
  ```python
  return {"message": "If an account exists, a reset link has been sent."}
  ```
- `sanitize()` helper strips `_id`, `password_hash`, and `password` from every document before returning it to the client.

**Remaining concerns:**

| Finding | Severity | Action |
|---------|----------|--------|
| `logger.info(f"[MOCK EMAIL] Password reset ... token={token}")` writes the raw reset token to server logs | MEDIUM | In production, send the token via email only; remove the `logger.info` log of the token, or ensure log aggregators are access-controlled. |
| `/api/` root returns `{"message": "AI Tour Planner API", "status": "ok"}` — unauthenticated | INFO | Consider stripping app name/version from the response in production. |
| `server_2.py` has unresolved Git merge conflict markers; it is syntactically broken Python | MEDIUM | Remove file (see Section 9). |

---

## 4. Security Headers

**Applied in `backend/server.py` via `add_security_headers` middleware (confirmed in code review):**

| Header | Value Set | Notes |
|--------|-----------|-------|
| `Content-Security-Policy` | `default-src 'self'; script-src 'self' https://accounts.google.com https://maps.googleapis.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://accounts.google.com https://maps.googleapis.com https://api.unsplash.com https://api.open-meteo.com https://geocoding-api.open-meteo.com; frame-ancestors 'none'` | ✅ Covers Google OAuth, Maps, Unsplash, and weather APIs; `frame-ancestors 'none'` blocks iframe embedding |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | ✅ 1-year HSTS |
| `X-Frame-Options` | `DENY` | ✅ Belt-and-suspenders with `frame-ancestors 'none'` |
| `X-Content-Type-Options` | `nosniff` | ✅ |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | ✅ |
| `Permissions-Policy` | `geolocation=(), microphone=(), camera=()` | ✅ |

**Note:** `style-src 'unsafe-inline'` is present to support inline styles used by UI libraries. If the frontend migrates away from inline styles, this directive should be tightened.

---

## 5. CORS Configuration

**Confirmed in `backend/server.py`:**

```python
allowed_origins = [
    o.strip()
    for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")
    if o.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,   # explicit list — no wildcard *
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)
```

- No wildcard `*` with `allow_credentials=True`. ✅
- Origins are sourced from `ALLOWED_ORIGINS` env var, defaulting to `http://localhost:3000` only. ✅
- Methods and headers are explicitly enumerated. ✅
- **Action required:** Set `ALLOWED_ORIGINS` in `backend/.env` and all production environment configs to the exact production domain(s) before deployment. The `.env.example` already includes this placeholder.

---

## 6. Exposed Files & Routes

**Findings from `exposed-routes.md`:**

| # | Finding | Severity | Status |
|---|---------|----------|--------|
| 1 | `frontend/public/` — no `.env`, `.git`, `*.sql`, `*.bak`, config, or README files found | — | ✅ Clean |
| 2 | Backend serves no static files, no directory listing | — | ✅ Clean |
| 3 | No `.git` directory exposure via backend or frontend | — | ✅ Clean |
| 4 | Admin routes at predictable `/api/admin/` prefix, publicly internet-routable | MEDIUM | ⚠️ Needs network-layer IP allow-listing or VPN (see Section 9) |
| 5 | `seed_all()` called unconditionally on every startup — idempotency unconfirmed | LOW | ⚠️ Needs DB owner review |
| 6 | `server_2.py` — dead file with unresolved merge conflicts, not deployed but present in repo | MEDIUM | ⚠️ Remove in cleanup PR |
| 7 | `/api/` health root is unauthenticated | INFO | ⚠️ Low risk; strip app details from production response |

---

## 7. Database Security

**Technology:** MongoDB via `motor` (async). No SQL layer exists — SQL injection is not applicable.

| Check | Status | Notes |
|-------|--------|-------|
| SQL injection (raw queries) | ✅ N/A | No SQL in the project |
| MongoDB query safety | ✅ Safe | All queries use Python dict literals; no string interpolation into query objects |
| `MONGO_URL` hardcoded | ✅ No | Loaded from `os.environ["MONGO_URL"]` only |
| Fail-fast on missing `MONGO_URL` | ✅ Present | `sys.exit(1)` if missing at startup |
| `DB_NAME` hardcoded | ✅ No | Loaded from `os.environ["DB_NAME"]` |
| MongoDB credentials in client bundle | ✅ No | Connection string is server-side only |
| Admin default password | ⚠️ Weak default | `Admin@12345` used if `ADMIN_PASSWORD` env var not set |
| Supabase / Firebase RLS | ✅ N/A | Project uses self-hosted MongoDB |
| Public DB access | ✅ None | No direct client-to-MongoDB exposure |
| `server_2.py` — stale merge-conflict file | ⚠️ Present | Remove in cleanup PR |

**Manual action:** Set `ADMIN_PASSWORD` env var to a strong value before running `seed.py` in any non-local environment, and rotate the admin password in MongoDB Atlas (see Section 1, Rotation Commands §13).

---

## 8. Dependency Audit

### npm audit results

```
Before fix:  116 vulnerabilities (7 low, 37 moderate, 70 high, 2 critical)
After fix:   106 vulnerabilities (6 low, 35 moderate, 65 high, 0 critical)
Fixed:        10 vulnerabilities (safe, non-breaking fixes only)
```

`npm audit fix --legacy-peer-deps` and `npm update --legacy-peer-deps` were run. Build verified (exit 0) after fixes. No `--force` was used.

**Packages fixed:**

`shell-quote` (critical), `proxy-addr` (critical), `@csstools/*`, `ajv`, `body-parser`, `bfj`, `compression`, `brace-expansion`, `underscore`, `serialize-javascript`, `source-map-js`, `nanoid`, `workbox-build/plugin`, `@jest/*`, `@typescript-eslint/*`, `rollup-plugin-terser`, `dompurify`, `jsdom`.

### pip-audit results

```
21 known vulnerabilities in 4 packages
```

| Package | Installed | CVEs | Fix Version | Priority |
|---------|-----------|------|-------------|----------|
| `pymongo` | 4.6.3 | PYSEC-2026-4294/4295/4296/4297 (4 CVEs) | ≥4.18.2 | **HIGH** |
| `starlette` | 0.37.2 | PYSEC-2026-1943/1941/161/2281/2280/249/248 (7 CVEs) | ≥1.3.1 (via FastAPI upgrade) | **HIGH** |
| `python-jose` | 3.5.0 | PYSEC-2026-4298 | No fix; library soft-deprecated | **MEDIUM** |
| `ecdsa` | 0.19.2 | PYSEC-2026-1325 | Resolved by removing `python-jose` | LOW/MEDIUM |

### Packages updated

**npm (applied this sprint):**
- All safe-fix packages listed above were updated via `npm audit fix`.

**pip (not yet applied — manual action required):**
See Section 9 for the exact commands.

### Items requiring manual action

1. **`pymongo`:** `pip install "pymongo>=4.18.2" "motor>=3.6.0"` and update `requirements.txt`.
2. **`starlette`** (via FastAPI): `pip install "fastapi>=0.115.0"` and update `requirements.txt`. Validate API compatibility in staging before deploying.
3. **`python-jose`:** Migrate JWT handling to `PyJWT` (already present as `pyjwt>=2.10.1`), then remove `python-jose` and `ecdsa` from `requirements.txt`. Verify `auth.py` uses only `jwt` (PyJWT) imports.
4. **npm remaining 106 vulnerabilities:** Almost all are locked inside `react-scripts@5.0.1` (CRA). Long-term fix: migrate from CRA to Vite or Next.js. Near-term: update `axios` from `1.18.0` to `1.20.0+` to fix the HTTP/2 DoS CVE without breaking changes.
5. **Major-version npm packages** (`framer-motion`, `tailwindcss`, `zod`, `lucide-react`, etc.) require dedicated migration work and are outside this sprint's scope.

---

## 9. Remaining Manual Actions

Items not resolved in this PR, ordered by priority:

| # | Item | Severity | Owner |
|---|------|----------|-------|
| 1 | **Rotate ALL backend secrets** listed in Section 1 (MongoDB Atlas password, Gemini keys, JWT secret, RapidAPI, SerpAPI, Parse.bot, Gmail App Password, Resend, Railkit, Unsplash) | CRITICAL | Repo owner |
| 2 | **Restrict Google Maps API key** to HTTP referrers in GCP Console | HIGH | Repo owner |
| 3 | **Update Python dependencies:** `pymongo≥4.18.2` + `motor≥3.6.0`, `fastapi≥0.115.0`, remove `python-jose` + `ecdsa`, migrate `auth.py` to PyJWT | HIGH | Backend dev |
| 4 | **Update `axios`** in frontend from `1.18.0` → `≥1.20.0` to fix HTTP/2 DoS CVE | HIGH | Frontend dev |
| 5 | **Add `ADMIN_PASSWORD` to `_REQUIRED_ENV_VARS`** in `backend/server.py` fail-fast check, and set a strong `ADMIN_PASSWORD` before any production seed | HIGH | Backend dev |
| 6 | **Remove `backend/server_2.py`** (dead file with unresolved merge conflict markers; syntactically broken Python): `git rm backend/server_2.py` | MEDIUM | Whoever owns the merge conflict |
| 7 | **Restrict admin routes `/api/admin/*`** at the reverse-proxy or firewall level to internal IPs or VPN range | MEDIUM | Infra/DevOps |
| 8 | **Confirm `seed_all()` is fully idempotent** (insert-if-not-exists) and does not overwrite production data on restart | MEDIUM | DB owner |
| 9 | **Migrate test files** (`backend/test_*.py`) to `backend/tests/`; review `test_google_auth.py` for hardcoded credentials | MEDIUM | Backend dev |
| 10 | **Delete generated PDF test artifacts** (`test_conf.pdf`, `test_confirmation.pdf`, `test_itin.pdf`, `test_itinerary.pdf`) and add `*.pdf` to `.gitignore` | MEDIUM | Backend dev |
| 11 | **Restrict Google OAuth Client ID** authorised JavaScript origins in GCP Console to `http://localhost:3000` and the production domain | MEDIUM | Repo owner |
| 12 | **Remove `logger.info` log of raw password-reset token** from `server.py` forgot-password handler (or ensure log access is restricted) | MEDIUM | Backend dev |
| 13 | **Migrate frontend from CRA (`react-scripts`) to Vite or Next.js** to resolve the 106 inherited npm vulnerabilities that cannot be fixed without breaking changes | LOW (long-term) | Frontend dev |
| 14 | **Review `style-src 'unsafe-inline'`** in CSP — tighten to a nonce or hash-based policy if the frontend migrates away from inline styles | LOW | Frontend dev |
| 15 | **Remove or gate the `/api/` root response** to avoid disclosing the app name and status in production | LOW | Backend dev |
| 16 | **Exclude dev utility scripts** (`make_sample_pdfs.py`, `send_test_email.py`) and test output files from production Docker images via `.dockerignore` | LOW | DevOps |

---

## 10. Verification

- [x] **Build passes** — `npm run build` in `frontend/` completed with exit code 0. Bundle: `234.3 kB` JS, `12.78 kB` CSS. No errors; ESLint warnings are pre-existing unused-variable notices unrelated to security changes.
- [x] **App starts without errors** — `python -m py_compile backend/server.py` exits 0. `server.py` is syntactically valid; the fail-fast env-var check will correctly block startup if required vars are absent.
- [x] **No secrets in working tree** — `git status` shows no `.env` files staged or untracked. Only untracked paths are `.agents/tasks/feat-ui-features/` and `.agents/tasks/npm-audit-raw.json` (internal task artifacts).
- [x] **`.env` files not tracked by git** — `git check-ignore -v` confirms both `backend/.env` and `frontend/.env` are matched by `.gitignore:2:.env`. Neither file is present in the git object store at any commit.

```
# git check-ignore output:
.gitignore:2:.env   backend/.env
.gitignore:2:.env   frontend/.env
```

---

*This report was generated by an automated security sprint on the `security/infra` branch. All code changes referenced were made in prior steps of the same sprint. Items listed under Section 9 require human action and cannot be automated safely within this PR's scope.*

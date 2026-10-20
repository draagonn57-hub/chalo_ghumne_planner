# Task 6 — Exposed Files & Dev/Test Routes Audit

**Date:** 2025-07  
**Scope:** `frontend/public/`, `backend/server.py`, `backend/server_2.py`  
**Branch:** `security/infra`

---

## 1. `frontend/public/` — Sensitive File Check

**Files found in `frontend/public/` (recursive scan):**

| File | Sensitive? |
|------|-----------|
| `index.html` | No — normal SPA entry point |
| `assets/images/favicon.png` | No |
| `assets/images/image.png` | No |
| `assets/images/logo-full.jpg` | No |
| `assets/images/logo.png` | No |
| `assets/images/snow-mountain-bg.jpg` | No |

**Result: CLEAN.**  
No `.env` files, `.git` directories, `*.sql`, `*.bak`, `*.dump`, config files, README files, or any other sensitive content were found in the publicly-served `frontend/public/` directory. No files were removed.

---

## 2. Backend Static File Serving / Directory Listing

Scanned `server.py` and `server_2.py` for:
- `StaticFiles` mounts
- `FileResponse`
- `send_file`
- `app.mount()`
- directory listing / autoindex config

**Result: NO static file serving configured in either file.**  

Neither `server.py` nor `server_2.py` uses `fastapi.staticfiles.StaticFiles`, `fastapi.responses.FileResponse`, or any `app.mount()` call. The backend does **not** serve any directory over HTTP. There is no directory listing exposure.

---

## 3. Test / Dev Routes Inventory

> **Note to reviewer:** Route code was NOT modified. Documentation only.

### 3.1 `backend/server.py`

#### `/api/admin/*` — Admin Panel Routes (require `require_admin` dependency)

All admin routes require a valid JWT with `role == "admin"`. They are **not** publicly accessible but they are exposed endpoints worth noting for firewall/network-level controls.

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/admin/stats` | Aggregate counts: users, itineraries, destinations, hotels, feedback, popular destinations |
| GET | `/api/admin/users` | Full user list (password_hash excluded) |
| DELETE | `/api/admin/users/{uid}` | Deletes a user by id |
| POST | `/api/admin/destinations` | Create a destination record |
| DELETE | `/api/admin/destinations/{did}` | Delete a destination |
| POST | `/api/admin/hotels` | Create a hotel record |
| DELETE | `/api/admin/hotels/{hid}` | Delete a hotel |
| GET | `/api/admin/feedback` | List all feedback |
| DELETE | `/api/admin/feedback/{fid}` | Delete a feedback record |

**Risk:** Admin routes exist at a predictable `/api/admin/` prefix accessible from the public internet. Brute-force or token theft would give full data access. Mitigation: add network-layer IP allow-listing or move admin API to a separate internal port.

#### `seed_all()` — Startup Data Seeder

- `seed_all(db)` is called unconditionally in `@app.on_event("startup")` (server.py line ~2639).
- There is **no explicit HTTP `/seed` endpoint** in `server.py`. The seeder runs automatically on every app startup.
- **Risk:** If `seed_all` re-inserts demo data or resets collections on each boot in production, it could silently overwrite live data. Needs review by the DB/seeder owner to confirm idempotency.

#### `/api/` — Health / Root

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/` | Returns `{"message": "AI Tour Planner API", "status": "ok"}` — publicly accessible, no auth |

This is low risk but confirms the API is running. Consider moving behind auth or returning a static 200 with no version/environment details.

---

### 3.2 `backend/server_2.py`

`server_2.py` is a **conflict-state duplicate** of `server.py`. It contains unresolved Git merge conflict markers (`<<<<<<< Updated upstream` / `>>>>>>> Stashed changes`) and is not the active server entry point. It exposes the same admin routes documented above.

> **Action required (out of scope for this task):** `server_2.py` should be removed or merged and deleted. It is dead code with broken Python syntax due to merge conflicts and a security risk if accidentally deployed.

#### Seed call

Same pattern as `server.py`: `seed_all(db)` called in `@app.on_event("startup")`, no HTTP seed route.

#### Admin routes

Identical to `server.py` admin routes (see §3.1 table above). All require `require_admin`.

---

## 4. `.git` Directory Exposure Check

**Backend** (`server.py`, `server_2.py`): Neither file mounts or serves the project root, the `.git/` directory, or any parent directory via HTTP. No `StaticFiles`, `FileResponse`, or `app.mount()` calls exist. **No `.git` exposure via the backend.**

**Frontend** (`frontend/public/`): No `.git` directory found inside `frontend/public/`. Vite/React build output does not copy `.git` into `dist/` or `public/`. **No `.git` exposure via the frontend.**

---

## 5. Summary of Findings

| # | Finding | Severity | Status |
|---|---------|----------|--------|
| 1 | `frontend/public/` contains no sensitive files | — | ✅ Clean |
| 2 | No static file serving or directory listing in backend | — | ✅ Clean |
| 3 | No `.git` exposure via backend or frontend | — | ✅ Clean |
| 4 | Admin routes at predictable `/api/admin/` prefix, publicly routable | Medium | ⚠️ Document only — needs network-level controls |
| 5 | `seed_all()` runs on every startup — idempotency unconfirmed | Low | ⚠️ Needs DB owner review |
| 6 | `server_2.py` has unresolved merge conflicts + is dead code | Medium | ⚠️ Should be removed (separate PR, not this task) |
| 7 | `/api/` health root is unauthenticated | Info | ⚠️ Low risk; consider stripping env/version details |

---

## 6. Recommended Manual Actions

1. **Admin routes:** Restrict `/api/admin/*` at the reverse-proxy/firewall level to internal IPs or a VPN range, or require a separate admin JWT with shorter expiry.
2. **`seed_all()` on startup:** Confirm with the seeder owner that it is fully idempotent (insert-if-not-exists) and does not reset or overwrite production data.
3. **`server_2.py`:** Remove this file in a cleanup PR. It cannot be imported due to Python syntax errors from merge conflict markers.
4. **`/api/` root:** Return a generic 200 without any system or version information in production.

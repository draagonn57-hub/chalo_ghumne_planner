# DB Security Audit — Task 7

**Date:** 2025-07-15  
**Branch:** security/infra  
**Scope:** Database security review of all backend Python files.

---

## 1. Database Technology

The project uses **MongoDB** via `motor` (async Motor driver), **not** a relational SQL database. All database interaction is performed through Motor's document API (`find_one`, `update_one`, `insert_one`, `delete_one`, `aggregate`, etc.).

Files reviewed:
- `backend/server.py`
- `backend/seed.py`
- `backend/auth.py`
- `backend/transport_service.py`
- `backend/ai_service.py`
- `backend/email_service.py`
- `backend/image_service.py`
- `backend/pdf_service.py`
- `backend/server_2.py`

---

## 2. SQL Injection Scan

**Finding: No SQL queries exist in the codebase.**

A thorough search for:
- `cursor.execute()`
- `f"SELECT ..."`
- `"SELECT ... %s" % value`
- `"SELECT ...".format(...)`
- `psycopg2`, `sqlite3`, `SQLAlchemy`, `pymysql`, `mysql.connector`

…returned **zero matches**. There is no SQL layer in this project.

**MongoDB query safety:**  
MongoDB queries are constructed with Python dicts, which are natively parameterized by design. The Motor driver does not interpret user-controlled strings as query language. Example:

```python
# SAFE — dict-based query, no string interpolation
user = await db.users.find_one({"email": body.email.lower()})
await db.users.update_one({"id": user["id"]}, {"$set": update_doc})
```

No raw-string query construction was found anywhere.

**Verdict: No SQL injection vulnerabilities. No fixes required.**

---

## 3. Connection String — Source Check

| Config Key | Source | Hardcoded? |
|---|---|---|
| `MONGO_URL` | `os.environ["MONGO_URL"]` in `server.py` | ❌ No |
| `DB_NAME` | `os.environ["DB_NAME"]` in `server.py` | ❌ No |

Both are loaded from environment variables. `server.py` performs fail-fast startup validation:

```python
_REQUIRED_ENV_VARS = ["MONGO_URL", "DB_NAME", "JWT_SECRET", "GEMINI_API_KEY"]
_missing = [v for v in _REQUIRED_ENV_VARS if not os.environ.get(v)]
if _missing:
    sys.exit(1)
```

The server refuses to start if `MONGO_URL` or `DB_NAME` are absent. ✅

**Verdict: Connection string is properly externalized. No fixes required.**

---

## 4. Hardcoded Credential Default — MEDIUM Severity

**File:** `backend/seed.py`, lines 7–8

```python
ADMIN_EMAIL    = os.environ.get("ADMIN_EMAIL",    "admin@tourplanner.com")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "Admin@12345")
```

If `ADMIN_PASSWORD` is not set in the environment, the seeder creates the admin user with the weak default password `Admin@12345`. This value is a **known default** that an attacker could try.

**Risk:** If the environment variable is omitted in a production deployment, a predictable admin account is created.

**Fix applied:** None — this is a configuration/operations issue, not a code injection vulnerability. It is documented here as a **manual action**.

### ⚠️ Manual Action Required

1. Set `ADMIN_PASSWORD` to a strong, randomly generated value in `backend/.env` and all production environment configs:
   ```
   ADMIN_PASSWORD=<strong random password, 20+ chars>
   ```
2. After setting the env var, rotate the existing admin password in the database:
   ```js
   // MongoDB shell / Compass
   db.users.updateOne(
     { email: "admin@tourplanner.com" },
     { $set: { password_hash: "<new bcrypt hash>" } }
   )
   ```
   Or trigger a re-seed by deleting and recreating the admin user with the new password.
3. Consider making `ADMIN_PASSWORD` a **required** env var (add it to `_REQUIRED_ENV_VARS` in `server.py`) so the app fails fast rather than silently using a default.

---

## 5. Supabase / Firebase / RLS

This project does **not** use Supabase, Firebase, or any BaaS. It uses self-hosted MongoDB. Row Level Security (RLS) is a PostgreSQL / Supabase concept and does not apply here.

MongoDB access control is enforced at the application layer — every collection access in `server.py` checks `user["user_id"]` (and `user["role"] == "admin"` for admin routes) before reading or writing documents. This is the correct pattern for MongoDB.

**No RLS action required.**

---

## 6. Public Database Access

`MONGO_URL` is read from the environment and used only server-side. The MongoDB connection string is never sent to the client or included in any API response. The client has no direct database access.

**No public DB exposure found.**

---

## 7. Additional Observation — Stale File with Merge Conflict

**File:** `backend/server_2.py`

This file contains git merge conflict markers (`<<<<<<< Updated upstream`, `=======`, `>>>>>>> Stashed changes`) and appears to be a leftover duplicate of `server.py`. It is not referenced by any startup script and should be removed to avoid confusion.

**Manual action:** Delete `backend/server_2.py` when the merge conflict is resolved or confirmed as obsolete. This is outside the DB security scope but noted for completeness.

---

## 8. Summary

| Check | Status | Action |
|---|---|---|
| SQL injection in raw queries | ✅ Not applicable (no SQL) | None |
| MongoDB query parameterization | ✅ Safe (dict-based queries) | None |
| DB connection string hardcoded | ✅ Env var only | None |
| Fail-fast on missing MONGO_URL | ✅ Present | None |
| Admin password default fallback | ⚠️ Weak default `Admin@12345` | **Manual: set `ADMIN_PASSWORD` env var and rotate in DB** |
| Supabase RLS | ✅ N/A (uses MongoDB) | None |
| Public DB access | ✅ None found | None |
| `server_2.py` merge conflict | ⚠️ Stale file | **Manual: remove or resolve** |

# Dead Code Inventory
**Date:** 2025-07  
**Branch:** `security/infra`  
**Scope:** Backend Python files

---

## 1. `backend/server_2.py`

**Status: DEAD CODE — do NOT deploy**

### Evidence

- **Not imported anywhere.** A search across the entire repository (`grep -r server_2`) finds no `import server_2`, no `from server_2`, and no startup command referencing it. The active server entry point is `backend/server.py`.
- **Not referenced in any process manager or container config.** No `Procfile`, `Dockerfile`, `docker-compose.yml`, or `supervisord.conf` was found that names `server_2`.
- **Contains unresolved Git merge conflict markers.** The file has `<<<<<<< Updated upstream`, `=======`, and `>>>>>>> Stashed changes` blocks, which means it is a broken Python file — it will fail to parse and cannot be imported or run. Example:

  ```python
  <<<<<<< Updated upstream
  class CompareIn(BaseModel):
      class CompareIn(BaseModel):
  =======
      preferences: Dict[str, Any] = Field(default_factory=dict)
  >>>>>>> Stashed changes
  ```

- **Prior security audit confirms this.** `exposed-routes.md` and `db-security.md` (from earlier steps in this sprint) both document `server_2.py` as a stale conflict-state duplicate.

### Risk

If this file were accidentally passed to `uvicorn` as the app module, it would fail at import time with a `SyntaxError`. However, its presence in the repo is confusing and adds surface area for review.

### Recommended Action

Remove this file in a separate cleanup PR after confirming `server.py` is the sole entry point:

```bash
git rm backend/server_2.py
git commit -m "chore: remove dead server_2.py (merge-conflict leftover)"
```

**This deletion is out of scope for this security task** (task scope is dependency audit, not file deletion). Listed here for the owner to act on.

---

## 2. `backend/test_*.py` Files

**Status: TEST/DEV FILES — must not be deployed to production**

The following test scripts are present directly in the `backend/` directory alongside production code:

| File | Notes |
|---|---|
| `test_compare.py` | Tests destination comparison feature |
| `test_email_pdf.py` | Tests email + PDF generation |
| `test_explore_more.py` | Tests explore-more / recommendations |
| `test_google_auth.py` | Tests Google OAuth flow; **may contain test tokens or credentials** |
| `test_no_old_contact_email.py` | Tests that old contact email is not used |
| `test_otp_auth.py` | Tests OTP authentication logic |
| `test_pdf_service.py` | Tests PDF generation service |
| `test_recommend.py` | Tests recommendation engine |

### Issues

1. **These files live alongside production code** (`server.py`, `auth.py`, etc.) rather than in a dedicated `tests/` directory. This is non-standard and makes it harder to exclude them from Docker images or deployment tarballs.

2. **`test_google_auth.py` is notable** — OAuth test files sometimes hardcode test tokens, mock credentials, or CLIENT_ID values. It should be reviewed for embedded secrets before any public repo push.

3. **Generated test artifacts** (`.pdf` files) are also present:
   - `test_conf.pdf`
   - `test_confirmation.pdf`
   - `test_itin.pdf`
   - `test_itinerary.pdf`
   
   These are output from test runs and should be `.gitignore`d or deleted.

4. **`make_sample_pdfs.py` and `send_test_email.py`** are also dev-utility scripts that should not ship in a production image.

5. **`seed.py`** is called from `server.py` startup (`seed_all()`). This is intentional per the codebase but should be reviewed for idempotency by the DB owner (documented in `exposed-routes.md`).

### Recommended Action

1. Move all `test_*.py` files into `backend/tests/` before the next deployment.
2. Add `tests/`, `*.pdf`, `make_sample_pdfs.py`, `send_test_email.py` to `.dockerignore` (or equivalent).
3. Review `test_google_auth.py` for hardcoded credentials before any public push.
4. Delete the generated `.pdf` test artifacts from the repo (add `*.pdf` to `.gitignore`).

---

## 3. Other Potentially Dead / Dev-Only Files

| File | Status | Notes |
|---|---|---|
| `backend/make_sample_pdfs.py` | Dev utility | Generates sample PDFs; not imported by server. Should not be in production. |
| `backend/send_test_email.py` | Dev utility | Manual email test runner; not imported by server. May contain hardcoded recipients. |
| `backend/seed.py` | Active (called on startup) | Used intentionally; review idempotency with DB owner. |

---

## Summary

| File / Group | Verdict | Priority |
|---|---|---|
| `server_2.py` | Dead — remove in cleanup PR | HIGH |
| `test_*.py` (8 files) | Move to `tests/`; do not deploy | MEDIUM |
| `test_*.pdf` (4 files) | Delete from repo; add to `.gitignore` | MEDIUM |
| `make_sample_pdfs.py` | Dev-only; exclude from prod image | LOW |
| `send_test_email.py` | Dev-only; exclude from prod image | LOW |

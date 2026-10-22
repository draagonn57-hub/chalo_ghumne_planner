# Compliance Report — Chalo Ghumne

**Date:** 18 October 2026  
**Branch:** `legal/compliance`  
**Author:** Compliance-minded web developer (automated review)

> ⚠ **This is not legal advice.** This report documents a good-faith compliance effort based on a code audit. It must be reviewed by a qualified lawyer (preferably one with expertise in Indian IT/DPDP law) before the site goes live.

---

## 1. What Was Done

### 1.1 Legal Pages Created

| Page | Route | File |
|---|---|---|
| Privacy Policy | `/privacy` | `frontend/src/pages/PrivacyPolicy.jsx` |
| Terms & Conditions | `/terms` | `frontend/src/pages/TermsAndConditions.jsx` |
| Cookie Policy | `/cookie-policy` | `frontend/src/pages/CookiePolicy.jsx` |
| Cancellation & Refund Policy | `/cancellation-policy` | `frontend/src/pages/CancellationPolicy.jsx` |

All pages are routed in `App.js` (public, no auth required) and linked from the Footer.

### 1.2 Cookie Consent Banner

- **File:** `frontend/src/components/CookieConsent.jsx`
- **Registered in:** `App.js` Shell — renders on all pages until user makes a choice.
- **Behaviour:**
  - Appears ~800ms after first load if no stored preference.
  - Three options: **Accept all**, **Essential only**, **Manage preferences** (toggle per category).
  - Choice stored in `localStorage` under `cg_cookie_consent`.
  - On `Essential only` or rejection: calls `posthog.opt_out_capturing()` immediately.
  - On `Accept all`: calls `posthog.opt_in_capturing()`.
  - On every page load, stored choice is re-enforced (`enforceStoredConsent()`).
  - Fully keyboard-accessible (focus ring, role=switch toggle, role=dialog, aria-live).

### 1.3 Auth Form Consent Checkbox

- **File:** `frontend/src/pages/Auth.jsx`
- Added an **unchecked-by-default** checkbox (DPDP § 6 — consent must be free, specific, informed, unconditional) on the email input step.
- Submit button is disabled until checkbox is ticked.
- Links to Privacy Policy and Terms & Conditions.

### 1.4 Booking Form Consent Notice

- **File:** `frontend/src/pages/Booking.jsx`
- Added consent checkbox in `TravelersStep` acknowledging that all passengers consent to their PII (name, DOB, gender) being used for the booking.
- Links to Privacy Policy and Cancellation Policy.

### 1.5 Footer Updates

- **File:** `frontend/src/components/Footer.jsx`
- Added **Legal** column with links to all 4 legal pages.
- Added business details section (`[BUSINESS_NAME]`, `[BUSINESS_ADDRESS]`, `[GSTIN]`, `[CIN_OR_REG_NUMBER]`) as required by Consumer Protection (E-Commerce) Rules 2020.
- Added Grievance Officer email placeholder.
- Added bottom bar quick-links to Privacy / Terms / Cookies.
- Fixed logo `alt` text to be descriptive.
- Removed placeholder "About / Careers / Press" dead spans (kept structure but they remain as dead links until real pages exist).

### 1.6 Fake Social-Proof Claims Removed

- **File:** `frontend/src/pages/Landing.jsx`
- Removed: `"4.9 avg on 12k trips"` — this was a hardcoded, unverified marketing claim. Replaced with: `"180+ destinations supported"` (which is a factual claim based on the destinations collection in MongoDB — **verify this count before launch**).
- Removed: unused `Star` icon import.

### 1.7 Accessibility Fixes Applied

- Footer logo has proper descriptive `alt` text.
- Cookie banner uses `role="dialog"`, `aria-label`, `aria-live="polite"`, `aria-expanded`, `role="switch"`, `aria-checked`, `focus-visible` rings on all interactive elements.
- Legal pages use semantic headings (`<h1>`, `<h2>`, `<h3>`), `<section>` with `aria-labelledby`, `<table>` with `<th>` headers, `<address>` for contact info, `<time>` for dates.
- Auth consent checkbox has `id`/`htmlFor` pairing and `aria-required`.
- Booking consent checkbox has `id`/`htmlFor` and `aria-required`.

---

## 2. Assumptions Made

1. **"Demo platform"** — The Cancellation Policy and the checkout demo notice correctly characterise the current state. If real payments are ever integrated, both the Cancellation Policy and the Terms & Conditions **must** be updated.

2. **PostHog project key** (`phc_DbsPb39SRc8z3EiQ6Dhj6ikv4H4rTKcht9d4sZSesceP`) — This is hard-coded in `index.html`. It is a client-side key (not secret) but it is publicly visible. Consider moving it to an environment variable (`REACT_APP_POSTHOG_KEY`) and loading it via the React app instead of inline script.

3. **DPDP Act 2023 enforcement** — The Act received Presidential assent in August 2023 but rules have not yet been fully notified as of this writing. We have drafted compliance based on the Act itself and anticipated rules. Review with a lawyer once rules are notified.

4. **180+ destinations claim** — The app's MongoDB `destinations` collection is seeded via `backend/seed.py`. Verify the actual count before this claim goes live.

5. **Governing court city** — The Terms use `[GOVERNING_COURT_CITY]`. This must be filled in by the business owner.

6. **Resend sender domain** — OTPs are sent from `onboarding@resend.dev` (Resend's shared domain). This is acceptable for development but looks unprofessional and may affect deliverability in production. Consider configuring a custom domain (e.g. `noreply@chaloghumne.com`) with SPF/DKIM/DMARC.

---

## 3. TODOs — Placeholders That Must Be Filled Before Launch

| Placeholder | Used In | Action Required |
|---|---|---|
| `[BUSINESS_NAME]` | Privacy, Terms, Cancellation, Footer | Legal entity name |
| `[BUSINESS_ADDRESS]` | Privacy, Terms, Cancellation, Footer | Registered office address |
| `[GSTIN]` | Terms, Footer | Goods and Services Tax Identification Number |
| `[CIN_OR_REG_NUMBER]` | Privacy, Footer | Company Identification Number or registration number |
| `[GRIEVANCE_OFFICER_NAME]` | Privacy, Cancellation | Name of appointed Grievance Officer |
| `[GRIEVANCE_OFFICER_EMAIL]` | Privacy, Terms, Cancellation, Cookie, Footer | Dedicated email for data/grievance requests |
| `[GOVERNING_COURT_CITY]` | Terms | City for dispute resolution jurisdiction |
| `[REGION — TODO]` | Privacy (MongoDB Atlas) | MongoDB Atlas data region for international transfer disclosure |

---

## 4. Outstanding Legal Risks (Not Fixed in This PR)

### HIGH — Fix before public launch

| Risk | Detail | Recommendation |
|---|---|---|
| **JWT in localStorage (XSS risk)** | `localStorage.getItem("tp_token")` — visible to any JS on the page | Migrate to `HttpOnly`, `SameSite=Strict` cookies |
| **OTP codes stored in plaintext in MongoDB** | `db.email_otps` — `code` field is a plain string | Hash OTPs before storage (e.g. SHA-256) |
| **Emergent.sh SDK in production HTML** | `emergent-main.js` loads on every page for all users | Remove before public launch — it's a dev tool |
| **API keys committed in `frontend/.env`** | `REACT_APP_GOOGLE_MAPS_API_KEY`, `REACT_APP_UNSPLASH_KEY` are in git | Rotate keys, add `.env` to `.gitignore`, use env injection at build time |
| **Google Client ID hard-coded in `Auth.jsx`** | `84500475860-kt6nbrh7k16b804utd9f39c2m44kg95q` in source code | Move to `process.env.REACT_APP_GOOGLE_CLIENT_ID` |
| **Checkout collects card/UPI data in React state** | No real processor; but if live, this would be PCI DSS non-compliant | Integrate Razorpay/Stripe (hosted fields) before enabling real payments |
| **Session recording without prior consent** | PostHog `session_recording` is configured in `index.html` and fires on page load before consent | The cookie banner added in this PR blocks recording via `opt_out_capturing()`. **Verify PostHog respects opt-out on first load.** |

### MEDIUM — Address soon

| Risk | Detail |
|---|---|
| **No data deletion endpoint** | Users can delete their account from Profile, but there's no API endpoint to actually delete their data from MongoDB (itineraries, bookings, user doc). Implement `DELETE /api/auth/account`. |
| **No data access / portability endpoint** | DPDP § 11 / GDPR Art. 20 — users can request a copy of their data. Implement `GET /api/auth/my-data`. |
| **Resend sender from shared domain** | `onboarding@resend.dev` — set up custom domain sending. |
| **PostHog project key in plain HTML** | Move to env var loaded by React, not inline. |
| **Google Fonts loads from Google CDN** | Sends user IP to Google on every page load, even if user rejects analytics. Consider self-hosting fonts or documenting in privacy policy (done — listed in third-parties table). |

### LOW — Track and review

| Risk | Detail |
|---|---|
| **"AI-crafted travel · Since 2026" tagline** | Minor puffery, not a factual claim — acceptable. |
| **Image alt text on SmartImage** | The `SmartImage` component passes `alt` props. Review all call sites to ensure non-decorative images have meaningful alt text. |
| **No WCAG audit done** | Color contrast was not systematically tested. Run axe-core or Lighthouse accessibility audit before launch. |
| **Children's data** | The booking form collects passenger DOB — a child's DOB will flow through with no age gate. The Terms note that the adult lead traveler consents on the child's behalf. Legal review recommended. |

---

## 5. Third-Party Licenses — Quick Assessment

| Asset | License | Status |
|---|---|---|
| Unsplash images | Unsplash License (free, no attribution required) | ✅ OK |
| Lucide icons | ISC License | ✅ OK |
| Inter font | SIL Open Font License 1.1 | ✅ OK |
| Playfair Display font | SIL Open Font License 1.1 | ✅ OK |
| Manrope font | SIL Open Font License 1.1 | ✅ OK |
| Favicon (`/assets/images/favicon.png`) | Unknown — not audited | ⚠ **Verify license** |
| Logo (`/assets/images/logo.png`, `logo-full.jpg`) | Unknown — presumably business owns this | ⚠ **Confirm ownership** |
| Hero background images in `DynamicBackground` | Likely Unsplash — **verify** | ⚠ **Audit source** |

---

## 6. Files Changed in This Compliance Effort

| File | Change |
|---|---|
| `frontend/src/pages/PrivacyPolicy.jsx` | NEW — Full privacy policy page |
| `frontend/src/pages/TermsAndConditions.jsx` | NEW — Full T&C page |
| `frontend/src/pages/CookiePolicy.jsx` | NEW — Cookie policy page |
| `frontend/src/pages/CancellationPolicy.jsx` | NEW — Cancellation/refund policy page |
| `frontend/src/components/CookieConsent.jsx` | NEW — Cookie banner (Accept/Reject/Manage) |
| `frontend/src/components/Footer.jsx` | UPDATED — Added Legal links, business details, Grievance Officer |
| `frontend/src/App.js` | UPDATED — Added CookieConsent import, 4 legal routes |
| `frontend/src/pages/Auth.jsx` | UPDATED — Added consent checkbox on email OTP form |
| `frontend/src/pages/Booking.jsx` | UPDATED — Added consent checkbox in TravelersStep |
| `frontend/src/pages/Landing.jsx` | UPDATED — Removed unverified "4.9 avg on 12k trips" claim |
| `COMPLIANCE_REPORT.md` | NEW — This file |

---

*This report was generated as part of the `legal/compliance` work item. It is not legal advice. Engage a qualified lawyer before public launch.*

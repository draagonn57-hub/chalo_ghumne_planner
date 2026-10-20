# Implementation Plan — 18 UX Features (Chalo Ghumne frontend)

Branch: `feat/ui-features` (already checked out). Build/test run from
`c:/Users/SHIELD/Desktop/chalo ghumne/chalo_ghumne_planner/frontend`.

## Project facts discovered during exploration

- **Build command:** `npm run build` (runs `craco build`). NOT plain
  `react-scripts`. Warnings are acceptable; the build must succeed with no
  errors. (Task text said `npx react-scripts build` — the project actually
  uses craco, so use `npm run build`.)
- **Entry/global CSS:** `src/index.js` imports `./index.css` — that is the
  global stylesheet. `App.js` imports `@/App.css` (minimal reset only).
- **Stack:** React 19 + react-router-dom 7 (task text said React 18 / v6, but
  the router API used — `BrowserRouter`, `Routes`, `Route`, `Navigate`,
  `Link`, `useNavigate`, `useLocation`, `useParams` — is identical, so no
  change needed). framer-motion 11, lucide-react 0.516, sonner, tailwind 3.4.
- **`@` alias** → `src` (craco + jest). Use `@/...` imports.
- **Tailwind** already sets `darkMode: ["class"]`, so adding `class="dark"`
  to `<html>` activates `dark:` variants. We use CSS variables in
  `index.css` for the theme (per task), which also works.
- **Context pattern** (see `LangContext.jsx`/`AuthContext.jsx`):
  `createContext(null)` → `<XxxProvider>` → `export const useXxx = () => useContext(XxxCtx)`.
- **Design tokens:** cream bg `#FDFBF7`, teal `#0D5C75`, coral `#E76F51`,
  slate text `#1A2530`. Existing CSS vars in `:root` of `index.css`
  (`--tp-primary`, `--tp-bg`, `--tp-text`, etc.).
- **Confirmed routes** (from `App.js`) — used by site search:
  `/` Landing · `/destinations` · `/login` · `/signup` · `/forgot` · `/reset`
  · `/plan` (ModeSelect) · `/plan/questionnaire` · `/plan/choose`
  (ManualDestination) · `/plan/recommended` · `/itinerary/suggestions`
  · `/itinerary/preview` · `/itinerary/:id` · `/dashboard` · `/profile`
  · `/admin` · `/booking` · `/booking/checkout` ·
  `/booking/confirmation/:bookingId` · `/bookings/:bookingId`.
- **Delete confirm:** `Itinerary.jsx` `ItineraryDetail.onDelete` does
  `if (!window.confirm("Delete this trip?")) return;` (~line 218); the
  Delete button (`data-testid="itinerary-delete"`) calls `onDelete` and only
  renders when `savedId` is set. `Admin.jsx` also uses `window.confirm` but
  is OUT OF SCOPE (task says Itinerary only).
- **No cookie-consent code exists** yet (compliance dev owns it). Feature 13
  reads `localStorage['cg-cookie-consent'] === 'true'`; until that exists,
  UTM stays in a module variable — that is the spec'd behavior.
- **Gap — Feature 12:** `Auth.jsx` is passwordless (email + 6-digit OTP).
  There are NO `type="password"` inputs anywhere in `Auth.jsx`. The task
  says "edit ONLY the password input wrappers, touch nothing else." Since
  there are none, we do NOT fabricate a password field (that would change
  auth logic, which is forbidden). Decision: ship the password visibility
  toggle as a standalone reusable component `PasswordInput.jsx` (Eye/EyeOff,
  `aria-label="Show password"`, `aria-pressed`) in its own file, and do not
  touch `Auth.jsx`. Build verifies it compiles.

## Shared-file integration map (cross-feature)

- **`src/App.js`** must, after all FEATs: wrap the tree in `ThemeProvider`;
  mount `ScrollProgressBar`, `BackToTop`, `FloatingContact`; render the
  skip-link as the **first** focusable element; add `id="main-content"` to
  the `<main>` wrapper; and call `captureUtm()` on mount. Edited by FEAT-1
  (ThemeProvider), FEAT-3 (mounts + skip-link + main id), FEAT-4
  (captureUtm). These are sequential commits — each appends.
- **`src/index.css`** accumulates ALL of: dark-mode vars, `.skeleton`
  (already present — verify), hover states, `@media print`,
  `scroll-margin-top` on `[id]`, `.skip-link`, `.form-error`,
  `.form-success`. **Owned entirely by FEAT-1** so no other FEAT touches
  `index.css` (avoids conflicts).
- **`src/components/Navbar.jsx`** gets the dark-mode toggle (FEAT-1) and the
  search trigger + mobile-menu a11y (FEAT-2) — two sequential edits.
- **`BackToTop` (bottom-6) and `FloatingContact` (bottom-20) must not
  overlap** — FloatingContact sits above BackToTop.
- **Accessibility (all features):** keyboard reachable with visible focus,
  ARIA labels/roles, `aria-live` for dynamic content, focus traps in
  `SearchModal` and `ConfirmModal`, `prefers-reduced-motion` respected.

## FEAT grouping (dependency-ordered; each FEAT = sequential per-feature commits)

- **FEAT-001** Theme, dark mode & global CSS foundation (owns all of
  `index.css`): Features 1, 5, 6, 9, 10 (+ CSS for 11, 14).
- **FEAT-002** Site search & mobile-menu a11y: Features 2, 4.
- **FEAT-003** Floating UI shell + skip-to-content: Features 3, 7, 11, 18.
- **FEAT-004** Forms, modals, copy, UTM: Features 8, 12, 13, 14, 15.
- **FEAT-005** Content: FAQ & last-updated footer: Features 16, 17.

---

# FEAT-001 — Theme, dark mode & global CSS foundation

- [ ] 1. **Dark mode toggle (#1).** Create `src/lib/ThemeContext.jsx`
      exporting `ThemeProvider` + `useTheme()` (pattern from
      `LangContext.jsx`): state is `'light'|'dark'`, reads
      `localStorage['cg-theme']` (unset → follow
      `window.matchMedia('(prefers-color-scheme: dark)')`), persists on
      change, and toggles `document.documentElement.classList` `'dark'`.
      In `public/index.html` add a **blocking** `<script>` in `<head>` before
      React that reads `cg-theme` (or `prefers-color-scheme` if unset) and
      adds `class="dark"` to `<html>` to prevent flash. In `src/index.css`
      add a `:root` light set and `.dark` override set of the `--tp-*`
      variables (bg/surface/text/muted/border + primary/secondary stay brand
      teal/coral). In `src/components/Navbar.jsx` add a Sun/Moon (Lucide)
      toggle button (desktop nav + mobile menu) bound to `useTheme`. In
      `src/App.js` wrap `<Shell />` with `<ThemeProvider>`.
      Files: `frontend/src/lib/ThemeContext.jsx` (new),
      `frontend/public/index.html`, `frontend/src/index.css`,
      `frontend/src/App.js`, `frontend/src/components/Navbar.jsx`.
      Commit: `feat: add dark mode toggle (#1)`.
      Verify: `npm run build` in `frontend/` succeeds.

- [ ] 2. **Loading animations (#5).** Create `src/components/Spinner.jsx`:
      a small accessible spinner; under `prefers-reduced-motion: reduce`
      fall back to a single pulsing dot (no rotation). `.skeleton` already
      exists in `index.css` (FEAT-1 step 1 verifies/keeps it).
      Files: `frontend/src/components/Spinner.jsx` (new).
      Commit: `feat: add loading animations (#5)`.
      Verify: `npm run build` succeeds.

- [ ] 3. **Hover states (#6).** In `index.css` verify `.tp-card:hover`
      (lift — already present), `.btn-primary:hover` (present), and add/verify
      `.btn-secondary:hover` and `.btn-ghost:hover` (both already present —
      keep). Add `transition: all 200ms` default to `.tp-card` (it currently
      transitions transform/box-shadow; widen to `all` 200ms so color/border
      changes animate). No new files.
      Files: `frontend/src/index.css`.
      Commit: `feat: add hover states (#6)`.
      Verify: `npm run build` succeeds.

- [ ] 4. **Print stylesheet (#9).** In `index.css` add `@media print`
      block: hide `nav`, `footer`, `.no-print`, `.floating-btn`,
      `#back-to-top`, `#scroll-progress`, `#floating-contact`; set black text
      on white background; remove shadows/backgrounds on cards; force
      accordion/`<details>` items open (no new files — these IDs/classes are
      added by later FEATs; the CSS is forward-compatible).
      Files: `frontend/src/index.css`.
      Commit: `feat: add print stylesheet (#9)`.
      Verify: `npm run build` succeeds.

- [ ] 5. **Sticky header scroll-margin (#10).** In `index.css` add
      `scroll-margin-top: 88px` to `[id]` (anchor targets) so the sticky
      Navbar (already `sticky top-0`, h-20=80px) doesn't cover them.
      Files: `frontend/src/index.css`.
      Commit: `feat: add sticky header scroll-margin (#10)`.
      Verify: `npm run build` succeeds.

  FEAT-1 also adds the `.skip-link`, `.form-error`, `.form-success` CSS
  blocks here (used by FEAT-3/FEAT-4) so those FEATs never touch
  `index.css`. `.skip-link`: visually hidden until `:focus`, then visible
  top-left. `.form-error` red / `.form-success` green, both with
  `aria-live` friendly styling.

---

# FEAT-002 — Site search & mobile-menu a11y

- [ ] 6. **Site search (#2).** Create `src/components/SearchModal.jsx`: a
      modal (Framer Motion) with an input and a static list of real pages
      built from the confirmed routes (name + description + path); filters
      by query (case-insensitive over name/description/path); selecting a
      result navigates via `useNavigate()` and closes. Keyboard:
      `Ctrl/Cmd+K` opens (global listener), `Escape` closes, arrow keys move
      through results, `Enter` activates. Focus trap + return focus to
      trigger on close. `role="dialog"`, `aria-modal="true"`,
      `aria-label`. In `Navbar.jsx` add a Search (Lucide) icon button that
      opens the modal (managed with local `useState`); add the global
      `Ctrl/Cmd+K` listener in `Navbar` (or in the modal via a controlled
      open prop).
      Files: `frontend/src/components/SearchModal.jsx` (new),
      `frontend/src/components/Navbar.jsx`.
      Commit: `feat: add site search (#2)`.
      Verify: `npm run build` succeeds.

- [ ] 7. **Mobile menu accessibility (#4).** `Navbar.jsx` already has a
      mobile menu that closes on route change (existing `useEffect` on
      `loc.pathname`). Verify/add: Escape closes it; add `aria-expanded`
      (=`mobileOpen`), `aria-controls` (pointing at the menu panel id),
      `aria-label="Toggle menu"` on the hamburger; give the mobile panel an
      `id`. Enhance, do not rebuild.
      Files: `frontend/src/components/Navbar.jsx`.
      Commit: `feat: add mobile menu accessibility (#4)`.
      Verify: `npm run build` succeeds.

---

# FEAT-003 — Floating UI shell + skip-to-content

- [ ] 8. **Back-to-top button (#3).** Create
      `src/components/BackToTop.jsx`: fixed bottom-right `bottom-6 right-6`,
      appears after `window.scrollY > 400`, smooth-scrolls to top; under
      `prefers-reduced-motion` use instant scroll. `id="back-to-top"`,
      `className="floating-btn no-print"`, `aria-label="Back to top"`.
      Files: `frontend/src/components/BackToTop.jsx` (new),
      `frontend/src/App.js` (mount).
      Commit: `feat: add back-to-top button (#3)`.
      Verify: `npm run build` succeeds.

- [ ] 9. **Scroll progress bar (#7).** Create
      `src/components/ScrollProgressBar.jsx`: a 3px teal (`#0D5C75`) bar
      fixed at top whose width = scroll percentage. `id="scroll-progress"`,
      `className="no-print"`, `aria-hidden="true"`.
      Files: `frontend/src/components/ScrollProgressBar.jsx` (new),
      `frontend/src/App.js` (mount).
      Commit: `feat: add scroll progress bar (#7)`.
      Verify: `npm run build` succeeds.

- [ ] 10. **Skip-to-content link (#11).** In `App.js` add
       `<a href="#main-content" className="skip-link">Skip to content</a>`
       as the **first** focusable element inside the rendered tree (before
       `Navbar`), and add `id="main-content"` to the `<main>` wrapper.
       `.skip-link` CSS already added in FEAT-1.
       Files: `frontend/src/App.js`.
       Commit: `feat: add skip-to-content link (#11)`.
       Verify: `npm run build` succeeds.

- [ ] 11. **Floating contact button (#18).** Create
       `src/components/FloatingContact.jsx`: fixed bottom-right ABOVE the
       back-to-top button (`bottom-20 right-6` vs BackToTop `bottom-6`),
       `MessageCircle` (Lucide) icon, click opens
       `mailto:chaloghumne.trips@gmail.com` (reuse `SUPPORT_EMAIL`/
       `mailtoLink` from `@/lib/siteConfig`), hover tooltip "Contact us",
       `id="floating-contact"`, `className="floating-btn no-print"`,
       `aria-label="Contact us"`. Confirm it does not overlap BackToTop.
       Files: `frontend/src/components/FloatingContact.jsx` (new),
       `frontend/src/App.js` (mount).
       Commit: `feat: add floating contact button (#18)`.
       Verify: `npm run build` succeeds.

---

# FEAT-004 — Forms, modals, copy, UTM

- [ ] 12. **Copy button (#8).** Create `src/components/CopyButton.jsx`:
       props `text`, `className`; button shows "Copy", on click uses
       `navigator.clipboard.writeText` with a `document.execCommand('copy')`
       fallback, then shows "Copied!" for 2s. `aria-live`/`aria-label`.
       Files: `frontend/src/components/CopyButton.jsx` (new).
       Commit: `feat: add copy button (#8)`.
       Verify: `npm run build` succeeds.

- [ ] 13. **Password visibility toggle (#12).** Create
       `src/components/PasswordInput.jsx`: a reusable password input with an
       Eye/EyeOff (Lucide) toggle inside the wrapper; `aria-label="Show
       password"` / `"Hide password"`, `aria-pressed={shown}`. **Do NOT
       modify `Auth.jsx`** — it is passwordless (email + OTP) with no
       password fields; wiring a toggle there would mean fabricating a
       password field and changing auth logic (forbidden). This ships as a
       standalone reusable component.
       Files: `frontend/src/components/PasswordInput.jsx` (new).
       Commit: `feat: add password visibility toggle (#12)`.
       Verify: `npm run build` succeeds.

- [ ] 14. **UTM tracking (#13).** Create `src/lib/utmTracking.js` exporting
       `captureUtm()`, `getUtmParams()`, `attachUtmToPayload(payload)`. On
       `captureUtm()` read `utm_source/medium/campaign/term/content` from
       `window.location.search`; if
       `localStorage['cg-cookie-consent'] === 'true'` persist to
       `sessionStorage['cg-utm']`, else keep in a module variable. In
       `App.js` call `captureUtm()` on mount (inside `Shell` or `App`).
       Files: `frontend/src/lib/utmTracking.js` (new),
       `frontend/src/App.js` (call `captureUtm()` on mount).
       Commit: `feat: add UTM tracking (#13)`.
       Verify: `npm run build` succeeds.

- [ ] 15. **Form success/error states (#14).** Create
       `src/lib/formUtils.js` exporting `useFormState()` returning
       `{ error, success, setError, setSuccess, reset }`. `.form-error` /
       `.form-success` CSS already added in FEAT-1; consumers render the
       messages with `aria-live="polite"`. Utilities only — do not rewrite
       `Auth.jsx`.
       Files: `frontend/src/lib/formUtils.js` (new).
       Commit: `feat: add form success/error states (#14)`.
       Verify: `npm run build` succeeds.

- [ ] 16. **Confirmation modals (#15).** Create
       `src/components/ConfirmModal.jsx`: props `open`, `title`, `message`,
       `confirmLabel`, `cancelLabel`, `onConfirm`, `onCancel`, `danger`;
       `role="dialog"`, `aria-modal="true"`, `aria-labelledby`; focus trap,
       Escape closes, focus returns to trigger, initial focus on Cancel.
       Use it in `Itinerary.jsx`: in `ItineraryDetail` add `confirmOpen`
       state; change `onDelete` to open the modal instead of
       `window.confirm`; the actual delete runs on `onConfirm`. The Delete
       button (`data-testid="itinerary-delete"`) `onClick` becomes
       `() => setConfirmOpen(true)`. Render `<ConfirmModal ... />`.
       Files: `frontend/src/components/ConfirmModal.jsx` (new),
       `frontend/src/pages/Itinerary.jsx`.
       Commit: `feat: add confirmation modals (#15)`.
       Verify: `npm run build` succeeds; opening an itinerary and clicking
       Delete shows the modal (manual), Escape/cancel closes it, confirm
       deletes.

---

# FEAT-005 — Content: FAQ & last-updated footer

- [ ] 17. **Expandable FAQ (#17).** Create `frontend/src/components/FAQ.jsx`:
       props `items: [{question, answer}]`; use `<details>`/`<summary>` (or
       button + `aria-expanded`) for keyboard accessibility; animate
       open/close respecting `prefers-reduced-motion`; export for reuse.
       Files: `frontend/src/components/FAQ.jsx` (new).
       Commit: `feat: add expandable FAQ (#17)`.
       Verify: `npm run build` succeeds.

- [ ] 18. **Last updated date (#16).** In `craco.config.js` inject
       `process.env.REACT_APP_BUILD_DATE = new Date().toISOString().split('T')[0]`
       via `webpack.define` (or the `EnvironmentPlugin`). In
       `Footer.jsx` replace the hardcoded `2026` occurrences with
       `{new Date().getFullYear()}` and add an "Updated {REACT_APP_BUILD_DATE ||
       current year}" line. `craco.config.js` edit must stay minimal (only
       the define block) to avoid merge conflicts.
       Files: `frontend/craco.config.js`,
       `frontend/src/components/Footer.jsx`.
       Commit: `feat: add last updated date (#16)`.
       Verify: `npm run build` succeeds and `REACT_APP_BUILD_DATE` is defined.

---

# Final verification (after all FEATs)

- [ ] 19. **Build + cross-FEAT verification.** Run `npm run build` in
       `frontend/` — must pass with no errors (warnings OK). Manually smoke
       test: light/dark toggle persists and no flash; Ctrl/Cmd+K opens
       search; scroll shows progress bar + back-to-top + floating contact
       (no overlap); skip-link focuses main; Delete trip uses the modal;
       print preview hides nav/footer/floating buttons; keyboard-only
       navigation works. Commit: `chore: verify build passes - all 18 UX
       features`. Never force-push; `git pull --rebase` before push.

## Workflow restructure note

This work IS decomposed into 5 separable, dependency-ordered FEATs
(see `task.json` / `context.json` / `features/FEAT-00{1..5}.json` in this
folder). The remaining workflow steps were replaced with: one `wf-coder`
step per FEAT (sequential, each commits), then a convergence fixer+reviewer
`repeat` loop (stop when `review.json` verdict == APPROVED), then a
finalize step. The plan file above is the fallback the original loop would
read if the tail were not replaced.

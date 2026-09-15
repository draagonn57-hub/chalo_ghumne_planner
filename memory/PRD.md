# PRD — Voyage / AI Tour Planner

## Original problem statement
Import GitHub repo `https://github.com/draagonn57-hub/emergent_tour_planner`, set it up, and add new features. Follow the "Dynamic Rotating Background Photos" feature spec from the uploaded prompt (visual/UX layer only, no palette/typography/layout/functional changes).

## Architecture
- **Backend**: FastAPI (`/app/backend/server.py`), MongoDB Atlas (`sample_mflix` DB), JWT auth (bcrypt), Google Gemini (`gemini-2.5-flash`) via `google-genai` SDK.
- **Frontend**: React 19 + CRA/craco, Tailwind, Radix UI, Sonner, Framer Motion.
- **Routes**: `/`, `/destinations`, `/login`, `/signup`, `/forgot`, `/reset`, `/plan` (auth), `/itinerary/preview`, `/itinerary/:id`, `/dashboard`, `/profile`, `/admin`.

## Core requirements (static)
- AI-generated day-by-day itineraries from a preferences questionnaire.
- Auth (signup/login/forgot/reset), saved itineraries, admin panel, seeded destinations/hotels/admin user.
- Palette: teal `#0D5C75`, coral `#E76F51`, cream `#FDFBF7`. Fonts: Playfair Display + Manrope. Do not change.

## What's been implemented
- **2026-08-05** — Imported repo, wired MongoDB Atlas + Gemini + JWT, installed `google-genai`, removed broken `webpack-dev-server 5.2.6` resolution so `craco start` works. Snapshot tag: `baseline-import` (commit `327b103`).
- **2026-08-05** — Feature: Dynamic Rotating Background Photos (branch `feature-development`, commit `8e07c50`).
  - New `frontend/src/components/DynamicBackground.jsx` with `mode="static"` and `mode="cycle"` (12-photo crossfade pool, ~7s interval, preloads next image, respects `prefers-reduced-motion`).
  - Landing hero now uses `mode="cycle"` (replaces single Pexels image).
  - Auth pages (Login/Signup/Forgot/Reset) now use full-bleed still photo + centered glassmorphic card (`glass-card`, `animate-glass-pop`) with the Voyage tagline gracefully placed below.
  - Added CSS: `.glass-card`, `.animate-glass-pop`, `.dynamic-bg-fade`, plus a global `prefers-reduced-motion` override. No palette, typography, or working-screen layout changes.

## Backlog / Next tasks
- P1: Push `feature-development` to connected GitHub repo via **Save to Github** button in the chat input.
- P1: PDF export & shareable itinerary link.
- P1: Trip cost calculator & budget breakdown chart on itinerary detail.
- P2: Map view of itinerary (destinations + landmarks).
- P2: Weather forecast per day (Open-Meteo).
- P2: Extend the cycling background pool to any other large marketing sections that get added later.

## Notes
- Password-reset email is MOCKED — token is returned in `/api/auth/forgot-password` response (dev-only).
- Cycling background is disabled automatically when the OS `prefers-reduced-motion` is set.

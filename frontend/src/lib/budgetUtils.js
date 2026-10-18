/**
 * budgetUtils.js
 *
 * Single source of truth for budget tiers used across:
 *   - ManualDestination ("I'll pick my destination" mode)
 *   - Suggestions       ("Smart suggestions" mode)
 *   - Questionnaire     ("Help me decide" mode)  ← already existed; now reads from here
 *
 * The three string keys ("budget" | "mid-range" | "luxury") are the values
 * sent to the backend and must not change.
 */

import { Wallet } from "lucide-react";

/**
 * Returns per-person approximate budget ranges (in ₹) based on trip duration.
 *
 * Tier breakpoints (per person):
 *   Low  (budget)   : ~₹2k–5k/day  → displayed as range, min ₹7k–₹22k
 *   Mid  (mid-range): ~₹5k–12k/day → displayed as range, min ₹22k–₹55k
 *   High (luxury)   : ~₹12k+/day   → displayed as "from" figure, min ₹55k+
 *
 * @param {number} days  – trip duration (defaults to 5 when falsy)
 * @returns {{ budget: string, "mid-range": string, luxury: string }}
 */
export function getBudgetEstimates(days) {
  const d = Math.max(2, days || 5);

  const backpackerLow  = Math.round(Math.max(7_000,  d * 2_000) / 1_000) * 1_000;
  const backpackerHigh = Math.round(Math.max(22_000, d * 5_000) / 1_000) * 1_000;
  const moderateLow    = Math.round(Math.max(22_000, d * 5_000) / 1_000) * 1_000;
  const moderateHigh   = Math.round(Math.max(55_000, d * 12_000) / 1_000) * 1_000;
  const luxuryLow      = Math.round(Math.max(55_000, d * 12_000) / 1_000) * 1_000;

  const fmt = (n) =>
    n >= 100_000
      ? `₹${(n / 100_000).toFixed(1).replace(/\.0$/, "")}L`
      : `₹${(n / 1_000).toFixed(0)}k`;

  return {
    budget:      `${fmt(backpackerLow)} – ${fmt(backpackerHigh)} / person`,
    "mid-range": `${fmt(moderateLow)} – ${fmt(moderateHigh)} / person`,
    luxury:      `${fmt(luxuryLow)}+ / person`,
  };
}

/**
 * Ordered list of the three budget tiers.
 * Used to render the budget selection UI in any mode.
 *
 * v  — the backend key sent in the API payload
 * label — display name shown to the user
 * desc  — subtitle shown inside the card
 */
export const BUDGET_OPTIONS = [
  { v: "budget",    label: "Low Budget",  desc: "Affordable stays & local food",   icon: Wallet },
  { v: "mid-range", label: "Mid Budget",  desc: "Comfortable stays & experiences", icon: Wallet },
  { v: "luxury",    label: "High Budget", desc: "Premium stays & fine dining",     icon: Wallet },
];

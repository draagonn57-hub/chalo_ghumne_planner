/**
 * Single source of truth for site-wide configuration constants.
 * Import SUPPORT_EMAIL from here — never hard-code it in components.
 */
export const SUPPORT_EMAIL =
  process.env.REACT_APP_SUPPORT_EMAIL || "chaloghumne.trips@gmail.com";

/**
 * Returns a mailto: href with pre-filled subject.
 * subject is URL-encoded automatically.
 */
export function mailtoLink(subject = "Chalo Ghumne support") {
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`;
}

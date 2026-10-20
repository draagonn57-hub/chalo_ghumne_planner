/**
 * UTM tracking utilities.
 *
 * On captureUtm():
 *   - Parse utm_source/medium/campaign/term/content from the current URL.
 *   - If localStorage['cg-cookie-consent'] === 'true', persist to sessionStorage.
 *   - Otherwise, keep the values in a module-level variable (memory only).
 *
 * Use getUtmParams() to read the current UTM params anywhere.
 * Use attachUtmToPayload(payload) to merge UTMs into a form/API payload.
 */

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"];
const SESSION_KEY = "cg-utm";
const CONSENT_KEY = "cg-cookie-consent";

/** In-memory store for when consent has not been given */
let _memoryUtm = {};

function parseUtmFromSearch(search) {
  const params = new URLSearchParams(search);
  const utms = {};
  UTM_KEYS.forEach((k) => {
    const v = params.get(k);
    if (v) utms[k] = v;
  });
  return utms;
}

/**
 * Call once on app mount.
 * Reads UTM params from window.location.search and stores them
 * according to the consent setting.
 */
export function captureUtm() {
  if (typeof window === "undefined") return;
  const utms = parseUtmFromSearch(window.location.search);
  if (Object.keys(utms).length === 0) return; // nothing to capture

  _memoryUtm = utms;

  try {
    const consent = localStorage.getItem(CONSENT_KEY);
    if (consent === "true") {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(utms));
    }
  } catch {
    /* storage unavailable — memory-only is fine */
  }
}

/**
 * Returns the captured UTM params.
 * Prefers sessionStorage (when consent was given), falls back to memory.
 */
export function getUtmParams() {
  try {
    const consent = localStorage.getItem(CONSENT_KEY);
    if (consent === "true") {
      const stored = sessionStorage.getItem(SESSION_KEY);
      if (stored) return JSON.parse(stored);
    }
  } catch {
    /* ignore */
  }
  return _memoryUtm;
}

/**
 * Merges UTM params into a payload object.
 * Returns a new object — does not mutate the original.
 */
export function attachUtmToPayload(payload = {}) {
  const utms = getUtmParams();
  if (Object.keys(utms).length === 0) return payload;
  return { ...payload, _utm: utms };
}

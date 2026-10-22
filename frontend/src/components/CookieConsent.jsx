/**
 * CookieConsent — DPDP Act 2023 / GDPR compliant cookie banner.
 *
 * Blocks PostHog analytics until the user explicitly accepts.
 * Choice stored in localStorage under "cg_cookie_consent".
 *   "all"       — analytics accepted
 *   "essential" — analytics rejected (default / opt-in model)
 *   null/absent — no choice → banner shows
 */
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { X, ChevronDown, ChevronUp, Check } from "lucide-react";

const CONSENT_KEY = "cg_cookie_consent";

export function getConsentChoice() {
  try { return localStorage.getItem(CONSENT_KEY); } catch { return null; }
}

export function setConsentChoice(choice) {
  try {
    localStorage.setItem(CONSENT_KEY, choice);
    applyPostHogConsent(choice);
  } catch { /* localStorage unavailable */ }
}

function applyPostHogConsent(choice) {
  if (typeof window === "undefined" || !window.posthog) return;
  if (choice === "all") {
    if (typeof window.posthog.opt_in_capturing === "function") {
      window.posthog.opt_in_capturing();
    }
  } else {
    if (typeof window.posthog.opt_out_capturing === "function") {
      window.posthog.opt_out_capturing();
    }
  }
}

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [analyticsEnabled, setAnalyticsEnabled] = useState(false);

  useEffect(() => {
    // Enforce stored choice immediately on mount
    const stored = getConsentChoice();
    if (stored) {
      applyPostHogConsent(stored);
    } else {
      // No choice yet — opt out PostHog by default until user consents
      applyPostHogConsent("essential");
      const t = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(t);
    }
  }, []);

  if (!visible) return null;

  const handleAcceptAll = () => { setConsentChoice("all"); setVisible(false); };
  const handleEssentialOnly = () => { setConsentChoice("essential"); setVisible(false); };
  const handleSavePreferences = () => {
    setConsentChoice(analyticsEnabled ? "all" : "essential");
    setVisible(false);
  };

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label="Cookie preferences"
      aria-live="polite"
      className="fixed bottom-0 left-0 right-0 z-[100] sm:bottom-4 sm:left-4 sm:right-auto sm:max-w-sm"
    >
      <div className="bg-white border border-slate-200 shadow-2xl rounded-none sm:rounded-2xl p-5">

        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold text-[#1A2530] text-sm">🍪 Cookie Preferences</h2>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              We use essential cookies to keep you signed in. With your consent, we also collect analytics data (including session recordings) to improve the product.
            </p>
          </div>
          <button
            type="button"
            onClick={handleEssentialOnly}
            aria-label="Close and accept essential cookies only"
            className="shrink-0 text-slate-400 hover:text-slate-600 transition-colors p-1"
          >
            <X size={16} />
          </button>
        </div>

        <button
          type="button"
          onClick={() => setExpanded(e => !e)}
          className="mt-3 flex items-center gap-1 text-xs text-[#0D5C75] font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D5C75]"
          aria-expanded={expanded}
          aria-controls="cookie-manage-panel"
        >
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          {expanded ? "Hide details" : "Manage preferences"}
        </button>

        {expanded && (
          <div id="cookie-manage-panel" className="mt-3 space-y-3">
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
              <div>
                <p className="text-xs font-semibold text-slate-700">Essential</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Sign-in token, session state. Required for the site to work.</p>
              </div>
              <span className="text-xs font-semibold text-slate-400 bg-slate-200 px-2 py-0.5 rounded-full" aria-label="Always on">Always on</span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
              <div className="flex-1 pr-3">
                <p className="text-xs font-semibold text-slate-700">Analytics &amp; session recording</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  PostHog page views, clicks, and session recordings.{" "}
                  <Link to="/cookie-policy" className="underline text-[#0D5C75]">Cookie Policy</Link>.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={analyticsEnabled}
                aria-label={analyticsEnabled ? "Disable analytics cookies" : "Enable analytics cookies"}
                onClick={() => setAnalyticsEnabled(v => !v)}
                className={`relative shrink-0 w-10 h-6 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D5C75] focus-visible:ring-offset-1 ${analyticsEnabled ? "bg-[#0D5C75]" : "bg-slate-300"}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${analyticsEnabled ? "translate-x-4" : "translate-x-0"}`} />
                {analyticsEnabled && <Check size={10} className="absolute top-1 right-1 text-white" aria-hidden="true" />}
              </button>
            </div>

            <button
              type="button"
              onClick={handleSavePreferences}
              className="w-full py-2 text-sm font-semibold rounded-full border-2 border-[#0D5C75] text-[#0D5C75] hover:bg-[#0D5C75] hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D5C75]"
            >
              Save preferences
            </button>
          </div>
        )}

        {!expanded && (
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={handleEssentialOnly}
              className="flex-1 py-2 text-xs font-semibold rounded-full border border-slate-300 text-slate-600 hover:border-slate-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
            >
              Essential only
            </button>
            <button
              type="button"
              onClick={handleAcceptAll}
              className="flex-1 py-2 text-xs font-semibold rounded-full bg-[#0D5C75] text-white hover:bg-[#0A485C] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D5C75]"
            >
              Accept all
            </button>
          </div>
        )}

        <p className="mt-3 text-[10px] text-slate-400 leading-relaxed">
          "Accept all" consents to analytics cookies. "Essential only" blocks analytics. Change at any time.{" "}
          <Link to="/cookie-policy" className="underline hover:text-slate-600">Cookie Policy</Link>{" "}·{" "}
          <Link to="/privacy" className="underline hover:text-slate-600">Privacy Policy</Link>
        </p>
      </div>
    </div>
  );
}

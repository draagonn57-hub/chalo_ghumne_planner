/**
 * Cookie Policy — Chalo Ghumne
 */
import { useEffect } from "react";
import { Link } from "react-router-dom";

const LAST_UPDATED = "18 October 2026";

function Sec({ id, title, children }) {
  return (
    <section id={id} className="mt-10 scroll-mt-24" aria-labelledby={`${id}-h`}>
      <h2 id={`${id}-h`} className="font-display text-2xl sm:text-3xl tracking-tight text-[#1A2530]">{title}</h2>
      <div className="mt-4 space-y-4 text-slate-600 leading-relaxed text-sm sm:text-base">{children}</div>
    </section>
  );
}

export default function CookiePolicy() {
  useEffect(() => { document.title = "Cookie Policy — Chalo Ghumne"; }, []);
  return (
    <div className="max-w-4xl mx-auto px-6 py-12 sm:py-16" data-testid="cookie-policy-page">
      <p className="eyebrow text-[#0D5C75]">Legal</p>
      <h1 className="font-display text-4xl sm:text-5xl mt-2 tracking-tight text-[#1A2530]">Cookie Policy</h1>
      <p className="mt-3 text-slate-500 text-sm">Last updated: <time dateTime="2026-10-18">{LAST_UPDATED}</time></p>
      <p className="mt-4 text-slate-600 leading-relaxed">This Cookie Policy explains what cookies and similar tracking technologies Chalo Ghumne uses, why, and how to manage them.</p>

      <Sec id="what-are-cookies" title="1. What Are Cookies?">
        <p>Cookies are small text files stored in your browser. We also use <strong>localStorage</strong> and <strong>sessionStorage</strong> for temporary client-side state.</p>
      </Sec>

      <Sec id="cookies-we-use" title="2. Cookies and Storage We Use">
        <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-sm border-collapse min-w-[500px]">
            <thead><tr className="bg-slate-100 text-left">
              <th className="p-3 border border-slate-200 font-semibold">Name / Key</th>
              <th className="p-3 border border-slate-200 font-semibold">Type</th>
              <th className="p-3 border border-slate-200 font-semibold">Purpose</th>
              <th className="p-3 border border-slate-200 font-semibold">Expires</th>
              <th className="p-3 border border-slate-200 font-semibold">Consent?</th>
            </tr></thead>
            <tbody className="text-slate-700">
              {[
                ["tp_token","localStorage","Auth JWT — strictly necessary for sign-in","7 days","No — essential"],
                ["cg_cookie_consent","localStorage","Stores your cookie consent choice","Persistent","No — essential"],
                ["tp_geocode_cache_v1","localStorage","Caches place-name→coordinates lookups","Persistent","No — functional, no PII"],
                ["tp_last_itinerary / tp_last_suggestions","sessionStorage","Temporary itinerary during planning","Tab close","No — essential"],
                ["tp_pending_booking","sessionStorage","Temporary booking data during checkout","Tab close","No — essential"],
                ["ph_*","Cookie / localStorage","PostHog analytics: page views, clicks, session recordings","Up to 1 year","YES — analytics"],
                ["posthog","Cookie","PostHog session identifier","Session / 1 year","YES — analytics"],
              ].map(([name,type,purpose,expires,consent]) => (
                <tr key={name} className="even:bg-slate-50">
                  <td className="p-3 border border-slate-200 font-mono text-xs">{name}</td>
                  <td className="p-3 border border-slate-200">{type}</td>
                  <td className="p-3 border border-slate-200">{purpose}</td>
                  <td className="p-3 border border-slate-200">{expires}</td>
                  <td className={`p-3 border border-slate-200 font-medium ${consent.startsWith("YES") ? "text-[#E76F51]" : "text-slate-500"}`}>{consent}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Sec>

      <Sec id="third-party-cookies" title="3. Third-Party Tracking">
        <p><strong>PostHog (via Emergent.sh):</strong> When you consent, PostHog may set cookies and record sessions. See <a href="https://posthog.com/privacy" target="_blank" rel="noopener noreferrer" className="text-[#0D5C75] underline">posthog.com/privacy</a>.</p>
        <p><strong>Google Identity Services:</strong> Google's OAuth library may set cookies during sign-in. See <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-[#0D5C75] underline">Google's Privacy Policy</a>.</p>
        <p><strong>Google Fonts:</strong> Fonts loaded from Google CDN may log your IP address.</p>
        <p><strong>Emergent.sh SDK:</strong> A development SDK (<code>emergent-main.js</code>) is currently loaded on all pages. <strong>[TODO: remove before public launch]</strong></p>
      </Sec>

      <Sec id="no-ads" title="4. No Advertising Cookies">
        <p>We do <strong>not</strong> use advertising or marketing cookies. No Google Analytics (GA4/UA), Meta Pixel, LinkedIn Insight Tag, or retargeting cookies.</p>
      </Sec>

      <Sec id="managing-cookies" title="5. How to Manage Cookies">
        <ul className="list-disc pl-5 space-y-2">
          <li><strong>Cookie banner:</strong> Use Accept / Reject / Manage on first visit. <Link to="/" className="text-[#0D5C75] underline">Revisit our homepage</Link> after clearing cookies to see it again.</li>
          <li><strong>Browser settings:</strong> All major browsers allow you to block or delete cookies. Blocking essential localStorage keys may break sign-in.</li>
          <li><strong>Opt-out of PostHog:</strong> Email <a href="mailto:[GRIEVANCE_OFFICER_EMAIL]" className="text-[#0D5C75] underline">[GRIEVANCE_OFFICER_EMAIL]</a> and we will disable session recording for your account.</li>
        </ul>
      </Sec>

      <Sec id="changes" title="6. Changes">
        <p>We may update this policy. If changes are material, we will reset your consent preference so you are asked again.</p>
      </Sec>

      <div className="mt-12 pt-8 border-t border-slate-200">
        <div className="flex flex-wrap gap-4 text-sm">
          <Link to="/privacy" className="text-[#0D5C75] hover:underline font-medium">Privacy Policy</Link>
          <Link to="/terms" className="text-[#0D5C75] hover:underline font-medium">Terms &amp; Conditions</Link>
          <Link to="/cancellation-policy" className="text-[#0D5C75] hover:underline font-medium">Cancellation Policy</Link>
        </div>
      </div>
    </div>
  );
}

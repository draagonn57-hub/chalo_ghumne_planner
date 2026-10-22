/**
 * Privacy Policy — Chalo Ghumne
 * Tailored to: India DPDP Act 2023, IT Act 2000, Consumer Protection
 * (E-Commerce) Rules 2020. GDPR / CCPA notes included where relevant.
 *
 * Fill before launch: [BUSINESS_NAME] [BUSINESS_ADDRESS] [GRIEVANCE_OFFICER_NAME]
 * [GRIEVANCE_OFFICER_EMAIL] [GSTIN] [CIN_OR_REG_NUMBER]
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

export default function PrivacyPolicy() {
  useEffect(() => { document.title = "Privacy Policy — Chalo Ghumne"; }, []);
  return (
    <div className="max-w-4xl mx-auto px-6 py-12 sm:py-16" data-testid="privacy-policy-page">
      <p className="eyebrow text-[#0D5C75]">Legal</p>
      <h1 className="font-display text-4xl sm:text-5xl mt-2 tracking-tight text-[#1A2530]">Privacy Policy</h1>
      <p className="mt-3 text-slate-500 text-sm">Last updated: <time dateTime="2026-10-18">{LAST_UPDATED}</time></p>
      <p className="mt-4 text-slate-600 leading-relaxed">
        This Privacy Policy explains how <strong>[BUSINESS_NAME]</strong> operating as <strong>Chalo Ghumne</strong> collects, uses, shares, and protects personal data when you use our Service. It is written to comply with the <strong>Digital Personal Data Protection Act, 2023 (DPDP Act)</strong>, the IT Act 2000, the Consumer Protection (E-Commerce) Rules 2020, and, where applicable, the EU GDPR and the California CCPA.
      </p>
      <div className="mt-4 p-4 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-800">
        <strong>⚠ Not legal advice.</strong> Recommend review by a qualified lawyer before public launch.
      </div>

      <nav aria-label="Table of contents" className="mt-6 p-5 rounded-2xl bg-slate-50 border border-slate-200">
        <p className="text-xs uppercase tracking-widest font-semibold text-slate-500 mb-3">Contents</p>
        <ol className="space-y-1 text-sm columns-2 gap-4">
          {[
            ["#who-we-are","1. Who We Are"],["#what-we-collect","2. Data We Collect"],
            ["#how-we-use","3. How We Use Your Data"],["#legal-basis","4. Legal Basis"],
            ["#third-parties","5. Third-Party Services"],["#cookies","6. Cookies"],
            ["#retention","7. Data Retention"],["#your-rights","8. Your Rights"],
            ["#children","9. Children's Data"],["#security","10. Security"],
            ["#breach","11. Breach Notification"],["#international","12. International Transfers"],
            ["#grievance","13. Grievance Officer"],["#changes","14. Changes"],
          ].map(([href, label]) => (
            <li key={href}><a href={href} className="text-[#0D5C75] hover:underline font-medium">{label}</a></li>
          ))}
        </ol>
      </nav>

      <Sec id="who-we-are" title="1. Who We Are">
        <p><strong>[BUSINESS_NAME]</strong>, registered in India under <strong>[CIN_OR_REG_NUMBER]</strong>, with its principal office at <strong>[BUSINESS_ADDRESS]</strong>, is the Data Fiduciary under the DPDP Act and Data Controller under GDPR. GSTIN: <strong>[GSTIN]</strong>.</p>
      </Sec>

      <Sec id="what-we-collect" title="2. Data We Collect">
        <p className="font-semibold text-slate-700">2.1 Account &amp; Identity</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Email address</strong> — collected when you sign in via email OTP. Purpose: authentication. Basis: Contract.</li>
          <li><strong>Full name</strong> — from Google OAuth or profile settings. Purpose: personalisation. Basis: Contract.</li>
          <li><strong>Profile picture URL</strong> — from Google OAuth (optional). Basis: Contract.</li>
          <li><strong>Google account ID</strong> — opaque identifier to link Google account. Basis: Contract.</li>
        </ul>
        <p className="font-semibold text-slate-700 mt-4">2.2 Booking &amp; Traveler Data</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Lead traveler:</strong> full name, email address, phone number.</li>
          <li><strong>Per passenger:</strong> full name, date of birth, gender. <em>Date of birth is sensitive personal information used only for booking documents.</em></li>
          <li>Travel dates, origin city, destination — to generate itinerary and booking.</li>
        </ul>
        <p className="mt-2">Basis: Contract.</p>
        <p className="font-semibold text-slate-700 mt-4">2.3 Travel Preferences (Non-PII)</p>
        <p>Budget, trip duration, interests, companions, dietary preference, origin city. Used only to generate your itinerary — not linked to advertising profiles.</p>
        <p className="font-semibold text-slate-700 mt-4">2.4 Usage &amp; Analytics</p>
        <p>We use <strong>PostHog</strong> (proxied via Emergent.sh) to collect anonymised usage data including page views, clicks, and — for authenticated users who consent — <strong>session recordings</strong>. Basis: <strong>Consent</strong>.</p>
        <p className="font-semibold text-slate-700 mt-4">2.5 Payment Data (Demo Only)</p>
        <p>Our checkout is <strong>demonstration only</strong>. Payment form fields (card number, UPI ID etc.) are <strong>not transmitted to our servers</strong>. No real card data is stored.</p>
      </Sec>

      <Sec id="how-we-use" title="3. How We Use Your Data">
        <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-sm border-collapse min-w-[400px]">
            <thead><tr className="bg-slate-100 text-left">
              <th className="p-3 border border-slate-200 font-semibold">Purpose</th>
              <th className="p-3 border border-slate-200 font-semibold">Data Used</th>
              <th className="p-3 border border-slate-200 font-semibold">Legal Basis</th>
            </tr></thead>
            <tbody className="text-slate-700">
              {[
                ["Authenticate your account","Email, name, Google ID","Contract"],
                ["Send OTP verification codes","Email address","Contract"],
                ["Generate AI travel itinerary","Travel preferences (non-PII)","Contract"],
                ["Process & confirm bookings","Traveler PII, travel details","Contract"],
                ["Send booking confirmation emails","Email, name, booking details","Contract"],
                ["Improve the Service (analytics)","Usage data, session recordings","Consent"],
                ["Detect & prevent fraud","IP, usage patterns","Legitimate interest"],
                ["Comply with legal obligations","All categories as required","Legal obligation"],
              ].map(([p,d,b]) => (
                <tr key={p} className="even:bg-slate-50">
                  <td className="p-3 border border-slate-200">{p}</td>
                  <td className="p-3 border border-slate-200">{d}</td>
                  <td className="p-3 border border-slate-200">{b}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Sec>

      <Sec id="legal-basis" title="4. Legal Basis (DPDP Act 2023 / GDPR)">
        <ul className="list-disc pl-5 space-y-2">
          <li><strong>§ 7(a) Consent:</strong> Session recordings (PostHog), analytics cookies.</li>
          <li><strong>§ 7(b) Contract performance:</strong> Account creation, itinerary generation, booking, OTP delivery.</li>
          <li><strong>§ 7(f) Legal obligation:</strong> Tax records, government-mandated retention.</li>
        </ul>
        <p>For EU/EEA users (GDPR Art. 6), equivalent bases are: (a) Consent, (b) Contract, (c) Legal obligation, (f) Legitimate interests.</p>
      </Sec>

      <Sec id="third-parties" title="5. Third-Party Services">
        <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-sm border-collapse min-w-[500px]">
            <thead><tr className="bg-slate-100 text-left">
              <th className="p-3 border border-slate-200 font-semibold">Service</th>
              <th className="p-3 border border-slate-200 font-semibold">Purpose</th>
              <th className="p-3 border border-slate-200 font-semibold">Data Shared</th>
              <th className="p-3 border border-slate-200 font-semibold">Location</th>
            </tr></thead>
            <tbody className="text-slate-700">
              {[
                ["Google OAuth / GIS","Sign-in with Google","OAuth token","USA (SCCs)"],
                ["Google Maps Geocoding","Map/route planning","City name strings","USA (SCCs)"],
                ["Google Gemini AI","AI itinerary generation","Travel preferences (non-PII)","USA (SCCs)"],
                ["PostHog (via Emergent.sh)","Usage analytics, session recordings","Usage data, user ID","USA / EU (SCCs)"],
                ["Emergent.sh","Platform SDK","Page interactions","USA"],
                ["Unsplash","Destination images","Search query strings","USA"],
                ["Resend","OTP emails","Email address","USA (SCCs)"],
                ["Google Gmail SMTP","Booking confirmation emails","Name, email, booking summary","USA (SCCs)"],
                ["Open-Meteo","Weather forecasts","Lat/lng coordinates","Germany (EU)"],
                ["MongoDB Atlas","Primary database","All stored PII","[REGION — TODO]"],
                ["IRCTC data provider","Train schedules","Origin/destination cities","India"],
                ["SerpAPI","Flight search","Origin/destination cities","USA"],
              ].map(([s,p,d,l]) => (
                <tr key={s} className="even:bg-slate-50">
                  <td className="p-3 border border-slate-200 font-medium">{s}</td>
                  <td className="p-3 border border-slate-200">{p}</td>
                  <td className="p-3 border border-slate-200">{d}</td>
                  <td className="p-3 border border-slate-200">{l}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-slate-500 mt-2">SCCs = EU Standard Contractual Clauses. We do not sell your data for advertising.</p>
      </Sec>

      <Sec id="cookies" title="6. Cookies &amp; Tracking">
        <p>Please see our <Link to="/cookie-policy" className="text-[#0D5C75] underline font-medium">Cookie Policy</Link> for the full list of cookies and how to manage them. Essential cookies (auth token, session state) require no consent. Analytics cookies (PostHog session recording) require your explicit consent via the cookie banner.</p>
      </Sec>

      <Sec id="retention" title="7. Data Retention">
        <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-sm border-collapse min-w-[400px]">
            <thead><tr className="bg-slate-100 text-left">
              <th className="p-3 border border-slate-200 font-semibold">Data</th>
              <th className="p-3 border border-slate-200 font-semibold">Period</th>
              <th className="p-3 border border-slate-200 font-semibold">Reason</th>
            </tr></thead>
            <tbody className="text-slate-700">
              {[
                ["Account & profile","Until deletion + 30 days","Contract / legal"],
                ["OTP codes","10 minutes (auto-deleted)","Security"],
                ["Saved itineraries","Until deleted by user","User choice"],
                ["Booking records","7 years","Consumer Protection / tax law"],
                ["Analytics (PostHog)","Up to 1 year","Service improvement"],
                ["Server logs (IP etc.)","Up to 90 days","Security / fraud"],
              ].map(([d,r,reason]) => (
                <tr key={d} className="even:bg-slate-50">
                  <td className="p-3 border border-slate-200 font-medium">{d}</td>
                  <td className="p-3 border border-slate-200">{r}</td>
                  <td className="p-3 border border-slate-200">{reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Sec>

      <Sec id="your-rights" title="8. Your Rights">
        <ul className="list-disc pl-5 space-y-2">
          <li><strong>Right to access (§ 11):</strong> Request a summary of data we hold about you.</li>
          <li><strong>Right to correct (§ 12):</strong> Ask us to correct inaccurate data.</li>
          <li><strong>Right to erasure (§ 13):</strong> Ask us to delete your data (subject to legal obligations).</li>
          <li><strong>Withdraw consent (§ 6(4)):</strong> Withdraw consent for analytics at any time.</li>
          <li><strong>Grievance redressal (§ 13(3)):</strong> Lodge a complaint with our Grievance Officer.</li>
          <li><strong>Right to nominate (§ 14):</strong> Nominate someone to exercise rights in case of death/incapacity.</li>
        </ul>
        <p>To exercise any right, email <a href="mailto:[GRIEVANCE_OFFICER_EMAIL]" className="text-[#0D5C75] underline">[GRIEVANCE_OFFICER_EMAIL]</a> with subject "Data Rights Request". We respond within <strong>30 days</strong>. You can also delete your account from the Profile page.</p>
      </Sec>

      <Sec id="children" title="9. Children's Data">
        <p>Our Service is for persons aged <strong>18 and above</strong>. Under DPDP Act Section 9, processing data of a child (under 18) requires <strong>verifiable parental consent</strong>. If a child provides passenger details, the adult lead traveler consents on the child's behalf. If you believe a child registered without parental consent, contact <a href="mailto:[GRIEVANCE_OFFICER_EMAIL]" className="text-[#0D5C75] underline">[GRIEVANCE_OFFICER_EMAIL]</a>.</p>
      </Sec>

      <Sec id="security" title="10. Security">
        <ul className="list-disc pl-5 space-y-1">
          <li>HTTPS encryption for all data in transit.</li>
          <li>bcrypt hashing for passwords.</li>
          <li>JWT tokens with expiry.</li>
          <li>OTP codes valid for 10 minutes, invalidated after use or 5 failed attempts.</li>
          <li>No storage of real payment card numbers.</li>
        </ul>
        <div className="mt-3 p-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-800">
          <strong>Known gap (TODO):</strong> Auth tokens are stored in browser <code>localStorage</code> (XSS risk). Migration to HttpOnly cookies is planned.
        </div>
      </Sec>

      <Sec id="breach" title="11. Data Breach Notification">
        <p>In the event of a breach likely to result in risk to your rights and freedoms, we will notify the <strong>Data Protection Board of India</strong> within <strong>72 hours</strong> (DPDP § 8(6)) and notify affected users without undue delay. To report a suspected breach: <a href="mailto:[GRIEVANCE_OFFICER_EMAIL]" className="text-[#0D5C75] underline">[GRIEVANCE_OFFICER_EMAIL]</a>.</p>
      </Sec>

      <Sec id="international" title="12. International Transfers">
        <p>We use third-party services in the USA and EU. When personal data is transferred outside India, we ensure adequate safeguards (EU SCCs or equivalent). Once the Central Government publishes the notified countries list under DPDP § 16, this policy will be updated.</p>
      </Sec>

      <Sec id="grievance" title="13. Grievance Officer (India)">
        <p>As required under IT Act 2000 and DPDP Act 2023:</p>
        <address className="not-italic p-4 rounded-xl border border-slate-200 bg-slate-50 text-sm space-y-1 mt-2">
          <p>Name: <strong>[GRIEVANCE_OFFICER_NAME]</strong></p>
          <p>Email: <a href="mailto:[GRIEVANCE_OFFICER_EMAIL]" className="text-[#0D5C75] underline">[GRIEVANCE_OFFICER_EMAIL]</a></p>
          <p>Address: <strong>[BUSINESS_ADDRESS]</strong></p>
          <p>Response time: <strong>within 30 days</strong></p>
        </address>
      </Sec>

      <Sec id="changes" title="14. Changes to This Policy">
        <p>We may update this policy. Material changes will be notified on the website or by email at least 14 days before they take effect. The "Last updated" date at the top shows when it was last revised.</p>
      </Sec>

      <div className="mt-12 pt-8 border-t border-slate-200">
        <div className="flex flex-wrap gap-4 text-sm">
          <Link to="/terms" className="text-[#0D5C75] hover:underline font-medium">Terms &amp; Conditions</Link>
          <Link to="/cookie-policy" className="text-[#0D5C75] hover:underline font-medium">Cookie Policy</Link>
          <Link to="/cancellation-policy" className="text-[#0D5C75] hover:underline font-medium">Cancellation Policy</Link>
        </div>
      </div>
    </div>
  );
}

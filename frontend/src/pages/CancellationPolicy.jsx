/**
 * Cancellation & Refund Policy — Chalo Ghumne
 * NOTE: Currently demo-only — no real payments or bookings.
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

export default function CancellationPolicy() {
  useEffect(() => { document.title = "Cancellation & Refund Policy — Chalo Ghumne"; }, []);
  return (
    <div className="max-w-4xl mx-auto px-6 py-12 sm:py-16" data-testid="cancellation-policy-page">
      <p className="eyebrow text-[#0D5C75]">Legal</p>
      <h1 className="font-display text-4xl sm:text-5xl mt-2 tracking-tight text-[#1A2530]">Cancellation &amp; Refund Policy</h1>
      <p className="mt-3 text-slate-500 text-sm">Last updated: <time dateTime="2026-10-18">{LAST_UPDATED}</time></p>

      <div className="mt-6 p-5 rounded-2xl bg-[#0D5C75]/5 border border-[#0D5C75]/20 text-sm text-[#1A2530]">
        <p className="font-semibold text-[#0D5C75] mb-2">⚠ Demo Platform — No Real Bookings or Charges</p>
        <p>Chalo Ghumne is currently a <strong>demonstration platform</strong>. No real money is charged, no real flights or hotels are reserved. Because no real payments are processed, <strong>no real refunds are applicable at this time</strong>. This policy documents what terms would apply when a real payment integration is added.</p>
      </div>

      <Sec id="scope" title="1. Scope">
        <p>This policy applies to any paid bookings made through Chalo Ghumne. It is drafted in accordance with the <strong>Consumer Protection Act 2019</strong> and the <strong>Consumer Protection (E-Commerce) Rules 2020</strong>.</p>
      </Sec>

      <Sec id="demo-status" title="2. Current Status: Demo Only">
        <p>All bookings on this platform are simulated. No amount is debited from your account, card, or UPI. Any "booking confirmation" email you receive is a demonstration only.</p>
        <p><strong>If you believe a real charge has occurred</strong>, contact us immediately at <a href="mailto:[GRIEVANCE_OFFICER_EMAIL]" className="text-[#0D5C75] underline">[GRIEVANCE_OFFICER_EMAIL]</a>. This would be a billing error we will resolve promptly.</p>
      </Sec>

      <Sec id="future-policy" title="3. Future Refund Policy (When Live Payments Are Enabled)">
        <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-sm border-collapse min-w-[340px]">
            <thead><tr className="bg-slate-100 text-left">
              <th className="p-3 border border-slate-200 font-semibold">Cancellation timing</th>
              <th className="p-3 border border-slate-200 font-semibold">Refund amount</th>
            </tr></thead>
            <tbody className="text-slate-700">
              {[
                ["More than 30 days before travel","Full refund minus processing fee (up to 2%)"],
                ["15–30 days before travel","75% refund"],
                ["7–14 days before travel","50% refund"],
                ["Less than 7 days before travel","No refund (0%)"],
                ["No-show","No refund"],
              ].map(([timing,refund]) => (
                <tr key={timing} className="even:bg-slate-50">
                  <td className="p-3 border border-slate-200">{timing}</td>
                  <td className="p-3 border border-slate-200">{refund}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-slate-500 mt-2">Actual cancellation terms for flights, trains, and hotels are governed by the respective carrier or hotel. Our policy applies only to any service fee we charge.</p>
      </Sec>

      <Sec id="process" title="4. How to Cancel (Future)">
        <ol className="list-decimal pl-5 space-y-1">
          <li>Dashboard → Bookings → select booking → "Cancel booking"</li>
          <li>Email <a href="mailto:[GRIEVANCE_OFFICER_EMAIL]" className="text-[#0D5C75] underline">[GRIEVANCE_OFFICER_EMAIL]</a> with your booking ID</li>
        </ol>
        <p>Refunds will be processed to the original payment method within <strong>7–10 business days</strong>.</p>
      </Sec>

      <Sec id="consumer-rights" title="5. Consumer Rights (India)">
        <p>Under the <strong>Consumer Protection Act 2019</strong> and <strong>Consumer Protection (E-Commerce) Rules 2020</strong>, you have the right to:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>A clear upfront statement of cancellation and refund terms before payment.</li>
          <li>Timely refunds to the original payment method.</li>
          <li>Lodge a complaint with the National Consumer Helpline (1800-11-4000) if we fail to honour our commitments.</li>
          <li>Escalate to the District Consumer Forum if unresolved within 30 days.</li>
        </ul>
      </Sec>

      <Sec id="grievance" title="6. Grievances">
        <address className="not-italic p-4 rounded-xl border border-slate-200 bg-slate-50 text-sm space-y-1">
          <p>Name: <strong>[GRIEVANCE_OFFICER_NAME]</strong></p>
          <p>Email: <a href="mailto:[GRIEVANCE_OFFICER_EMAIL]" className="text-[#0D5C75] underline">[GRIEVANCE_OFFICER_EMAIL]</a></p>
          <p>Response time: <strong>within 30 days</strong></p>
        </address>
      </Sec>

      <div className="mt-12 pt-8 border-t border-slate-200">
        <div className="flex flex-wrap gap-4 text-sm">
          <Link to="/privacy" className="text-[#0D5C75] hover:underline font-medium">Privacy Policy</Link>
          <Link to="/terms" className="text-[#0D5C75] hover:underline font-medium">Terms &amp; Conditions</Link>
          <Link to="/cookie-policy" className="text-[#0D5C75] hover:underline font-medium">Cookie Policy</Link>
        </div>
      </div>
    </div>
  );
}

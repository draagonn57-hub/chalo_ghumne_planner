import { Link } from "react-router-dom";
import { SUPPORT_EMAIL, mailtoLink } from "@/lib/siteConfig";

export default function Footer() {
  return (
    <footer className="mt-24 border-t border-slate-200 bg-[#0D5C75] text-slate-100" data-testid="footer">
      <div className="max-w-7xl mx-auto px-6 sm:px-10 py-14 grid gap-10 md:grid-cols-4">
        <div>
          <div className="flex items-center gap-2">
            <img
              src="/assets/images/logo.png"
              alt="Chalo Ghumne"
              className="w-12 h-12 object-contain rounded-full bg-white/10"
            />
            <div className="font-display text-3xl">Chalo Ghumne</div>
          </div>
          <p className="text-slate-300 mt-4 max-w-xs leading-relaxed">
            Journeys designed by intelligence, told with soul. Your next
            adventure is a few questions away.
          </p>
        </div>

        <div>
          <div className="eyebrow text-slate-300">Explore</div>
          <ul className="mt-4 space-y-2.5 text-sm">
            <li><Link to="/destinations" className="text-slate-200 hover:text-white transition-colors">Destinations</Link></li>
            <li><Link to="/plan" className="text-slate-200 hover:text-white transition-colors">Plan a trip</Link></li>
            <li><Link to="/dashboard" className="text-slate-200 hover:text-white transition-colors">My trips</Link></li>
          </ul>
        </div>

        <div>
          <div className="eyebrow text-slate-300">Company</div>
          <ul className="mt-4 space-y-2.5 text-sm">
            <li><span className="text-slate-200">About</span></li>
            <li><span className="text-slate-200">Careers</span></li>
            <li><span className="text-slate-200">Press</span></li>
          </ul>
        </div>

        <div>
          <div className="eyebrow text-slate-300">Contact</div>
          <p className="mt-4 text-sm text-slate-200">
            <a
              href={mailtoLink("Chalo Ghumne support")}
              className="underline hover:text-white transition-colors select-text"
              data-testid="footer-support-email"
            >
              {SUPPORT_EMAIL}
            </a>
          </p>
          <a
            href={mailtoLink("Chalo Ghumne support")}
            className="inline-block mt-3 text-sm font-semibold text-white bg-white/10 hover:bg-white/20 transition-colors px-4 py-2 rounded-full"
            data-testid="footer-send-email-btn"
          >
            Send us an email
          </a>
          <p className="text-sm text-slate-400 mt-3">
            Made with wanderlust — {new Date().getFullYear()}
          </p>
          {process.env.REACT_APP_BUILD_DATE && (
            <p className="text-xs text-slate-400 mt-1">
              Updated {process.env.REACT_APP_BUILD_DATE}
            </p>
          )}
          <p className="text-xs text-slate-400 mt-2">Demo project · no real bookings</p>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="max-w-7xl mx-auto px-6 sm:px-10 py-5 text-xs text-slate-400 flex flex-wrap justify-between gap-2">
          <span>© {new Date().getFullYear()} Chalo Ghumne. All rights reserved.</span>
          <span>Powered by AI, crafted with care.</span>
        </div>
      </div>
    </footer>
  );
}

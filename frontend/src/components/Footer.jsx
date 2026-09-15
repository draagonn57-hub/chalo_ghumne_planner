import { Link } from "react-router-dom";
import { Compass } from "lucide-react";

export default function Footer() {
  return (
    <footer className="mt-24 border-t border-slate-200 bg-[#0D5C75] text-slate-100" data-testid="footer">
      <div className="max-w-7xl mx-auto px-6 sm:px-10 py-14 grid gap-10 md:grid-cols-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full bg-white/15 text-white flex items-center justify-center">
              <Compass size={18} strokeWidth={2.4} />
            </div>
            <div className="font-display text-3xl">Voyage</div>
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
          <p className="mt-4 text-sm text-slate-200">hello@voyage.travel</p>
          <p className="text-sm text-slate-400 mt-1">Made with wanderlust — 2026</p>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="max-w-7xl mx-auto px-6 sm:px-10 py-5 text-xs text-slate-400 flex flex-wrap justify-between gap-2">
          <span>© 2026 Voyage. All rights reserved.</span>
          <span>Powered by AI, crafted with care.</span>
        </div>
      </div>
    </footer>
  );
}

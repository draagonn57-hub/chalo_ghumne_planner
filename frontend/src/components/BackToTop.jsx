import { useState, useEffect } from "react";
import { ChevronUp } from "lucide-react";

/**
 * Back-to-top button — appears after scrolling 400px, smooth-scrolls to top.
 * Respects prefers-reduced-motion (instant scroll when reduced).
 */
export default function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 400);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToTop = () => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: prefersReduced ? "auto" : "smooth" });
  };

  if (!visible) return null;

  return (
    <button
      id="back-to-top"
      type="button"
      onClick={scrollToTop}
      aria-label="Back to top"
      className="floating-btn no-print fixed bottom-6 right-6 z-40 flex items-center justify-center w-11 h-11 rounded-full bg-[#0D5C75] text-white shadow-lg hover:bg-[#0A485C] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E76F51] focus-visible:ring-offset-2"
    >
      <ChevronUp size={20} />
    </button>
  );
}

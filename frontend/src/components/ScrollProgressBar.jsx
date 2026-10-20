import { useState, useEffect } from "react";

/**
 * Scroll progress bar — 3px teal bar fixed at the very top of the viewport.
 * aria-hidden since it's purely decorative.
 */
export default function ScrollProgressBar() {
  const [pct, setPct] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const el = document.documentElement;
      const scrolled = el.scrollTop || document.body.scrollTop;
      const total = el.scrollHeight - el.clientHeight;
      setPct(total > 0 ? (scrolled / total) * 100 : 0);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      id="scroll-progress"
      aria-hidden="true"
      className="no-print fixed top-0 left-0 z-50 h-[3px] bg-[#0D5C75] transition-[width] duration-75 ease-out"
      style={{ width: `${pct}%` }}
    />
  );
}

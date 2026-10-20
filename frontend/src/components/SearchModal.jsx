import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X, ArrowRight } from "lucide-react";

const ROUTES = [
  { name: "Home", description: "Landing page — start your journey", path: "/" },
  { name: "Destinations", description: "Browse and compare travel destinations", path: "/destinations" },
  { name: "Plan a Trip", description: "Choose how you want to plan your next trip", path: "/plan" },
  { name: "Trip Questionnaire", description: "Tell us your preferences for AI recommendations", path: "/plan/questionnaire" },
  { name: "Recommended Trips", description: "See AI-suggested itineraries", path: "/plan/recommended" },
  { name: "Choose Destination", description: "Manually select your destination", path: "/plan/choose" },
  { name: "Itinerary Suggestions", description: "View generated itinerary suggestions", path: "/itinerary/suggestions" },
  { name: "Dashboard", description: "Manage your saved trips", path: "/dashboard" },
  { name: "Profile", description: "View and edit your profile", path: "/profile" },
  { name: "Booking", description: "Book flights and hotels for your trip", path: "/booking" },
  { name: "Login", description: "Sign in to your account", path: "/login" },
  { name: "Sign Up", description: "Create a new account", path: "/signup" },
  { name: "Forgot Password", description: "Reset your account password", path: "/forgot" },
];

export default function SearchModal({ open, onClose }) {
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const nav = useNavigate();
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const results = query.trim()
    ? ROUTES.filter(
        (r) =>
          r.name.toLowerCase().includes(query.toLowerCase()) ||
          r.description.toLowerCase().includes(query.toLowerCase()) ||
          r.path.toLowerCase().includes(query.toLowerCase())
      )
    : ROUTES;

  // Reset state when opening
  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIdx(0);
      // Focus input after animation frame
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // Reset active index on query change
  useEffect(() => {
    setActiveIdx(0);
  }, [query]);

  const handleSelect = useCallback(
    (path) => {
      nav(path);
      onClose();
    },
    [nav, onClose]
  );

  const handleKeyDown = (e) => {
    if (e.key === "Escape") {
      onClose();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (results[activeIdx]) handleSelect(results[activeIdx].path);
    }
  };

  // Scroll active item into view
  useEffect(() => {
    const el = listRef.current?.children[activeIdx];
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIdx]);

  // Focus trap
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e) => {
      if (e.key === "Tab") {
        // Keep focus inside modal
        const focusable = inputRef.current?.closest('[role="dialog"]')
          ?.querySelectorAll('button, input, [tabindex]:not([tabindex="-1"])');
        if (!focusable || focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) { e.preventDefault(); last.focus(); }
        } else {
          if (document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Dialog */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Site search"
            initial={{ opacity: 0, scale: 0.95, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -8 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed left-1/2 top-[12vh] z-50 w-full max-w-lg -translate-x-1/2 rounded-2xl bg-white shadow-2xl dark:bg-[#233140] overflow-hidden"
            onKeyDown={handleKeyDown}
          >
            {/* Search input row */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 dark:border-slate-700">
              <Search size={18} className="text-slate-400 flex-shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search pages…"
                className="flex-1 bg-transparent text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 outline-none"
                aria-label="Search pages"
                aria-autocomplete="list"
                aria-controls="search-results"
                aria-activedescendant={results[activeIdx] ? `search-result-${activeIdx}` : undefined}
              />
              <button
                type="button"
                onClick={onClose}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                aria-label="Close search"
              >
                <X size={16} />
              </button>
            </div>

            {/* Results list */}
            <ul
              id="search-results"
              ref={listRef}
              role="listbox"
              aria-label="Search results"
              className="max-h-72 overflow-y-auto py-2"
            >
              {results.length === 0 ? (
                <li className="px-4 py-6 text-center text-sm text-slate-400">No pages found</li>
              ) : (
                results.map((r, i) => (
                  <li
                    key={r.path}
                    id={`search-result-${i}`}
                    role="option"
                    aria-selected={i === activeIdx}
                    className={`flex items-center justify-between px-4 py-2.5 cursor-pointer transition-colors ${
                      i === activeIdx
                        ? "bg-[#0D5C75]/8 text-[#0D5C75] dark:bg-[#0D5C75]/20 dark:text-[#5eead4]"
                        : "text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-white/5"
                    }`}
                    onClick={() => handleSelect(r.path)}
                    onMouseEnter={() => setActiveIdx(i)}
                  >
                    <div>
                      <div className="text-sm font-medium">{r.name}</div>
                      <div className="text-xs text-slate-400 mt-0.5">{r.description}</div>
                    </div>
                    <ArrowRight size={14} className="text-slate-300 dark:text-slate-500 flex-shrink-0" />
                  </li>
                ))
              )}
            </ul>

            {/* Footer hint */}
            <div className="border-t border-slate-100 dark:border-slate-700 px-4 py-2 flex items-center gap-4 text-[11px] text-slate-400">
              <span><kbd className="font-mono bg-slate-100 dark:bg-slate-700 px-1 rounded">↑↓</kbd> navigate</span>
              <span><kbd className="font-mono bg-slate-100 dark:bg-slate-700 px-1 rounded">↵</kbd> go</span>
              <span><kbd className="font-mono bg-slate-100 dark:bg-slate-700 px-1 rounded">Esc</kbd> close</span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

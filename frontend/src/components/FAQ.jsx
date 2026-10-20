import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * FAQ accordion — keyboard accessible, animated, prefers-reduced-motion safe.
 *
 * Props:
 *   items  Array<{ question: string, answer: string }>
 *   className  string (optional wrapper class)
 */
export default function FAQ({ items = [], className = "" }) {
  const [openIdx, setOpenIdx] = useState(null);

  const toggle = (idx) => setOpenIdx((cur) => (cur === idx ? null : idx));

  return (
    <div className={`space-y-2 ${className}`} role="list">
      {items.map((item, idx) => {
        const isOpen = openIdx === idx;
        const headingId = `faq-heading-${idx}`;
        const panelId = `faq-panel-${idx}`;

        return (
          <div
            key={idx}
            className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden"
            role="listitem"
          >
            <button
              id={headingId}
              type="button"
              onClick={() => toggle(idx)}
              aria-expanded={isOpen}
              aria-controls={panelId}
              className="w-full flex items-center justify-between px-5 py-4 text-left text-sm font-semibold text-slate-800 dark:text-slate-100 bg-white dark:bg-[#233140] hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
            >
              <span>{item.question}</span>
              <ChevronDown
                size={16}
                aria-hidden="true"
                className={`flex-shrink-0 text-slate-400 transition-transform duration-200 motion-reduce:transition-none ${
                  isOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  id={panelId}
                  role="region"
                  aria-labelledby={headingId}
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.22, ease: "easeInOut" }}
                  className="overflow-hidden"
                >
                  <div className="px-5 py-4 text-sm text-slate-600 dark:text-slate-300 bg-white dark:bg-[#233140] border-t border-slate-100 dark:border-slate-700 leading-relaxed">
                    {item.answer}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}

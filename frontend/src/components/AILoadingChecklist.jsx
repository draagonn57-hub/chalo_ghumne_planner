import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Loader as Loader2, Sparkles } from "lucide-react";

export default function AILoadingChecklist({
  steps = [],
  done = false,
  interval = 1800,
  onDone,
}) {
  const [activeStep, setActiveStep] = useState(0);
  const [allDone, setAllDone] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (allDone || activeStep >= steps.length - 1) return;
    const t = setTimeout(() => {
      setActiveStep((s) => Math.min(s + 1, steps.length - 1));
    }, interval);
    return () => clearTimeout(t);
  }, [activeStep, allDone, steps.length, interval]);

  useEffect(() => {
    if (!done) return;
    setAllDone(true);
    const t = setTimeout(() => setExiting(true), 600);
    const t2 = setTimeout(() => onDone?.(), 1100);
    return () => { clearTimeout(t); clearTimeout(t2); };
  }, [done, onDone]);

  if (exiting) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#FDFBF7]/95 backdrop-blur-sm"
      data-testid="ai-loading-checklist"
    >
      <div className="w-full max-w-lg px-6">
        <motion.div
          initial={{ scale: 0.96, y: 10 }}
          animate={{ scale: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.2, 0.9, 0.3, 1] }}
          className="tp-card p-8 sm:p-10"
        >
          <div className="flex items-center gap-3 mb-8">
            <motion.div
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              className="w-11 h-11 rounded-full bg-[#E76F51]/10 text-[#E76F51] flex items-center justify-center shrink-0"
            >
              <Sparkles size={22} />
            </motion.div>
            <h2 className="font-display text-2xl sm:text-3xl tracking-tight text-[#0A1E28]">
              Building your journey…
            </h2>
          </div>

          <div className="space-y-4">
            {steps.map((label, i) => {
              const isComplete = allDone || i < activeStep;
              const isActive = !allDone && i === activeStep;
              const isUpcoming = !allDone && i > activeStep;

              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: isUpcoming ? 0.4 : 1, x: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.05 }}
                  className="flex items-center gap-3"
                  data-testid={`loading-step-${i}`}
                >
                  <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0">
                    <AnimatePresence mode="wait">
                      {isComplete ? (
                        <motion.div
                          key="check"
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: "spring", stiffness: 400, damping: 15 }}
                          className="w-6 h-6 rounded-full bg-[#0D5C75] text-white flex items-center justify-center"
                        >
                          <Check size={14} strokeWidth={3} />
                        </motion.div>
                      ) : isActive ? (
                        <motion.div
                          key="spinner"
                          initial={{ scale: 0.8 }}
                          animate={{ scale: 1 }}
                          className="w-6 h-6 rounded-full border-2 border-[#E76F51]/30 border-t-[#E76F51] flex items-center justify-center"
                        >
                          <Loader2 size={14} className="text-[#E76F51] animate-spin" />
                        </motion.div>
                      ) : (
                        <motion.div
                          key="hollow"
                          initial={{ scale: 0.8 }}
                          animate={{ scale: 1 }}
                          className="w-6 h-6 rounded-full border-2 border-slate-200"
                        />
                      )}
                    </AnimatePresence>
                  </div>

                  <span className={`text-sm sm:text-base transition-colors ${
                    isComplete ? "text-[#0D5C75] font-semibold"
                      : isActive ? "text-[#1A2530] font-medium"
                      : "text-slate-400"
                  }`}>
                    {label}
                  </span>
                </motion.div>
              );
            })}
          </div>

          {!allDone && activeStep >= steps.length - 1 && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 2 }}
              className="mt-6 text-xs text-slate-400 italic"
            >
              Almost there…
            </motion.p>
          )}
        </motion.div>
      </div>
    </motion.div>
  );
}

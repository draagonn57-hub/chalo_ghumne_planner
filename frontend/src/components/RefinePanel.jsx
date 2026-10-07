import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, X, Send, TrendingDown, Mountain, Landmark, Clock, Utensils, Leaf } from "lucide-react";

const REFINEMENTS = [
  { key: "cheaper", label: "Make it cheaper", icon: TrendingDown },
  { key: "adventurous", label: "More adventurous", icon: Mountain },
  { key: "cultural", label: "More cultural experiences", icon: Landmark },
  { key: "less_travel", label: "Reduce travel time", icon: Clock },
  { key: "food", label: "More food experiences", icon: Utensils },
  { key: "relaxing", label: "Make it more relaxing", icon: Leaf },
];

export default function RefinePanel({ open, onClose, onSubmit, loading }) {
  const [selected, setSelected] = useState([]);
  const [customText, setCustomText] = useState("");

  const toggle = (key) => {
    setSelected((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleSubmit = () => {
    onSubmit({
      presets: selected,
      custom: customText.trim(),
    });
  };

  const canSubmit = (selected.length > 0 || customText.trim()) && !loading;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={loading ? undefined : onClose}
          data-testid="refine-overlay"
        >
          <motion.div
            initial={{ scale: 0.95, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 20 }}
            transition={{ duration: 0.25 }}
            className="bg-[#FDFBF7] rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            data-testid="refine-panel"
          >
            <div className="bg-[#0D5C75] text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center">
                  <Sparkles size={20} />
                </div>
                <div>
                  <h3 className="font-display text-lg leading-tight">
                    Improve my trip
                  </h3>
                  <p className="text-xs text-white/70 mt-0.5">
                    AI will adjust your itinerary — not regenerate it
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                disabled={loading}
                className="text-white/70 hover:text-white disabled:opacity-50 transition-colors"
                data-testid="refine-close"
              >
                <X size={20} />
              </button>
            </div>

            <div className="px-6 py-5 space-y-5">
              <div>
                <p className="text-sm font-semibold text-slate-700 mb-3">
                  What would you like to change?
                </p>
                <div className="grid grid-cols-2 gap-2.5">
                  {REFINEMENTS.map((r) => {
                    const Icon = r.icon;
                    const isSelected = selected.includes(r.key);
                    return (
                      <button
                        key={r.key}
                        onClick={() => toggle(r.key)}
                        disabled={loading}
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm transition-all ${
                          isSelected
                            ? "border-[#0D5C75] bg-[#0D5C75]/8 text-[#0D5C75] font-semibold"
                            : "border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                        } disabled:opacity-50`}
                        data-testid={`refine-option-${r.key}`}
                      >
                        <Icon size={16} className="shrink-0" />
                        <span className="text-left leading-tight">{r.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-700 mb-2 block">
                  Anything else?
                </label>
                <textarea
                  value={customText}
                  onChange={(e) => setCustomText(e.target.value)}
                  disabled={loading}
                  placeholder="e.g. I want to visit a specific museum, or avoid early mornings…"
                  rows={3}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-[#0D5C75] focus:ring-1 focus:ring-[#0D5C75]/20 disabled:opacity-50"
                  data-testid="refine-custom"
                />
              </div>
            </div>

            <div className="px-6 py-4 bg-[#FDFBF7] border-t border-slate-100 flex justify-end gap-3">
              <button
                onClick={onClose}
                disabled={loading}
                className="text-sm px-4 py-2 rounded-full border border-slate-300 text-slate-600 hover:bg-white disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="text-sm font-medium px-5 py-2 rounded-full bg-[#0D5C75] text-white hover:bg-[#0A4A5E] disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
                data-testid="refine-submit"
              >
                <Send size={14} />
                {loading ? "Refining…" : "Apply refinements"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

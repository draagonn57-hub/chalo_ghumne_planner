import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Utensils, Wallet, Sparkles, Users, Mountain, Music4, Landmark, Save as Waves, Leaf, ChefHat, ArrowLeft, ArrowRight, Check, Calendar, Globe, MapPin } from "lucide-react";
import AILoadingChecklist from "@/components/AILoadingChecklist";

const SUGGESTION_STEPS = [
  "Understanding your preferences",
  "Scouting destinations",
  "Matching your vibe",
];

const STEPS = [
  {
    key: "duration_days",
    title: "How many days?",
    sub: "Slide to your trip length.",
    type: "range",
  },
  {
    key: "budget_type",
    title: "Set your budget & travel scope",
    sub: "Choose your spending style and where you want to go.",
    type: "combined",
  },
  {
    key: "interests",
    title: "What sparks joy?",
    sub: "Pick as many as you like.",
    type: "multi",
    options: [
      { v: "nature", label: "Nature", icon: Leaf },
      { v: "adventure", label: "Adventure", icon: Mountain },
      { v: "culture", label: "Culture", icon: Landmark },
      { v: "nightlife", label: "Nightlife", icon: Music4 },
      { v: "relaxation", label: "Relaxation", icon: Waves },
      { v: "food", label: "Food", icon: Utensils },
    ],
  },
  {
    key: "companions",
    title: "Who's coming along?",
    sub: "The vibe follows the crew.",
    type: "choice",
    options: [
      { v: "solo", label: "Solo", desc: "Just me", icon: Users },
      { v: "couple", label: "Couple", desc: "Two travelers", icon: Users },
      { v: "family", label: "Family", desc: "With kids/parents", icon: Users },
      { v: "friends", label: "Friends", desc: "A group of us", icon: Users },
    ],
  },
];

/**
 * Returns per-person approximate budget ranges based on number of days.
 * Scales linearly from a base (2-day) rate.
 *
 * Tier breakpoints (per person):
 *   Backpacker : ~2,000–4,000 ₹/day  → range shown: (days × 2k) to (days × 4k), min 7k–10k
 *   Moderate   : ~4,500–9,000 ₹/day  → range shown: (days × 4.5k) to (days × 9k), min 22k–25k
 *   Luxury     : ~10,000+ ₹/day      → shown as (days × 10k)+ 
 */
function getBudgetEstimates(days) {
  const d = Math.max(2, days || 5);
  // Per user spec:
  //   3 days → backpacker 7–22k, moderate 22–55k, luxury 55k+
  //   5 days → backpacker 10–25k, moderate 25–60k, luxury 60k+
  const backpackerLow  = Math.round(Math.max(7000,  d * 2000)  / 1000) * 1000;
  const backpackerHigh = Math.round(Math.max(22000, d * 5000)  / 1000) * 1000;
  const moderateLow    = Math.round(Math.max(22000, d * 5000)  / 1000) * 1000;
  const moderateHigh   = Math.round(Math.max(55000, d * 12000) / 1000) * 1000;
  const luxuryLow      = Math.round(Math.max(55000, d * 12000) / 1000) * 1000;

  const fmt = (n) =>
    n >= 100000
      ? `₹${(n / 100000).toFixed(1).replace(/\.0$/, "")} L`
      : `₹${(n / 1000).toFixed(0)}k`;

  return {
    budget:      `${fmt(backpackerLow)} – ${fmt(backpackerHigh)} / person`,
    "mid-range": `${fmt(moderateLow)} – ${fmt(moderateHigh)} / person`,
    luxury:      `${fmt(luxuryLow)}+ / person`,
  };
}

const BUDGET_OPTIONS = [
  { v: "budget",    label: "Low Budget",    desc: "Affordable stays & local food",    icon: Wallet },
  { v: "mid-range", label: "Medium Budget", desc: "Comfortable stays & experiences",  icon: Wallet },
  { v: "luxury",    label: "High Budget",   desc: "Premium stays & fine dining",      icon: Wallet },
];

const DIET_OPTIONS = [
  { v: "veg", label: "Vegetarian", desc: "Plant-forward menus", icon: Leaf },
  { v: "non-veg", label: "Non-Vegetarian", desc: "Anything on the menu", icon: ChefHat },
];

const TRAVEL_TYPE_OPTIONS = [
  { v: "domestic", label: "Domestic", desc: "Travel within India", icon: MapPin },
  { v: "international", label: "International", desc: "Travel outside India", icon: Globe },
];

const DEFAULTS = {
  diet: "",
  budget: "",
  travel_type: "",
  duration_days: 5,
  start_date: "",
  interests: [],
  companions: "",
  origin: "",
};

const slideVariants = {
  enter: (direction) => ({ x: direction > 0 ? 40 : -40, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (direction) => ({ x: direction > 0 ? -40 : 40, opacity: 0 }),
};

export default function Questionnaire() {
  const nav = useNavigate();
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [state, setState] = useState(DEFAULTS);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);

  const current = STEPS[step];
  const isReview = step >= STEPS.length;
  const progress = ((step + 1) / (STEPS.length + 1)) * 100;

  const canProceed = () => {
    if (current?.type === "combined") return !!state.budget && !!state.travel_type;
    if (current?.type === "multi") return state.interests.length > 0 && !!state.diet;
    if (current?.type === "range") return state.duration_days > 0;
    return !!state[current?.key];
  };

  const pick = (value) => {
    if (current.type === "multi") {
      const updated = state.interests.includes(value)
        ? state.interests.filter((item) => item !== value)
        : [...state.interests, value];
      setState({ ...state, interests: updated });
    } else {
      setState({ ...state, [current.key]: value });
    }
  };

  const goNext = () => { setDirection(1); setStep(step + 1); };
  const goBack = () => { setDirection(-1); setStep(Math.max(0, step - 1)); };

  const generate = async () => {
    setBusy(true);
    setLoading(true);
    try {
      const payload = { ...state, duration_days: Number(state.duration_days) };
      const { data } = await api.post("/itinerary/generate", payload);
      sessionStorage.setItem("tp_last_suggestions", JSON.stringify(data));
      sessionStorage.removeItem("tp_explored_history");
      toast.success("Four destinations are ready to explore");
      setLoading(false);
      setTimeout(() => nav("/itinerary/suggestions"), 300);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "AI failed. Try again.");
      setLoading(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-10 sm:py-16" data-testid="wizard">
      {/* Outer white card wrapping progress bar + all step content */}
      <div className="tp-card p-8 sm:p-10">

      {/* Progress — segmented step dots */}
      <div className="mb-10">
        <div className="flex items-center justify-between text-sm">
          <span className="eyebrow">
            Step {Math.min(step + 1, STEPS.length + 1)} of {STEPS.length + 1}
          </span>
          <span className="text-slate-500 font-medium">{Math.round(progress)}%</span>
        </div>
        <div className="mt-3 flex gap-1.5">
          {Array.from({ length: STEPS.length + 1 }).map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${
                i <= step ? "bg-[#E76F51]" : "bg-slate-100"
              }`}
            />
          ))}
        </div>
        <div className="mt-2 flex justify-between text-xs text-slate-400">
          <span>Duration</span>
          <span>Budget</span>
          <span>Interests</span>
          <span>Crew</span>
          <span>Review</span>
        </div>
      </div>

      <AnimatePresence mode="wait" custom={direction}>
        {!isReview ? (
          <motion.div
            key={step}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.3, ease: [0.2, 0.9, 0.3, 1] }}
          >
            <p className="eyebrow">{current.sub}</p>
            <h2 className="font-display text-4xl sm:text-5xl mt-3 tracking-tight" data-testid="wizard-title">
              {current.title}
            </h2>

            <div className="mt-10">
              {current.type === "range" ? (
                <div className="p-2">
                  <div className="flex items-baseline gap-3">
                    <motion.span
                      key={state.duration_days}
                      initial={{ scale: 0.9, opacity: 0.5 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ duration: 0.2 }}
                      className="font-display text-6xl"
                    >
                      {state.duration_days}
                    </motion.span>
                    <span className="text-slate-500">days</span>
                  </div>
                  <input
                    type="range"
                    min={2}
                    max={21}
                    value={state.duration_days}
                    onChange={(e) => setState({ ...state, duration_days: Number(e.target.value) })}
                    className="w-full mt-6 accent-[#E76F51]"
                    data-testid="wizard-duration"
                  />
                  <div className="flex justify-between text-xs text-slate-400 mt-2">
                    <span>2</span>
                    <span>21</span>
                  </div>
                  <label className="block mt-8">
                    <span className="text-xs uppercase tracking-widest text-slate-500 font-semibold flex items-center gap-1.5">
                      <Calendar size={12} />
                      Trip start date (optional)
                    </span>
                    <input
                      type="date"
                      value={state.start_date}
                      min={new Date().toISOString().split("T")[0]}
                      onChange={(e) => setState({ ...state, start_date: e.target.value })}
                      className="mt-2 w-full px-4 py-3 rounded-xl border border-slate-200 bg-white focus:border-[#E76F51] focus:outline-none transition-colors"
                      data-testid="wizard-start-date"
                    />
                    {state.start_date && (
                      <button
                        onClick={() => setState({ ...state, start_date: "" })}
                        className="text-xs text-slate-400 hover:text-[#E76F51] mt-1.5"
                        data-testid="wizard-start-date-clear"
                      >
                        Clear date
                      </button>
                    )}
                  </label>
                  <label className="block mt-4">
                    <span className="text-xs uppercase tracking-widest text-slate-500 font-semibold">
                      Origin city (optional)
                    </span>
                    <input
                      value={state.origin}
                      onChange={(e) => setState({ ...state, origin: e.target.value })}
                      placeholder="e.g. Mumbai"
                      className="mt-2 w-full px-4 py-3 rounded-xl border border-slate-200 bg-white focus:border-[#E76F51] focus:outline-none transition-colors"
                      data-testid="wizard-origin"
                    />
                  </label>
                </div>
              ) : current.type === "combined" ? (
                <div className="space-y-8">
                  <div>
                    <div className="flex items-center gap-2 mb-5">
                      <div className="w-8 h-8 rounded-full bg-[#E76F51]/10 text-[#E76F51] flex items-center justify-center text-sm font-bold">1</div>
                      <h3 className="font-display text-2xl">Spending style</h3>
                    </div>
                    {(() => {
                      const estimates = getBudgetEstimates(state.duration_days);
                      return (
                        <div className="grid gap-4 sm:grid-cols-3">
                          {BUDGET_OPTIONS.map((option) => (
                            <BudgetChoice
                              key={option.v}
                              option={option}
                              estimate={estimates[option.v]}
                              selected={state.budget === option.v}
                              onClick={() => setState({ ...state, budget: option.v })}
                              testId={`choice-budget-${option.v}`}
                            />
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                  <div className="h-px bg-slate-100" />
                  <div>
                    <div className="flex items-center gap-2 mb-5">
                      <div className="w-8 h-8 rounded-full bg-[#E76F51]/10 text-[#E76F51] flex items-center justify-center text-sm font-bold">2</div>
                      <h3 className="font-display text-2xl">Travel type</h3>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      {TRAVEL_TYPE_OPTIONS.map((option) => (
                        <Choice
                          key={option.v}
                          option={option}
                          selected={state.travel_type === option.v}
                          onClick={() => setState({ ...state, travel_type: option.v })}
                          testId={`choice-travel-type-${option.v}`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              ) : current.type === "multi" ? (
                <div>
                  <div className="flex items-start gap-3 px-5 py-4 rounded-2xl bg-[#E76F51]/5 border border-[#E76F51]/15 mb-8">
                    <Sparkles size={18} className="text-[#E76F51] mt-0.5 shrink-0" />
                    <div>
                      <span className="font-semibold text-slate-800 text-sm">Make it your kind of trip!</span>
                      <p className="text-slate-500 text-sm mt-0.5">Choose as many interests as you like. Mix and match your favorites to create a trip that suits you.</p>
                    </div>
                  </div>
                  <div className={`grid gap-4 ${current.options.length > 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
                    {current.options.map((option) => (
                      <Choice
                        key={option.v}
                        option={option}
                        selected={state.interests.includes(option.v)}
                        onClick={() => pick(option.v)}
                        testId={`choice-${current.key}-${option.v}`}
                        multi
                      />
                    ))}
                  </div>
                  {/* Food Preference — separated section */}
                  <div className="mt-10">
                    <div className="h-px bg-slate-100 mb-8" />
                    <div className="flex items-center gap-2 mb-5">
                      <div className="w-8 h-8 rounded-full bg-[#E76F51]/10 text-[#E76F51] flex items-center justify-center text-sm font-bold">
                        <Utensils size={14} />
                      </div>
                      <h3 className="font-display text-2xl">Food preference</h3>
                    </div>
                    <p className="text-slate-500 text-sm mb-5">This determines your dietary requirements — not the same as the Food interest above.</p>
                    <div className="grid gap-4 sm:grid-cols-2">
                      {DIET_OPTIONS.map((option) => (
                        <Choice
                          key={option.v}
                          option={option}
                          selected={state.diet === option.v}
                          onClick={() => setState({ ...state, diet: option.v })}
                          testId={`choice-diet-${option.v}`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className={`grid gap-4 ${current.options.length > 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
                  {current.options.map((option) => (
                    <Choice
                      key={option.v}
                      option={option}
                      selected={state[current.key] === option.v}
                      onClick={() => pick(option.v)}
                      testId={`choice-${current.key}-${option.v}`}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="mt-10 flex items-center justify-between">
              <button
                onClick={goBack}
                className="btn-ghost flex items-center gap-1 disabled:opacity-40"
                disabled={step === 0}
                data-testid="wizard-back"
              >
                <ArrowLeft size={16} />
                Back
              </button>
              <button
                onClick={goNext}
                disabled={!canProceed()}
                className="btn-primary flex items-center gap-2 disabled:opacity-50"
                data-testid="wizard-next"
              >
                {step === STEPS.length - 1 ? "Review" : "Next"}
                <ArrowRight size={16} />
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="review"
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.3, ease: [0.2, 0.9, 0.3, 1] }}
            data-testid="wizard-review"
          >
            <p className="eyebrow">Almost there</p>
            <h2 className="font-display text-4xl sm:text-5xl mt-3 tracking-tight">
              Ready to discover?
            </h2>
            <p className="text-slate-500 mt-3">
              We'll find four destinations that fit your travel style.
            </p>
            <div className="border border-slate-100 rounded-2xl p-6 mt-8 grid sm:grid-cols-2 gap-4 text-sm bg-slate-50/60">
              {[
                ["Budget", state.budget],
                ["Travel type", state.travel_type],
                ["Duration", `${state.duration_days} days`],
                ["Start date", state.start_date || "Not set"],
                ["Companions", state.companions],
                ["Interests", state.interests.join(", ")],
                ["Food preference", state.diet],
                ["Origin", state.origin || "—"],
              ].map(([key, value]) => (
                <div key={key}>
                  <div className="eyebrow">{key}</div>
                  <div className="mt-1 text-slate-800 capitalize">{value}</div>
                </div>
              ))}
            </div>
            <div className="mt-8 flex items-center justify-between">
              <button onClick={goBack} className="btn-ghost flex items-center gap-1" data-testid="wizard-review-back">
                <ArrowLeft size={16} />
                Change something
              </button>
              <button
                onClick={generate}
                disabled={busy}
                className="btn-primary flex items-center gap-2 disabled:opacity-50"
                data-testid="wizard-generate"
              >
                <Sparkles size={18} />
                {busy ? "Finding your places…" : "Show my destinations"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      </div>{/* end outer tp-card */}

      {loading && (
        <AILoadingChecklist steps={SUGGESTION_STEPS} done={!busy} onDone={() => {}} />
      )}
    </div>
  );
}

function Choice({ option, selected, onClick, testId, multi }) {
  const Icon = option.icon;
  return (
    <motion.button
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`choice-card text-left relative ${selected ? "selected" : ""}`}
      data-testid={testId}
    >
      {selected && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 400, damping: 15 }}
          className="absolute top-3 right-3 w-5 h-5 rounded-full bg-[#E76F51] text-white flex items-center justify-center"
        >
          <Check size={12} strokeWidth={3} />
        </motion.div>
      )}
      <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
        selected ? "bg-[#E76F51] text-white" : "bg-[#0D5C75]/10 text-[#0D5C75]"
      }`}>
        <Icon size={22} />
      </div>
      <div className="font-display text-2xl mt-4">{option.label}</div>
      {option.desc && <div className="text-slate-500 text-sm mt-1">{option.desc}</div>}
      {multi && <div className="text-xs text-slate-400 mt-2">Pick any</div>}
    </motion.button>
  );
}

/**
 * Budget card variant — shows the spending-style label, subtitle,
 * and a dynamic approximate cost estimate for the selected duration.
 */
function BudgetChoice({ option, estimate, selected, onClick, testId }) {
  const Icon = option.icon;
  return (
    <motion.button
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`choice-card text-left relative ${selected ? "selected" : ""}`}
      data-testid={testId}
    >
      {selected && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 400, damping: 15 }}
          className="absolute top-3 right-3 w-5 h-5 rounded-full bg-[#E76F51] text-white flex items-center justify-center"
        >
          <Check size={12} strokeWidth={3} />
        </motion.div>
      )}
      <div
        className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
          selected ? "bg-[#E76F51] text-white" : "bg-[#0D5C75]/10 text-[#0D5C75]"
        }`}
      >
        <Icon size={22} />
      </div>
      <div className="font-display text-2xl mt-4">{option.label}</div>
      <div className="text-slate-500 text-sm mt-1">{option.desc}</div>
      {estimate && (
        <div
          className={`mt-3 text-xs font-semibold px-2 py-1 rounded-lg inline-block transition-colors ${
            selected
              ? "bg-[#E76F51]/15 text-[#E76F51]"
              : "bg-slate-100 text-slate-500"
          }`}
        >
          ~{estimate}
        </div>
      )}
    </motion.button>
  );
}

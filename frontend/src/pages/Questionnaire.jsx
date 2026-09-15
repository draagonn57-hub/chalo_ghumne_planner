import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Utensils, Wallet, Sparkles, Users, Mountain, Music4, Landmark, Save as Waves, Leaf, ChefHat, ArrowLeft, ArrowRight, Check, Calendar } from "lucide-react";
import AILoadingChecklist from "@/components/AILoadingChecklist";

const SUGGESTION_STEPS = [
  "Understanding your preferences",
  "Scouting destinations",
  "Matching your vibe",
];

const STEPS = [
  {
    key: "budget_diet",
    title: "How lavish — and what's on the menu?",
    sub: "Set the spending tone and food philosophy.",
    type: "combined",
  },
  {
    key: "duration_days",
    title: "How many days?",
    sub: "Slide to your trip length.",
    type: "range",
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

const BUDGET_OPTIONS = [
  { v: "budget", label: "Backpacker", desc: "Hostels & street food", icon: Wallet },
  { v: "mid-range", label: "Balanced", desc: "Comfort & experiences", icon: Wallet },
  { v: "luxury", label: "Luxury", desc: "Boutique stays & fine dining", icon: Wallet },
];

const DIET_OPTIONS = [
  { v: "veg", label: "Vegetarian", desc: "Plant-forward menus", icon: Leaf },
  { v: "non-veg", label: "Non-Vegetarian", desc: "Anything on the menu", icon: ChefHat },
];

const DEFAULTS = {
  diet: "",
  budget: "",
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
    if (current?.type === "combined") return !!state.budget && !!state.diet;
    if (current?.type === "multi") return state.interests.length > 0;
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
          <span>Budget</span>
          <span>Duration</span>
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
                <div className="tp-card p-8">
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
                <div className="tp-card p-8 space-y-8">
                  <div>
                    <div className="flex items-center gap-2 mb-5">
                      <div className="w-8 h-8 rounded-full bg-[#E76F51]/10 text-[#E76F51] flex items-center justify-center text-sm font-bold">1</div>
                      <h3 className="font-display text-2xl">Spending style</h3>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-3">
                      {BUDGET_OPTIONS.map((option) => (
                        <Choice
                          key={option.v}
                          option={option}
                          selected={state.budget === option.v}
                          onClick={() => setState({ ...state, budget: option.v })}
                          testId={`choice-budget-${option.v}`}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="h-px bg-slate-100" />
                  <div>
                    <div className="flex items-center gap-2 mb-5">
                      <div className="w-8 h-8 rounded-full bg-[#E76F51]/10 text-[#E76F51] flex items-center justify-center text-sm font-bold">2</div>
                      <h3 className="font-display text-2xl">Food philosophy</h3>
                    </div>
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
                      selected={current.type === "multi" ? state.interests.includes(option.v) : state[current.key] === option.v}
                      onClick={() => pick(option.v)}
                      testId={`choice-${current.key}-${option.v}`}
                      multi={current.type === "multi"}
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
            <div className="tp-card p-8 mt-8 grid sm:grid-cols-2 gap-4 text-sm">
              {[
                ["Diet", state.diet],
                ["Budget", state.budget],
                ["Duration", `${state.duration_days} days`],
                ["Start date", state.start_date || "Not set"],
                ["Companions", state.companions],
                ["Interests", state.interests.join(", ")],
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

import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Sparkles, MapPin, ListChecks, ArrowRight } from "lucide-react";

const MODES = [
  {
    key: "recommended",
    title: "Smart Suggestions",
    desc: "We'll suggest places based on your saved trips and favourites — no questions asked.",
    icon: Sparkles,
    path: "/plan/recommended",
    testId: "mode-recommended",
  },
  {
    key: "choose",
    title: "I'll Pick My Destination",
    desc: "Choose any city or place yourself and we'll build the full itinerary around it.",
    icon: MapPin,
    path: "/plan/choose",
    testId: "mode-choose",
  },
  {
    key: "questionnaire",
    title: "Help Me Decide",
    desc: "Answer a few quick questions and we'll suggest four destinations that fit your style.",
    icon: ListChecks,
    path: "/plan/questionnaire",
    testId: "mode-questionnaire",
  },
];

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, delay: i * 0.1, ease: [0.2, 0.9, 0.3, 1] },
  }),
};

export default function ModeSelect() {
  const nav = useNavigate();

  return (
    <div className="max-w-4xl mx-auto px-6 py-10 sm:py-16" data-testid="mode-select">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <p className="eyebrow">How would you like to start?</p>
        <h1 className="font-display text-4xl sm:text-5xl mt-3 tracking-tight">
          Pick your planning style.
        </h1>
        <p className="text-slate-500 mt-4 max-w-xl leading-relaxed">
          Three ways to begin your journey. Choose whichever feels right —
          you can always try another.
        </p>
      </motion.div>

      <div className="grid gap-6 mt-10 sm:grid-cols-3">
        {MODES.map((m, i) => {
          const Icon = m.icon;
          return (
            <motion.button
              key={m.key}
              custom={i}
              variants={cardVariants}
              initial="hidden"
              animate="visible"
              whileHover={{ y: -4 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => nav(m.path)}
              className="tp-card p-8 text-left group relative"
              data-testid={m.testId}
            >
              <div className="w-14 h-14 rounded-2xl bg-[#0D5C75]/10 text-[#0D5C75] flex items-center justify-center transition-colors group-hover:bg-[#0D5C75] group-hover:text-white">
                <Icon size={26} />
              </div>
              <h3 className="font-display text-2xl mt-6">{m.title}</h3>
              <p className="text-slate-600 mt-3 text-sm leading-relaxed">
                {m.desc}
              </p>
              <div className="mt-6 inline-flex items-center gap-1.5 text-[#E76F51] font-semibold text-sm transition-all group-hover:gap-2.5">
                Get started
                <ArrowRight size={16} />
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

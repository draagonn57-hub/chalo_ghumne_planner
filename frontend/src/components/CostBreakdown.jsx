import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plane,
  Building2,
  Utensils,
  MapPin,
  Wallet,
  TrendingUp,
  Info,
} from "lucide-react";

const CURRENCY_RE = /([A-Za-z]{0,3})\s*([\d,]+(?:\.\d+)?)/;

const CATEGORY_META = {
  flights: { label: "Flights & Transport", icon: Plane, color: "#0D5C75" },
  hotels: { label: "Hotels & Stays", icon: Building2, color: "#E76F51" },
  food: { label: "Food & Dining", icon: Utensils, color: "#F4A261" },
  activities: { label: "Activities & Sightseeing", icon: MapPin, color: "#2A9D8F" },
  other: { label: "Other & Tips", icon: Wallet, color: "#8B5E83" },
};

const MEAL_EST = { budget: 300, "mid-range": 800, luxury: 2500 };

function parseAmount(str) {
  if (!str) return 0;
  if (typeof str === "number") return str;
  const match = String(str).match(CURRENCY_RE);
  if (!match) return 0;
  return parseFloat(match[2].replace(/,/g, "")) || 0;
}

function detectCurrency(str) {
  if (!str) return "";
  const match = String(str).match(CURRENCY_RE);
  return match ? match[1].trim() : "";
}

function formatMoney(amount, currency) {
  const rounded = Math.round(amount);
  const formatted = rounded.toLocaleString("en-IN");
  return currency ? `${currency} ${formatted}` : formatted;
}

function getNumTravelers(companions) {
  switch (companions) {
    case "solo": return 1;
    case "couple": return 2;
    case "family": return 4;
    case "friends": return 3;
    default: return 1;
  }
}

function buildBreakdown(it) {
  const currency = detectCurrency(it.estimated_total_cost) || "₹";
  const durationDays = it.days?.length || 0;
  const prefs = it.preferences || {};
  const numTravelers = getNumTravelers(prefs.companions);
  const perMeal = MEAL_EST[prefs.budget] || 800;

  const data = {
    flights: 0,
    hotels: 0,
    food: 0,
    activities: 0,
    other: 0,
    items: { flights: [], hotels: [], food: [], activities: [], other: [] },
    currency,
    total: 0,
    aiTotal: 0,
    hasData: false,
    notes: [],
    numTravelers,
    durationDays,
  };

  (it.flights || []).forEach((f) => {
    const amt = parseAmount(f.price);
    if (amt > 0) {
      data.flights += amt;
      data.items.flights.push({
        label: `${f.airline || "Flight"}: ${f.from} → ${f.to}`,
        amount: amt,
        detail: `${f.duration || ""} ${f.stops || ""}`.trim(),
      });
    }
  });

  (it.transport || []).forEach((t) => {
    const amt = parseAmount(t.price);
    if (amt > 0) {
      data.flights += amt;
      data.items.flights.push({
        label: `${t.mode || "Transport"}: ${t.from} → ${t.to}`,
        amount: amt,
        detail: `${t.provider || ""} ${t.duration || ""}`.trim(),
      });
    }
  });

  const nights = Math.max(1, durationDays - 1);
  (it.hotels || []).forEach((h) => {
    const perNight = parseAmount(h.price_per_night);
    if (perNight > 0) {
      const total = perNight * nights;
      data.hotels += total;
      data.items.hotels.push({
        label: h.name,
        amount: total,
        detail: `${h.price_per_night}/night × ${nights} nights`,
      });
    }
  });

  (it.days || []).forEach((day) => {
    if (!day.food) return;
    const meals = ["breakfast", "lunch", "dinner"];
    const knownCount = meals.filter((m) => day.food[m] && day.food[m] !== "—").length;
    if (knownCount > 0) {
      const dayFood = perMeal * knownCount * numTravelers;
      data.food += dayFood;
      data.items.food.push({
        label: `Day ${day.day} — ${day.location || "dining"}`,
        amount: dayFood,
        detail: `${numTravelers} traveler${numTravelers > 1 ? "s" : ""} × ${knownCount} meals`,
      });
    }
  });

  (it.landmarks || []).forEach((l) => {
    const amt = 200 * numTravelers;
    data.activities += amt;
    data.items.activities.push({
      label: l.name,
      amount: amt,
      detail: l.location || "",
    });
  });

  (it.tips || []).forEach((tip) => {
    if (tip && tip.toLowerCase().includes("carry")) {
      const amt = 2000;
      data.other += amt;
      data.items.other.push({
        label: "Miscellaneous / emergency fund",
        amount: amt,
        detail: "From travel tips",
      });
    }
  });

  data.total = data.flights + data.hotels + data.food + data.activities + data.other;
  data.aiTotal = parseAmount(it.estimated_total_cost);
  data.hasData = data.total > 0;

  if (data.aiTotal > 0 && data.total > 0) {
    const diff = data.total - data.aiTotal;
    const pct = ((diff / data.aiTotal) * 100).toFixed(0);
    if (Math.abs(Number(pct)) > 5) {
      data.notes.push({
        type: Number(pct) > 0 ? "over" : "under",
        text: `Our breakdown is ${Math.abs(Number(pct))}% ${Number(pct) > 0 ? "above" : "below"} the AI's estimate of ${formatMoney(data.aiTotal, currency)}.`,
      });
    }
  }

  if (data.flights === 0 && data.hotels === 0 && data.food === 0) {
    data.hasData = false;
  }

  return data;
}

function DonutChart({ data, currency, numTravelers, durationDays }) {
  const [hovered, setHovered] = useState(null);
  const radius = 80;
  const stroke = 28;
  const circumference = 2 * Math.PI * radius;
  const total = data.reduce((s, d) => s + d.value, 0) || 1;

  let offset = 0;
  const segments = data.map((d) => {
    const fraction = d.value / total;
    const dash = fraction * circumference;
    const seg = { ...d, dash, gap: circumference - dash, offset: -offset };
    offset += dash;
    return seg;
  });

  return (
    <div className="relative flex items-center justify-center">
      <svg width={200} height={200} viewBox="0 0 200 200" className="transform -rotate-90">
        <circle cx={100} cy={100} r={radius} fill="none" stroke="#f1f5f9" strokeWidth={stroke} />
        {segments.map((seg, i) => {
          const isHovered = hovered === i;
          return (
            <motion.circle
              key={seg.key}
              cx={100}
              cy={100}
              r={radius}
              fill="none"
              stroke={seg.color}
              strokeWidth={isHovered ? stroke + 4 : stroke}
              strokeDasharray={`${seg.dash} ${seg.gap}`}
              strokeDashoffset={seg.offset}
              strokeLinecap="round"
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              style={{ cursor: "pointer", transition: "stroke-width 0.2s" }}
            />
          );
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        {hovered !== null ? (
          <>
            <span className="text-xs text-slate-500 font-medium">{data[hovered].label}</span>
            <span className="font-display text-2xl mt-0.5" style={{ color: data[hovered].color }}>
              {formatMoney(data[hovered].value, currency)}
            </span>
            <span className="text-xs text-slate-400 mt-0.5">
              {((data[hovered].value / total) * 100).toFixed(0)}%
            </span>
          </>
        ) : (
          <>
            <span className="text-xs text-slate-500 font-medium uppercase tracking-widest">Total</span>
            <span className="font-display text-3xl mt-1 text-slate-800">{formatMoney(total, currency)}</span>
            <span className="text-xs text-slate-400 mt-1">
              {numTravelers} traveler{numTravelers > 1 ? "s" : ""} · {durationDays || "?"} days
            </span>
          </>
        )}
      </div>
    </div>
  );
}

function CategoryCard({ catKey, data, currency }) {
  const [expanded, setExpanded] = useState(false);
  const meta = CATEGORY_META[catKey];
  const Icon = meta.icon;
  const items = data.items[catKey];
  const hasItems = items && items.length > 0;

  return (
    <div className="tp-card p-5">
      <button
        onClick={() => hasItems && setExpanded(!expanded)}
        className="w-full flex items-center gap-3 text-left"
        disabled={!hasItems}
      >
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
          style={{ backgroundColor: `${meta.color}15`, color: meta.color }}
        >
          <Icon size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-slate-800">{meta.label}</div>
          {hasItems && (
            <div className="text-xs text-slate-400 mt-0.5">
              {items.length} item{items.length > 1 ? "s" : ""}
            </div>
          )}
        </div>
        <div className="text-right shrink-0">
          <div className="font-display text-lg" style={{ color: meta.color }}>
            {formatMoney(data[catKey], currency)}
          </div>
          {data.total > 0 && (
            <div className="text-xs text-slate-400">
              {((data[catKey] / data.total) * 100).toFixed(0)}%
            </div>
          )}
        </div>
      </button>

      <AnimatePresence initial={false}>
        {expanded && hasItems && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="mt-4 pt-4 border-t border-slate-100 space-y-2.5">
              {items.map((item, i) => (
                <div key={i} className="flex items-start justify-between gap-3 text-sm">
                  <div className="flex-1 min-w-0">
                    <div className="text-slate-700 font-medium truncate">{item.label}</div>
                    {item.detail && (
                      <div className="text-xs text-slate-400 mt-0.5">{item.detail}</div>
                    )}
                  </div>
                  <div className="text-slate-600 font-medium shrink-0">
                    {formatMoney(item.amount, currency)}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function CostBreakdown({ itinerary }) {
  const data = useMemo(() => buildBreakdown(itinerary), [itinerary]);

  if (!data.hasData) {
    return (
      <div className="tp-card p-8 text-center">
        <Wallet size={32} className="mx-auto text-slate-300" />
        <p className="text-slate-500 mt-3">
          Cost breakdown will appear here once your itinerary includes pricing data.
        </p>
      </div>
    );
  }

  const chartData = Object.keys(CATEGORY_META)
    .filter((k) => data[k] > 0)
    .map((k) => ({
      key: k,
      label: CATEGORY_META[k].label,
      value: data[k],
      color: CATEGORY_META[k].color,
    }));

  const perTraveler = data.total / (data.numTravelers || 1);
  const perDay = data.total / Math.max(1, data.durationDays || 1);

  return (
    <div className="space-y-6">
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="tp-card p-8 flex flex-col items-center justify-center">
          <DonutChart
            data={chartData}
            currency={data.currency}
            numTravelers={data.numTravelers}
            durationDays={data.durationDays}
          />
          <div className="mt-6 flex flex-wrap gap-3 justify-center">
            {chartData.map((seg) => (
              <div key={seg.key} className="flex items-center gap-1.5 text-xs text-slate-600">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: seg.color }} />
                {seg.label}
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="tp-card p-6">
            <div className="flex items-center gap-2 text-[#0D5C75]">
              <TrendingUp size={18} />
              <h3 className="font-display text-xl">Cost summary</h3>
            </div>
            <div className="mt-5 space-y-4">
              <div className="flex items-baseline justify-between">
                <span className="text-slate-500 text-sm">Computed total</span>
                <span className="font-display text-2xl text-slate-800">
                  {formatMoney(data.total, data.currency)}
                </span>
              </div>
              {data.aiTotal > 0 && (
                <div className="flex items-baseline justify-between">
                  <span className="text-slate-500 text-sm">AI estimate</span>
                  <span className="font-display text-lg text-slate-500">
                    {formatMoney(data.aiTotal, data.currency)}
                  </span>
                </div>
              )}
              <div className="h-px bg-slate-100" />
              <div className="flex items-baseline justify-between">
                <span className="text-slate-500 text-sm">Per traveler</span>
                <span className="font-semibold text-[#0D5C75]">
                  {formatMoney(perTraveler, data.currency)}
                </span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-slate-500 text-sm">Per day</span>
                <span className="font-semibold text-[#0D5C75]">
                  {formatMoney(perDay, data.currency)}
                </span>
              </div>
            </div>
          </div>

          {data.notes.map((note, i) => (
            <div
              key={i}
              className={`rounded-xl p-4 flex items-start gap-3 text-sm ${
                note.type === "over"
                  ? "bg-amber-50 border border-amber-200 text-amber-800"
                  : "bg-emerald-50 border border-emerald-200 text-emerald-800"
              }`}
            >
              <Info size={16} className="shrink-0 mt-0.5" />
              <p>{note.text}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {chartData.map((seg) => (
          <CategoryCard key={seg.key} catKey={seg.key} data={data} currency={data.currency} />
        ))}
      </div>

      <p className="text-xs text-slate-400 text-center">
        All amounts are estimates based on AI-generated itinerary data. Actual prices may vary.
      </p>
    </div>
  );
}

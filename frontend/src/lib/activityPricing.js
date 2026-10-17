import { inferHotelStars, formatFoodPrice } from "@/lib/foodPricing";

const STAR_SIGHTSEEING_INR = {
  1: 90,
  2: 180,
  3: 400,
  4: 850,
  5: 1800,
};

const SLOTS = ["morning", "afternoon", "evening"];

function hashString(value) {
  const text = String(value || "");
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function roundToNice(amount) {
  if (amount <= 0) return 0;
  if (amount < 200) return Math.round(amount / 5) * 5;
  if (amount < 800) return Math.round(amount / 10) * 10;
  if (amount < 2500) return Math.round(amount / 50) * 50;
  return Math.round(amount / 100) * 100;
}

function normalizeName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function activityMultiplier(text) {
  const t = String(text || "").toLowerCase();
  if (!t || t === "—") return 0;

  if (
    /check[\s-]?in|check[\s-]?out|unpack|leisure at hotel|rest at hotel|free time|relax at (the )?hotel/.test(
      t
    )
  ) {
    return 0;
  }

  if (/helicopter|hot air balloon|private yacht/.test(t)) return 6.5;
  if (/scuba|paraglide|bungee|skydiv/.test(t)) return 3.4;
  if (/raft|snorkel|zip[\s-]?lin|ski|adventure|atv|quad/.test(t)) return 2.6;
  if (/safari|wildlife|national park|jeep/.test(t)) return 2.3;
  if (/spa|massage|wellness|hammam|ayurved/.test(t)) return 2.2;
  if (/theme park|amusement|water park/.test(t)) return 2.0;
  if (/private tour|skip the line|skip-the-line|chauffeur/.test(t)) return 2.4;
  if (/cooking class|workshop|class|lesson/.test(t)) return 1.7;
  if (/boat|cruise|ferry|kayak|houseboat/.test(t)) return 1.45;
  if (/show|dance|concert|theatre|theater|cultural performance|aarti/.test(t)) {
    return 1.35;
  }
  if (/guided|tour|trek|hike/.test(t)) return 1.25;
  if (/museum|gallery|fort|palace|monument|heritage|tomb|citadel/.test(t)) {
    return 0.9;
  }
  if (/temple|mosque|church|gurudwara|shrine/.test(t)) return 0.35;
  if (
    /walk|stroll|sunset|sunrise|beach|garden|market|old town|explore|viewpoint|promenade/.test(
      t
    )
  ) {
    return 0.2;
  }
  if (/shopping/.test(t)) return 0.25;
  return 1;
}

export function estimateActivityPriceINR(label, hotel) {
  const stars = inferHotelStars(hotel);
  const base = STAR_SIGHTSEEING_INR[stars] || STAR_SIGHTSEEING_INR[3];
  const multiplier = activityMultiplier(label);
  if (multiplier === 0) return 0;
  const jitter = 0.88 + (hashString(`${stars}:${label}`) % 25) / 100;
  return Math.max(0, roundToNice(base * multiplier * jitter));
}

export function getSlotActivityPrice(slotData, hotel, currency = "₹") {
  const activity = slotData?.activity;
  const landmark = slotData?.landmark;
  const known = Boolean(activity && activity !== "—" && activity !== "New activity");
  if (!known) {
    return { activity: "", landmark: landmark || "", amount: 0, display: "", free: false };
  }
  const label = [activity, landmark].filter(Boolean).join(" · ");
  const amount = estimateActivityPriceINR(label, hotel);
  return {
    activity,
    landmark: landmark || "",
    amount,
    display: amount > 0 ? formatFoodPrice(amount, currency) : "Free",
    free: amount === 0,
  };
}

export function getDayActivityPrices(day, hotel, currency = "₹") {
  return SLOTS.map((slot) => ({
    slot,
    ...getSlotActivityPrice(day?.[slot], hotel, currency),
  })).filter((item) => item.activity);
}

export function getLandmarkPrice(landmark, hotel, currency = "₹") {
  const name = landmark?.name || "";
  const label = [name, landmark?.description, landmark?.location]
    .filter(Boolean)
    .join(" ");
  const amount = estimateActivityPriceINR(label || name, hotel);
  return {
    name,
    location: landmark?.location || "",
    amount,
    display: amount > 0 ? formatFoodPrice(amount, currency) : "Free",
    free: amount === 0,
  };
}

export function collectActivityCosts(itinerary, hotel, currency = "₹") {
  const items = [];
  const covered = new Set();

  (itinerary?.days || []).forEach((day) => {
    getDayActivityPrices(day, hotel, currency).forEach((item) => {
      covered.add(normalizeName(item.activity));
      if (item.landmark) covered.add(normalizeName(item.landmark));
      items.push({
        label: `Day ${day.day} ${item.slot} — ${item.activity}`,
        amount: item.amount,
        display: item.display,
        detail: item.landmark || item.display,
      });
    });
  });

  (itinerary?.landmarks || []).forEach((landmark) => {
    const key = normalizeName(landmark?.name);
    if (key && [...covered].some((c) => c.includes(key) || key.includes(c))) {
      return;
    }
    const priced = getLandmarkPrice(landmark, hotel, currency);
    items.push({
      label: priced.name,
      amount: priced.amount,
      display: priced.display,
      detail: priced.location || "Landmark entry",
    });
  });

  return items;
}

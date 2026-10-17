import { parsePrice, formatINR } from "@/lib/bookingUtils";

const STAR_MEAL_INR = {
  1: { breakfast: 90, lunch: 170, dinner: 240 },
  2: { breakfast: 180, lunch: 290, dinner: 400 },
  3: { breakfast: 380, lunch: 620, dinner: 850 },
  4: { breakfast: 720, lunch: 1250, dinner: 1850 },
  5: { breakfast: 1350, lunch: 2400, dinner: 3600 },
};

function hashString(value) {
  const text = String(value || "");
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function nightlyToINR(hotel) {
  const raw = hotel?.price_per_night;
  const amount = parsePrice(raw);
  if (!amount) return 0;

  const text = String(raw || "").toLowerCase();
  if (text.includes("$") || text.includes("usd")) {
    return amount * 83;
  }
  if (text.includes("₹") || text.includes("inr") || text.includes("rs")) {
    return amount;
  }
  // Bare numbers: hotel nights above ~1500 are almost always INR.
  return amount >= 1500 ? amount : amount * 83;
}

export function inferHotelStars(hotel) {
  if (!hotel) return 3;

  const rating = Number(hotel.rating) || 0;
  const inr = nightlyToINR(hotel);
  const amenities = (hotel.amenities || []).join(" ").toLowerCase();
  const name = String(hotel.name || "").toLowerCase();

  const looksFiveStar =
    /5[\s-]?star|palace|taj|oberoi|leela|ritz|four seasons|st\.?\s*regis|waldorf/.test(
      `${name} ${amenities}`
    );
  const looksBudget =
    /hostel|dorm|backpack|lodge|guest house|guesthouse/.test(`${name} ${amenities}`);

  if (looksFiveStar || inr >= 14000 || rating >= 4.8) return 5;
  if (inr >= 7000 || rating >= 4.4) return 4;
  if (looksBudget || inr <= 1800 || (rating > 0 && rating < 3.5)) return 1;
  if (inr >= 3500 || rating >= 4.0) return 3;
  return 2;
}

function dishMultiplier(dish) {
  const text = String(dish || "").toLowerCase();
  if (!text || text === "—") return 1;

  if (
    /street|stall|cart|vendor|chaat|vada pav|pani puri|golgappa|dhaba|tapri|thela/.test(
      text
    )
  ) {
    return 0.48;
  }
  if (
    /idli|dosa|paratha|poha|upma|sandwich|bakery|cafe|coffee|breakfast buffet|continental breakfast/.test(
      text
    )
  ) {
    return 0.78;
  }
  if (/thali|biryani|curry|local restaurant|family restaurant/.test(text)) {
    return 0.92;
  }
  if (/buffet/.test(text)) return 1.18;
  if (/seafood|sushi|steak|lobster|grill|wine pairing/.test(text)) return 1.32;
  if (
    /fine dining|tasting menu|chef|michelin|rooftop|steakhouse|degustation/.test(
      text
    )
  ) {
    return 1.55;
  }
  return 1;
}

function roundToNice(amount) {
  if (amount < 200) return Math.round(amount / 5) * 5;
  if (amount < 800) return Math.round(amount / 10) * 10;
  if (amount < 2500) return Math.round(amount / 50) * 50;
  return Math.round(amount / 100) * 100;
}

export function estimateMealPriceINR(dish, mealType, hotel) {
  const stars = inferHotelStars(hotel);
  const base = STAR_MEAL_INR[stars]?.[mealType] || STAR_MEAL_INR[3][mealType] || 600;
  const jitter = 0.9 + (hashString(`${mealType}:${dish}`) % 21) / 100;
  const amount = base * dishMultiplier(dish) * jitter;
  return Math.max(40, roundToNice(amount));
}

export function formatFoodPrice(amountINR, currency = "₹") {
  const code = String(currency || "₹");
  if (code.includes("$") || /USD/i.test(code)) {
    const usd = Math.max(2, Math.round(amountINR / 83));
    return `$${usd}`;
  }
  return formatINR(amountINR);
}

export function getMealPrices(dayFood, hotel, currency = "₹") {
  const meals = ["breakfast", "lunch", "dinner"];
  return meals.map((meal) => {
    const dish = dayFood?.[meal];
    const known = Boolean(dish && dish !== "—");
    const amount = known ? estimateMealPriceINR(dish, meal, hotel) : 0;
    return {
      meal,
      dish: known ? dish : "",
      amount,
      display: known ? formatFoodPrice(amount, currency) : "",
    };
  });
}

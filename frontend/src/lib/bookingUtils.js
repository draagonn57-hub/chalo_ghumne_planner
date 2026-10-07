/**
 * Shared booking helpers — price parsing, room types, service catalog, formatting.
 */

export const ROOM_TYPES = [
  {
    id: "standard",
    label: "Standard Room",
    desc: "Comfortable room with queen bed, city view, and essential amenities.",
    occupancy: 2,
    multiplier: 1.0,
  },
  {
    id: "deluxe",
    label: "Deluxe Room",
    desc: "Spacious room with king bed, premium linens, and enhanced amenities.",
    occupancy: 3,
    multiplier: 1.45,
  },
  {
    id: "suite",
    label: "Suite",
    desc: "Luxury suite with separate living area, soaking tub, and lounge access.",
    occupancy: 4,
    multiplier: 2.2,
  },
];

export function parsePrice(value) {
  if (value === null || value === undefined || value === "") {
    return 0;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  const text = String(value).trim();

  const matches = text.match(/\d[\d,]*(?:\.\d+)?/g);

  if (!matches || matches.length === 0) {
    return 0;
  }

  const numbers = matches
    .map((item) => Number(item.replace(/,/g, "")))
    .filter((n) => Number.isFinite(n));

  if (numbers.length === 0) {
    return 0;
  }

  if (numbers.length >= 2) {
    return Math.round(
      numbers.reduce((sum, n) => sum + n, 0) / numbers.length
    );
  }

  return numbers[0];
}

export function formatINR(amount) {
  const n = Math.round(Number(amount) || 0);
  return "₹" + n.toLocaleString("en-IN");
}
/**
 * Build a list of recommended add-on services based on destination + itinerary.
 */
export function buildServiceCatalog(itinerary) {
  const dest = itinerary?.destinations?.[0];
  const destName = dest?.name || "your destination";
  const interests = itinerary?.preferences?.interests || [];

  const catalog = [
    { id: "airport_transfer", name: "Airport Transfer", desc: `Private car from airport to your hotel in ${destName}.`, price: 1800, icon: "Car" },
    { id: "local_cab", name: "Local Cab Package", desc: "Full-day cab for local sightseeing (8h / 80km).", price: 2400, icon: "Car" },
    { id: "car_rental", name: "Car Rental", desc: "Self-drive car rental for 24 hours.", price: 3200, icon: "Car" },
    { id: "travel_insurance", name: "Travel Insurance", desc: "Comprehensive trip insurance covering medical, baggage, and cancellation.", price: 850, icon: "Shield" },
    { id: "guided_tour", name: "Guided City Tour", desc: `Half-day guided walking tour of ${destName} with a local expert.`, price: 1500, icon: "MapPin" },
  ];

  if (interests.includes("adventure")) {
    catalog.push({ id: "adventure", name: "Adventure Activities", desc: "Zip-lining, river rafting, or paragliding session.", price: 3500, icon: "Mountain" });
  }
  if (interests.includes("culture") || interests.includes("nature")) {
    catalog.push({ id: "museum_tickets", name: "Museum & Monument Tickets", desc: "Skip-the-line entry to top museums and monuments.", price: 1200, icon: "Landmark" });
  }
  catalog.push({ id: "lounge", name: "Airport Lounge Access", desc: "Relax in premium airport lounges before your flight.", price: 950, icon: "Building2" });

  return catalog;
}

/**
 * Generate a demo transaction ID.
 */
export function genTransactionId() {
  return "CG-DEMO-" + Math.floor(100000 + Math.random() * 900000);
}

/**
 * Calculate the full pricing breakdown.
 */
export function calcPricing({ flightPrice, hotelPerNight, roomMultiplier, numRooms, numNights, addons }) {
  const flight = flightPrice || 0;
  const hotelPerRoomPerNight = hotelPerNight * roomMultiplier;
  const hotelTotal = hotelPerRoomPerNight * numRooms * numNights;
  const addonsTotal = (addons || []).reduce((sum, a) => sum + (a.price || 0), 0);
  const subtotal = flight + hotelTotal + addonsTotal;
  const taxes = Math.round(subtotal * 0.12);
  const discount = Math.round(subtotal * 0.05);
  const grandTotal = subtotal + taxes - discount;
  return { flight, hotelPerRoomPerNight, hotelTotal, addonsTotal, subtotal, taxes, discount, grandTotal };
}

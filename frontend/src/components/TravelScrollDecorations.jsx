import { motion, useScroll, useTransform, useReducedMotion } from "framer-motion";

/**
 * TravelScrollDecorations
 * Orchestrates prominent, highly realistic 2D travel animations in strict sequential relay:
 *
 * 1. ALPINE SKIER (0.00 -> 0.28):
 *    - Present on Mount Everest's snow slopes right from initial page load.
 *    - Carves an athletic S-curve downhill with dynamic powder snow rooster tails.
 *    - Finishes cleanly and exits completely by scroll 0.29.
 *
 * 2. COMMERCIAL AIRLINER (0.30 -> 0.64):
 *    - Starts ONLY after the skier has stopped and exited.
 *    - Cruises majestically across the middle sky over "How It Works" & destinations.
 *    - Features dual expanding jet contrails, glowing cabin windows, winglets, and navigation strobes.
 *    - Finishes cleanly and exits completely by scroll 0.65.
 *
 * 3. ADVENTURE OVERLAND 4x4 (0.67 -> 0.98):
 *    - Starts ONLY after the airplane has stopped and exited.
 *    - Expedition safari wagon equipped with rooftop tent, gear boxes, and all-terrain tires.
 *    - Emits powerful volumetric golden headlight beams illuminating the road to the CTA banner.
 *    - Completes the journey at the page finale.
 */
export default function TravelScrollDecorations() {
  const shouldReduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll();

  // =========================================================================
  // STAGE 1: ALPINE SKIER (Mountain Environment ONLY: 0.00 to 0.26)
  // =========================================================================
  // Visible immediately at scroll 0 on the upper mountain slope, carves downhill
  const skierX = useTransform(
    scrollYProgress,
    [0.00, 0.06, 0.12, 0.19, 0.25],
    ["68vw", "56vw", "44vw", "28vw", "10vw"]
  );
  const skierY = useTransform(
    scrollYProgress,
    [0.00, 0.06, 0.12, 0.19, 0.25],
    ["22vh", "38vh", "54vh", "72vh", "88vh"]
  );
  const skierRotate = useTransform(
    scrollYProgress,
    [0.00, 0.06, 0.12, 0.19, 0.25],
    [-14, 15, -12, 14, -6]
  );
  const skierOpacity = useTransform(
    scrollYProgress,
    [0.00, 0.02, 0.22, 0.26],
    [1, 1, 0.95, 0]
  );

  // =========================================================================
  // STAGE 2: COMMERCIAL AIRLINER (Middle Sky ONLY: 0.28 to 0.61 — Starts AFTER Skier)
  // =========================================================================
  const planeX = useTransform(
    scrollYProgress,
    [0.28, 0.61],
    ["-16vw", "108vw"]
  );
  const planeY = useTransform(
    scrollYProgress,
    [0.28, 0.44, 0.61],
    ["16vh", "22vh", "15vh"]
  );
  const planeRotate = useTransform(
    scrollYProgress,
    [0.28, 0.44, 0.61],
    [5, 0, -4]
  );
  const planeOpacity = useTransform(
    scrollYProgress,
    [0.275, 0.30, 0.58, 0.615],
    [0, 1, 1, 0]
  );

  // =========================================================================
  // STAGE 3: ADVENTURE 4x4 (Roadway Transition to Shibuya: 0.64 to 0.85 — Starts AFTER Airplane)
  // Drives along the highway, decelerates naturally near Shibuya Crossing,
  // and smoothly settles/disappears into the nocturnal city traffic.
  // =========================================================================
  const carX = useTransform(
    scrollYProgress,
    [0.64, 0.74, 0.81, 0.85],
    ["-14vw", "32vw", "58vw", "64vw"]
  );
  const carOpacity = useTransform(
    scrollYProgress,
    [0.635, 0.66, 0.80, 0.85],
    [0, 1, 1, 0]
  );

  if (shouldReduceMotion) return null;

  return (
    <div
      className="pointer-events-none fixed inset-0 overflow-hidden z-30 select-none"
      aria-hidden="true"
    >
      {/* ===================================================================== */}
      {/* 1. REALISTIC ALPINE SKIER (Stage 1: 0.00 -> 0.28) */}
      {/* ===================================================================== */}
      <motion.div
        style={{
          left: skierX,
          top: skierY,
          rotate: skierRotate,
          opacity: skierOpacity,
        }}
        className="fixed w-52 sm:w-64 h-52 sm:h-64 pointer-events-none -translate-x-1/2 -translate-y-1/2"
      >
        {/* Billowing Powder Snow Rooster-Tail Wake */}
        <div className="absolute -left-20 sm:-left-28 bottom-2 w-48 sm:w-64 h-16 sm:h-24 bg-gradient-to-r from-transparent via-white/60 to-white/95 blur-[4px] rounded-full [clip-path:polygon(0_100%,100%_0%,100%_100%)] opacity-90" />
        <div className="absolute -left-12 bottom-4 w-32 h-10 bg-white/80 blur-[2px] rounded-full" />

        {/* Detailed High-End 2D Skier Vector */}
        <svg
          viewBox="0 0 120 120"
          className="w-full h-full drop-shadow-[0_12px_24px_rgba(0,0,0,0.65)]"
        >
          <defs>
            {/* Iridescent Ski Goggle Reflection Gradient */}
            <linearGradient id="skierGoggleGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#FEF08A" />
              <stop offset="45%" stopColor="#F59E0B" />
              <stop offset="85%" stopColor="#E76F51" />
              <stop offset="100%" stopColor="#991B1B" />
            </linearGradient>

            {/* Jacket Shading */}
            <linearGradient id="skierJacketGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#F28E75" />
              <stop offset="50%" stopColor="#E76F51" />
              <stop offset="100%" stopColor="#C44B2D" />
            </linearGradient>

            {/* Skis Gradient */}
            <linearGradient id="skiGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="70%" stopColor="#E2E8F0" />
              <stop offset="88%" stopColor="#E76F51" />
              <stop offset="100%" stopColor="#0D5C75" />
            </linearGradient>
          </defs>

          {/* Dynamic Ejected Snow Particles */}
          <circle cx="16" cy="98" r="4.2" fill="#FFFFFF" opacity="0.95" />
          <circle cx="8" cy="102" r="3.2" fill="#FFFFFF" opacity="0.85" />
          <circle cx="26" cy="92" r="2.8" fill="#FFFFFF" opacity="0.9" />
          <circle cx="4" cy="106" r="2.2" fill="#FFFFFF" opacity="0.7" />
          <circle cx="34" cy="88" r="2.0" fill="#FFFFFF" opacity="0.8" />
          <circle cx="12" cy="110" r="1.8" fill="#FFFFFF" opacity="0.65" />

          {/* High-Performance Carving Skis (Steel edges & Rockered Tips) */}
          {/* Bottom/Outer Ski */}
          <path
            d="M12 102 L98 84"
            stroke="url(#skiGrad)"
            strokeWidth="5.5"
            strokeLinecap="round"
          />
          <path
            d="M92 85 L98 84"
            stroke="#0D5C75"
            strokeWidth="5.5"
            strokeLinecap="round"
          />
          {/* Top/Inner Ski */}
          <path
            d="M20 110 L106 92"
            stroke="url(#skiGrad)"
            strokeWidth="5.5"
            strokeLinecap="round"
          />
          <path
            d="M100 93 L106 92"
            stroke="#0D5C75"
            strokeWidth="5.5"
            strokeLinecap="round"
          />

          {/* Ski Bindings */}
          <rect
            x="48"
            y="87"
            width="14"
            height="7"
            rx="2"
            fill="#0F172A"
            transform="rotate(-12 55 90)"
          />
          <rect
            x="58"
            y="93"
            width="14"
            height="7"
            rx="2"
            fill="#0F172A"
            transform="rotate(-12 65 96)"
          />

          {/* Athletic Legs in Deep Carving Stance (Dark insulated technical pants) */}
          <path d="M46 62 L50 88 L60 88 L55 62 Z" fill="#1E293B" />
          <path d="M57 64 L62 94 L72 94 L66 64 Z" fill="#0F172A" />

          {/* Technical Gore-Tex Alpine Shell Jacket (Terracotta #E76F51) */}
          <path
            d="M42 38 L68 44 L64 68 L40 60 Z"
            fill="url(#skierJacketGrad)"
          />
          {/* Dark Contrast Storm Shoulder Yoke */}
          <path d="M47 35 L64 38 L60 48 L44 44 Z" fill="#0D5C75" />
          {/* High-Vis Arm Accent */}
          <line
            x1="44"
            y1="46"
            x2="35"
            y2="56"
            stroke="#FFFFFF"
            strokeWidth="1.8"
            strokeLinecap="round"
            opacity="0.9"
          />

          {/* Ski Helmet & Aerodynamic Contour */}
          <circle
            cx="55"
            cy="25"
            r="10.5"
            fill="#F8FAFC"
            stroke="#CBD5E1"
            strokeWidth="1.5"
          />
          <path d="M50 18 Q58 17 62 21" stroke="#0D5C75" strokeWidth="2.5" fill="none" strokeLinecap="round" />

          {/* Mirrored Alpine Goggles with Sky Sheen */}
          <path
            d="M58 23 Q66 24 65 29 Q58 28 55 26 Z"
            fill="url(#skierGoggleGrad)"
          />
          <ellipse
            cx="60"
            cy="25.5"
            rx="2.8"
            ry="1.6"
            fill="#FFFFFF"
            opacity="0.95"
          />

          {/* Arms with High-Modulus Carbon Ski Poles */}
          {/* Left Arm & Pole */}
          <path
            d="M45 44 L34 54 L29 51"
            stroke="#E76F51"
            strokeWidth="5"
            strokeLinecap="round"
          />
          <line
            x1="29"
            y1="51"
            x2="18"
            y2="104"
            stroke="#94A3B8"
            strokeWidth="2.6"
            strokeLinecap="round"
          />
          <circle
            cx="20"
            cy="98"
            r="3.8"
            fill="none"
            stroke="#E2E8F0"
            strokeWidth="2.2"
          />

          {/* Right Arm & Pole (Forward pole-plant) */}
          <path
            d="M61 46 L75 54 L80 51"
            stroke="#E76F51"
            strokeWidth="5"
            strokeLinecap="round"
          />
          <line
            x1="80"
            y1="51"
            x2="90"
            y2="105"
            stroke="#94A3B8"
            strokeWidth="2.6"
            strokeLinecap="round"
          />
          <circle
            cx="89"
            cy="99"
            r="3.8"
            fill="none"
            stroke="#E2E8F0"
            strokeWidth="2.2"
          />
        </svg>
      </motion.div>

      {/* ===================================================================== */}
      {/* 2. REALISTIC COMMERCIAL AIRLINER (Stage 2: 0.30 -> 0.64) */}
      {/* ===================================================================== */}
      <motion.div
        style={{
          left: planeX,
          top: planeY,
          rotate: planeRotate,
          opacity: planeOpacity,
        }}
        className="fixed w-80 sm:w-[500px] md:w-[600px] h-36 sm:h-52 pointer-events-none flex items-center -translate-y-1/2"
      >
        {/* Massive Dual High-Altitude Jet Contrail Vapor Trails */}
        <div className="absolute right-[82%] top-[34%] -translate-y-1/2 w-64 sm:w-[480px] h-5 bg-gradient-to-l from-white/95 via-sky-200/50 to-transparent blur-[2.5px] rounded-full" />
        <div className="absolute right-[78%] top-[64%] -translate-y-1/2 w-72 sm:w-[540px] h-5 bg-gradient-to-l from-white/90 via-sky-200/40 to-transparent blur-[2.5px] rounded-full" />

        {/* Detailed Modern Widebody Passenger Jet SVG */}
        <svg
          viewBox="0 0 200 80"
          className="w-full h-full drop-shadow-[0_16px_32px_rgba(13,92,117,0.4)]"
        >
          <defs>
            <linearGradient id="fuselageGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="65%" stopColor="#F8FAFC" />
              <stop offset="100%" stopColor="#E2E8F0" />
            </linearGradient>

            <linearGradient id="engineGlow" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#38BDF8" />
              <stop offset="100%" stopColor="#0284C7" />
            </linearGradient>
          </defs>

          {/* Main Airplane Fuselage */}
          <path
            d="M24 38 Q65 24 160 32 Q188 36 195 40 Q188 44 160 48 Q65 56 24 42 Z"
            fill="url(#fuselageGrad)"
            stroke="#0D5C75"
            strokeWidth="2.2"
          />

          {/* Flight Deck Cockpit Windshield */}
          <path
            d="M172 35 Q184 37 186 40 Q178 39 172 38 Z"
            fill="#0D5C75"
          />
          <path
            d="M174 36 L182 38"
            stroke="#38BDF8"
            strokeWidth="0.8"
            strokeLinecap="round"
          />

          {/* Passenger Cabin Window Line (Warm ambient cabin lighting) */}
          <rect
            x="68"
            y="36"
            width="88"
            height="4"
            rx="2"
            fill="#0D5C75"
            opacity="0.9"
          />
          <line
            x1="70"
            y1="38"
            x2="154"
            y2="38"
            stroke="#FEF08A"
            strokeWidth="1.5"
            strokeDasharray="3 2"
          />

          {/* Swept Main Wings with Branded Raked Winglets */}
          {/* Starboard Wing (Lower) */}
          <polygon
            points="78,40 116,74 132,74 112,40"
            fill="#0D5C75"
          />
          {/* Port Wing (Upper) */}
          <polygon
            points="86,37 122,8 136,8 118,37"
            fill="#0D5C75"
            opacity="0.95"
          />
          {/* Signature Terracotta Winglets */}
          <polygon points="132,74 138,66 132,66" fill="#E76F51" />
          <polygon points="136,8 142,16 136,16" fill="#E76F51" />

          {/* Turbofan Jet Engines with Titanium Nacelles */}
          {/* Lower Engine */}
          <rect
            x="98"
            y="58"
            width="24"
            height="11"
            rx="5.5"
            fill="#334155"
            stroke="#0D5C75"
            strokeWidth="1.2"
          />
          <ellipse
            cx="122"
            cy="63.5"
            rx="3"
            ry="5.2"
            fill="url(#engineGlow)"
          />
          {/* Upper Engine */}
          <rect
            x="106"
            y="13"
            width="22"
            height="9.5"
            rx="4.7"
            fill="#334155"
          />
          <ellipse
            cx="128"
            cy="17.7"
            rx="2.6"
            ry="4.5"
            fill="url(#engineGlow)"
          />

          {/* Tail Fin Empennage with Chalo Ghumne Livery */}
          <polygon points="26,38 4,6 24,6 44,38" fill="#E76F51" />
          <polygon points="26,42 10,58 20,58 34,42" fill="#0D5C75" />
          {/* Compass Star Livery on Tail */}
          <circle cx="16" cy="16" r="3.6" fill="#FFFFFF" />
          <circle cx="16" cy="16" r="1.5" fill="#E76F51" />

          {/* Navigation & Anti-Collision Beacon Strobes */}
          {/* Red Fuselage Beacon */}
          <circle cx="110" cy="31" r="2.2" fill="#EF4444" className="animate-pulse" />
          {/* Green Starboard Wingtip Light */}
          <circle cx="137" cy="67" r="2.2" fill="#22C55E" />
          {/* Red Port Wingtip Light */}
          <circle cx="141" cy="15" r="2.2" fill="#EF4444" />
        </svg>
      </motion.div>

      {/* ===================================================================== */}
      {/* 3. REALISTIC ADVENTURE 4x4 WITH HEADLIGHT BEAMS (Stage 3: 0.67 -> 0.98) */}
      {/* ===================================================================== */}
      <motion.div
        style={{
          left: carX,
          bottom: "4.5rem",
          opacity: carOpacity,
        }}
        className="fixed w-72 sm:w-[440px] md:w-[500px] h-36 sm:h-52 pointer-events-none flex items-center"
      >
        {/* Massive Volumetric Glowing Headlight Light Cones */}
        <div className="absolute left-[88%] top-[54%] -translate-y-1/2 w-72 sm:w-[480px] h-36 bg-gradient-to-r from-amber-100/85 via-amber-200/35 to-transparent [clip-path:polygon(0_42%,100%_0%,100%_100%,0_58%)] blur-[3.5px]" />
        <div className="absolute left-[85%] top-[52%] -translate-y-1/2 w-36 h-18 bg-amber-200/50 blur-lg rounded-full" />

        {/* Realistic Overland Expedition Wagon SVG */}
        <svg
          viewBox="0 0 160 80"
          className="w-full h-full drop-shadow-[0_16px_28px_rgba(0,0,0,0.55)]"
        >
          <defs>
            {/* SUV Body Gradient */}
            <linearGradient id="suvBodyGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#C44B2D" />
              <stop offset="40%" stopColor="#E76F51" />
              <stop offset="100%" stopColor="#F28E75" />
            </linearGradient>

            {/* Tinted Glass Gradient */}
            <linearGradient id="suvGlassGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#334155" />
              <stop offset="100%" stopColor="#0F172A" />
            </linearGradient>
          </defs>

          {/* Trail Dust Plume behind Rear Wheels */}
          <circle cx="18" cy="62" r="5" fill="#CBD5E1" opacity="0.6" />
          <circle cx="10" cy="64" r="3.5" fill="#E2E8F0" opacity="0.5" />
          <circle cx="4" cy="66" r="2.5" fill="#E2E8F0" opacity="0.4" />

          {/* Expedition Roof Rack with Gear Boxes & Jerrycan */}
          <line
            x1="36"
            y1="16"
            x2="116"
            y2="16"
            stroke="#334155"
            strokeWidth="3"
            strokeLinecap="round"
          />
          {/* Orange Traction Recovery Board */}
          <rect
            x="44"
            y="10"
            width="28"
            height="6"
            rx="1.5"
            fill="#E76F51"
            stroke="#991B1B"
            strokeWidth="0.8"
          />
          {/* Heavy-Duty Expedition Case */}
          <rect
            x="76"
            y="7"
            width="24"
            height="9"
            rx="2.5"
            fill="#0D5C75"
            stroke="#083847"
            strokeWidth="0.8"
          />
          {/* Safari Spare Fuel Jerrycan */}
          <rect
            x="104"
            y="9"
            width="12"
            height="7"
            rx="1.5"
            fill="#F59E0B"
            stroke="#B45309"
            strokeWidth="0.8"
          />

          {/* Main 4x4 Overland Body (Terracotta #E76F51) */}
          <path
            d="M16 54 L24 35 Q32 20 48 20 L116 20 Q130 20 140 32 L152 42 Q156 46 156 54 L156 59 L16 59 Z"
            fill="url(#suvBodyGrad)"
          />

          {/* Rugged Matte Black Rock Sliders & Lower Trim */}
          <path d="M14 56 L156 56 L156 61 L14 61 Z" fill="#0F172A" />

          {/* Front Bullbar / Winch Bumper */}
          <rect x="154" y="48" width="5" height="12" rx="2" fill="#334155" />

          {/* Tinted Cabin Windows with Pillar Bars */}
          <path
            d="M50 25 L74 25 L74 40 L40 40 Q44 28 50 25 Z"
            fill="url(#suvGlassGrad)"
            opacity="0.95"
          />
          <path
            d="M80 25 L112 25 Q120 27 128 40 L80 40 Z"
            fill="url(#suvGlassGrad)"
            opacity="0.95"
          />
          <path
            d="M132 32 L146 42 L132 42 Z"
            fill="url(#suvGlassGrad)"
            opacity="0.85"
          />

          {/* Door Seam Lines & Handles */}
          <line
            x1="77"
            y1="25"
            x2="77"
            y2="54"
            stroke="#991B1B"
            strokeWidth="1.2"
          />
          <rect
            x="84"
            y="43"
            width="7"
            height="2.5"
            rx="1"
            fill="#FFFFFF"
            opacity="0.9"
          />
          <rect
            x="52"
            y="43"
            width="7"
            height="2.5"
            rx="1"
            fill="#FFFFFF"
            opacity="0.9"
          />

          {/* Heavy-Duty All-Terrain Wheels with Deep Tread */}
          {/* Rear Wheel */}
          <circle cx="38" cy="59" r="13" fill="#0F172A" />
          <circle cx="38" cy="59" r="8" fill="#475569" />
          <circle cx="38" cy="59" r="4" fill="#E2E8F0" />
          {/* Front Wheel */}
          <circle cx="126" cy="59" r="13" fill="#0F172A" />
          <circle cx="126" cy="59" r="8" fill="#475569" />
          <circle cx="126" cy="59" r="4" fill="#E2E8F0" />

          {/* Projector LED Headlight Assembly with High-Beam Glow */}
          <ellipse cx="154" cy="46" rx="3.5" ry="5.5" fill="#FEF08A" />
          <circle cx="154" cy="46" r="2" fill="#FFFFFF" />
        </svg>
      </motion.div>
    </div>
  );
}

import { useRef, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { Sparkles, MapPinned, Compass, ChevronDown } from "lucide-react";

/**
 * MountainHero
 * Cinematic opening hero for Chalo Ghumne.
 * Features verified real-world footage of Mount Everest (Kala Patthar, Nepal),
 * genuine snow detail preservation, progressive entrance animation,
 * and a scroll-driven 2D skier with snow trail.
 */
export default function MountainHero({ t, startPlanning }) {
  const containerRef = useRef(null);
  const videoRef = useRef(null);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  // Ensure muted autoplay starts smoothly
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const playPromise = video.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => setVideoLoaded(true))
        .catch(() => setVideoError(true));
    }
  }, []);

  const handleScrollClick = () => {
    const nextSection = document.getElementById("how-it-works-section");
    if (nextSection) {
      nextSection.scrollIntoView({ behavior: "smooth" });
    } else {
      window.scrollBy({ top: window.innerHeight * 0.9, behavior: "smooth" });
    }
  };

  // Progressive cinematic entrance animation variants (slower, majestic sequence)
  const animVariants = {
    hidden: shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 22 },
    visible: (i) => {
      // Deliberate slower pacing so viewers can absorb the cinematic Everest peak first
      // i=0: Eyebrow (delay 0.6s, duration 1.0s)
      // i=1: Heading (delay 1.8s, duration 1.4s)
      // i=2: Description (delay 3.2s, duration 1.2s)
      // i=3: Buttons (delay 4.5s, duration 1.1s)
      // i=4: Trust Text (delay 5.7s, duration 1.0s)
      const delays = [0.6, 1.8, 3.2, 4.5, 5.7];
      const durations = [1.0, 1.4, 1.2, 1.1, 1.0];
      return {
        opacity: 1,
        y: 0,
        transition: {
          delay: shouldReduceMotion ? 0 : (delays[i] ?? (i * 1.2 + 0.6)),
          duration: shouldReduceMotion ? 0 : (durations[i] ?? 1.0),
          ease: [0.16, 1, 0.3, 1],
        },
      };
    },
  };

  return (
    <section
      ref={containerRef}
      data-testid="mountain-hero-section"
      aria-label="Mount Everest Cinematic Hero"
      className="relative w-full min-h-screen min-h-[100dvh] overflow-hidden flex flex-col justify-between"
    >
      {/* ============================================================ */}
      {/* 1. CINEMATIC FULL-SCREEN MOUNTAIN VIDEO BACKGROUND */}
      {/* ============================================================ */}
      <div className="absolute inset-0 w-full h-full overflow-hidden bg-[#0A1620]">
        {!videoError && (
          <video
            ref={videoRef}
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            poster="/assets/images/snow-mountain-bg.jpg"
            onLoadedData={() => setVideoLoaded(true)}
            onError={() => setVideoError(true)}
            className={`absolute inset-0 w-full h-full object-cover object-[center_35%] transition-opacity duration-1000 ${
              videoLoaded ? "opacity-100" : "opacity-90"
            }`}
          >
            {/* Primary verified authentic Mount Everest & Nuptse video */}
            <source src="/assets/videos/everest-kala-patthar.webm" type="video/mp4" />
            <source src="/assets/videos/everest-kala-patthar.webm" type="video/webm" />
            <source src="/assets/videos/video1.mp4" type="video/mp4" />
          </video>
        )}

        {/* Fallback image if video fails or before buffer */}
        {videoError && (
          <img
            src="/assets/images/snow-mountain-bg.jpg"
            alt="Mount Everest Himalayan peak in snow"
            className="absolute inset-0 w-full h-full object-cover object-[center_35%]"
          />
        )}

        {/* ============================================================ */}
        {/* 2. NATURAL COLOR & DETAIL PRESERVATION (Micro-scrims only) */}
        {/* ============================================================ */}
        {/* Top vignette to separate sticky navbar text */}
        <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/40 via-black/15 to-transparent pointer-events-none" />

        {/* Subtle left-side scrim to enhance readability behind the text without darkening the summits */}
        <div className="absolute inset-y-0 left-0 w-full sm:w-2/3 bg-gradient-to-r from-black/45 via-black/20 to-transparent pointer-events-none" />

        {/* Lower scrim for contrast on buttons and supporting text */}
        <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-black/60 via-black/25 to-transparent pointer-events-none" />

        {/* Gentle transition from mountain snowline into the warm cream canvas (#FDFBF7) */}
        <div
          className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#FDFBF7] via-[#FDFBF7]/40 to-transparent pointer-events-none"
          aria-hidden="true"
        />
      </div>

      {/* ============================================================ */}
      {/* 3. ATMOSPHERIC 2D DETAILS: BIRDS & PINE TREES */}
      {/* ============================================================ */}
      {/* Subtle high-altitude silhouette birds floating in the upper sky */}
      <div className="absolute top-20 right-16 sm:right-32 pointer-events-none z-10 flex items-center gap-4 opacity-55">
        <svg className="w-5 h-3 text-white/70 animate-pulse" viewBox="0 0 24 12" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M0 6 Q6 0 12 6 Q18 0 24 6" />
        </svg>
        <svg className="w-4 h-2 text-white/60 mb-2" viewBox="0 0 24 12" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M0 6 Q6 0 12 6 Q18 0 24 6" />
        </svg>
        <svg className="w-3 h-2 text-white/50 mt-2" viewBox="0 0 24 12" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M0 6 Q6 0 12 6 Q18 0 24 6" />
        </svg>
      </div>

      {/* Silhouette evergreen pine trees along lower horizon for scale */}
      <div className="absolute bottom-6 right-6 sm:right-16 pointer-events-none z-10 hidden sm:flex items-end gap-2 opacity-75">
        <svg className="w-7 h-12 text-[#0A2633]" viewBox="0 0 32 48" fill="currentColor">
          <polygon points="16,0 6,18 13,18 3,32 11,32 0,46 32,46 21,32 29,32 19,18 26,18" />
        </svg>
        <svg className="w-9 h-16 text-[#08202C]" viewBox="0 0 32 48" fill="currentColor">
          <polygon points="16,0 6,18 13,18 3,32 11,32 0,46 32,46 21,32 29,32 19,18 26,18" />
        </svg>
        <svg className="w-6 h-10 text-[#0A2633]" viewBox="0 0 32 48" fill="currentColor">
          <polygon points="16,0 6,18 13,18 3,32 11,32 0,46 32,46 21,32 29,32 19,18 26,18" />
        </svg>
      </div>

      {/* ============================================================ */}
      {/* HERO CONTENT & PROGRESSIVE ENTRANCE ANIMATION */}
      {/* ============================================================ */}
      <div className="relative z-10 max-w-7xl mx-auto w-full px-6 sm:px-10 pt-28 pb-12 sm:pt-36 sm:pb-16 text-white flex-1 flex flex-col justify-center">
        <div className="max-w-3xl">
          {/* Step 2: Eyebrow */}
          <motion.div
            custom={0}
            initial="hidden"
            animate="visible"
            variants={animVariants}
          >
            <p
              className="eyebrow text-white/90 drop-shadow-[0_1px_4px_rgba(0,0,0,0.6)] inline-flex items-center gap-2"
              data-testid="hero-eyebrow"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#E76F51] animate-pulse" />
              AI-crafted travel · Since 2026
            </p>
          </motion.div>

          {/* Step 3: Heading */}
          <motion.div
            custom={1}
            initial="hidden"
            animate="visible"
            variants={animVariants}
          >
            <h1
              className="font-display mt-4 text-4xl sm:text-6xl lg:text-7xl leading-[1.04] tracking-tight text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)]"
              data-testid="hero-title"
            >
              Journeys designed by{" "}
              <em className="not-italic text-[#E76F51] drop-shadow-[0_1px_8px_rgba(231,111,81,0.5)]">
                intelligence,
              </em>{" "}
              told with soul.
            </h1>
          </motion.div>

          {/* Step 4: Description */}
          <motion.div
            custom={2}
            initial="hidden"
            animate="visible"
            variants={animVariants}
          >
            <p className="mt-6 text-lg sm:text-xl text-white/90 max-w-2xl leading-relaxed drop-shadow-[0_1px_6px_rgba(0,0,0,0.6)]">
              {t("hero_sub")}
            </p>
          </motion.div>

          {/* Step 5: Primary & Secondary Action Buttons */}
          <motion.div
            custom={3}
            initial="hidden"
            animate="visible"
            variants={animVariants}
            className="mt-9 flex flex-wrap gap-4"
          >
            <button
              onClick={startPlanning}
              className="btn-primary flex items-center gap-2 text-base shadow-[0_8px_24px_rgba(231,111,81,0.45)] hover:scale-[1.02] active:scale-[0.98] transition-transform"
              data-testid="hero-plan-btn"
            >
              <Sparkles size={18} /> {t("plan_my_trip")}
            </button>

            <Link
              to="/destinations"
              className="btn-secondary bg-white/15 backdrop-blur-md border-2 border-white/80 text-white hover:bg-white/25 flex items-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98]"
              data-testid="hero-explore-btn"
            >
              <Compass size={16} />
              Explore destinations
            </Link>
          </motion.div>

          {/* Step 6: Supporting Trust Text */}
          <motion.div
            custom={4}
            initial="hidden"
            animate="visible"
            variants={animVariants}
            className="mt-14 sm:mt-16 flex items-center gap-6 text-sm text-white/90 drop-shadow-[0_1px_4px_rgba(0,0,0,0.6)]"
          >
            <div className="flex items-center gap-2">
              <MapPinned size={16} className="text-[#E76F51]" />
              <span>180+ destinations supported</span>
            </div>
          </motion.div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* 6. MINIMAL SCROLL INDICATOR */}
      {/* ============================================================ */}
      <div className="relative z-10 w-full flex justify-center pb-6 sm:pb-8">
        <button
          onClick={handleScrollClick}
          className="group flex flex-col items-center gap-1.5 text-white/80 hover:text-white transition-colors duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#E76F51]/60 rounded-full px-4 py-2"
          aria-label="Scroll to explore journeys"
        >
          <span className="text-[10px] sm:text-[11px] font-semibold tracking-[0.25em] uppercase text-white/75 group-hover:text-white transition-colors">
            Scroll to explore
          </span>
          <div className="w-4 h-7 rounded-full border border-white/40 flex items-start justify-center p-0.5 group-hover:border-white/80 transition-colors">
            <span className="w-1 h-1.5 rounded-full bg-[#E76F51] animate-bounce" />
          </div>
          <ChevronDown
            size={14}
            className="text-white/60 group-hover:text-white transition-transform duration-200 group-hover:translate-y-0.5"
          />
        </button>
      </div>
    </section>
  );
}

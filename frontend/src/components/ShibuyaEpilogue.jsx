import { useRef, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Sparkles, Compass, MapPin, Building2, Users } from "lucide-react";

/**
 * ShibuyaEpilogue
 * Environment 3: The Grand Nocturnal Finale of Chalo Ghumne.
 *
 * Requirements:
 * - Genuine footage of Shibuya Crossing in Tokyo, Japan at night.
 * - Pedestrians visibly walking across the crossing under light rain / umbrellas,
 *   illuminated buildings, digital billboards, and vibrant city lights.
 * - Muted autoplay and seamless looping.
 * - Lazy-loaded via IntersectionObserver when approaching the viewport.
 * - Authentic 1080p fallback poster image while buffering or on playback error.
 * - Responsive, non-blocking scrolling, preserves CTA and button functionality.
 */
export default function ShibuyaEpilogue({ t, startPlanning }) {
  const sectionRef = useRef(null);
  const videoRef = useRef(null);
  const [isInView, setIsInView] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [videoError, setVideoError] = useState(false);

  // Lazy-load trigger: only load video when within 350px of the viewport
  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: "350px 0px" }
    );

    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  // Attempt muted autoplay when in view
  useEffect(() => {
    if (!isInView) return;
    const video = videoRef.current;
    if (!video) return;

    const playPromise = video.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => setVideoLoaded(true))
        .catch(() => {
          // Keep poster fallback visible if autoplay is blocked
        });
    }
  }, [isInView]);

  return (
    <section
      ref={sectionRef}
      data-testid="shibuya-epilogue-section"
      aria-label="Tokyo Shibuya Crossing Nighttime Epilogue"
      className="relative w-full min-h-[92vh] sm:min-h-screen overflow-hidden flex flex-col justify-between bg-[#050B14] text-white"
    >
      {/* ============================================================ */}
      {/* 1. CINEMATIC FULL-WIDTH SHIBUYA CROSSING VIDEO BACKGROUND */}
      {/* ============================================================ */}
      <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none">
        {/* Lazy-loaded genuine Shibuya Crossing video footage */}
        {isInView && !videoError && (
          <video
            ref={videoRef}
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            poster="/assets/images/shibuya-night-bg.jpg"
            onLoadedData={() => setVideoLoaded(true)}
            onError={() => setVideoError(true)}
            className={`absolute inset-0 w-full h-full object-cover object-center transition-opacity duration-1000 ${
              videoLoaded ? "opacity-100" : "opacity-90"
            }`}
          >
            {/* Primary verified Tokyo Shibuya Crossing nighttime footage */}
            <source src="/assets/videos/shibuya-night.mp4" type="video/mp4" />
            <source src="/assets/videos/shibuya-night-timelapse.webm" type="video/mp4" />
            <source src="/assets/videos/shibuya-night-timelapse.webm" type="video/webm" />
            <source src="/assets/videos/shibuya-night.webm" type="video/webm" />
            <source src="/assets/videos/video2.mp4" type="video/webm" />
          </video>
        )}

        {/* Fallback image: High-res authentic photograph of Shibuya Crossing at night */}
        {(!videoLoaded || videoError) && (
          <img
            src="/assets/images/shibuya-night-bg.jpg"
            alt="Shibuya Crossing Tokyo at night with illuminated billboards and walking pedestrians"
            className={`absolute inset-0 w-full h-full object-cover object-center transition-opacity duration-1000 ${
              videoLoaded ? "opacity-0" : "opacity-100"
            }`}
          />
        )}

        {/* ============================================================ */}
        {/* 2. ATMOSPHERIC TRANSITIONS & NATURAL NIGHTTIME COLOR PRESERVATION */}
        {/* ============================================================ */}
        {/* Top transition: seamlessly blends from the warm cream canvas (#FDFBF7) into nocturnal Tokyo */}
        <div
          className="absolute inset-x-0 top-0 h-32 sm:h-44 bg-gradient-to-b from-[#FDFBF7] via-[#FDFBF7]/30 to-transparent pointer-events-none"
          aria-hidden="true"
        />

        {/* Top vignette to darken the upper sky for contrast */}
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/60 via-black/25 to-transparent pointer-events-none" />

        {/* Subtle radial center scrim to keep text legible without dimming city lights */}
        <div className="absolute inset-0 bg-radial-at-c from-black/25 via-black/45 to-black/75 pointer-events-none" />

        {/* Bottom subtle fade into the footer */}
        <div className="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-[#040810] via-black/50 to-transparent pointer-events-none" />
      </div>

      {/* ============================================================ */}
      {/* 3. SHIBUYA FINALE CONTENT & CALL TO ACTION */}
      {/* ============================================================ */}
      <div className="relative z-10 max-w-7xl mx-auto w-full px-6 sm:px-10 pt-28 sm:pt-36 pb-16 flex-1 flex flex-col justify-center">
        <div className="max-w-3xl">
          {/* Eyebrow badge with glowing emerald/amber indicator */}
          <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/20 text-xs sm:text-sm font-semibold tracking-wide uppercase text-white/90">
            <span className="w-2 h-2 rounded-full bg-[#22C55E] animate-pulse" />
            <span>Tokyo, Japan · Shibuya Crossing</span>
          </div>

          {/* Heading */}
          <h2 className="font-display mt-6 text-4xl sm:text-6xl lg:text-7xl leading-[1.06] tracking-tight text-white drop-shadow-[0_4px_16px_rgba(0,0,0,0.8)]">
            From quiet mountain peaks to the{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FEF08A] via-[#E76F51] to-[#F43F5E]">
              electric pulse
            </span>{" "}
            of Shibuya.
          </h2>

          {/* Narrative description */}
          <p className="mt-6 text-lg sm:text-xl text-white/90 max-w-2xl leading-relaxed drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
            Your next chapter is a click away. Whether you crave the silence of the Himalayas
            or the vibrant neon alleys of Tokyo, our AI crafts a complete, personalized day-by-day
            journey in seconds.
          </p>

          {/* Preserved Actions: Primary "Plan My Trip" + Secondary "Explore Destinations" */}
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <button
              onClick={startPlanning}
              className="btn-primary flex items-center gap-2.5 text-base shadow-[0_8px_28px_rgba(231,111,81,0.55)] hover:scale-[1.02] active:scale-[0.98] transition-transform"
              data-testid="cta-plan-btn"
            >
              <Sparkles size={18} />
              {t("plan_my_trip")}
            </button>

            <Link
              to="/destinations"
              className="btn-secondary bg-white/15 backdrop-blur-md border-2 border-white/80 text-white hover:bg-white/25 flex items-center gap-2 text-base transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Compass size={17} />
              Explore 180+ destinations
            </Link>
          </div>

          {/* Live Global Network Badges */}
          <div className="mt-12 sm:mt-16 flex flex-wrap items-center gap-4 sm:gap-6 text-xs sm:text-sm text-white/80">
            <div className="flex items-center gap-1.5 bg-black/40 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-white/10">
              <Building2 size={14} className="text-[#38BDF8]" />
              <span>Metropolis to Wilderness</span>
            </div>
            <div className="flex items-center gap-1.5 bg-black/40 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-white/10">
              <Users size={14} className="text-[#E76F51]" />
              <span>Personalized for every traveler</span>
            </div>
            <div className="flex items-center gap-1.5 bg-black/40 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-white/10">
              <MapPin size={14} className="text-[#22C55E]" />
              <span>180+ global cities</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

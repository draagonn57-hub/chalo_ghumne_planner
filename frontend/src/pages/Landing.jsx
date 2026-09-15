import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useLang } from "@/lib/LangContext";
import { useAuth } from "@/lib/AuthContext";
import { Sparkles, MapPinned, Wand2, ArrowRight, Star } from "lucide-react";
import DynamicBackground from "@/components/DynamicBackground";

export default function Landing() {
  const { t } = useLang();
  const { user } = useAuth();
  const nav = useNavigate();
  const [dests, setDests] = useState([]);

  useEffect(() => {
    api.get("/destinations").then((r) => setDests(r.data.slice(0, 6))).catch(() => {});
  }, []);

  const startPlanning = () => {
    if (!user) nav("/login?next=/plan");
    else nav("/plan");
  };

  return (
    <div data-testid="landing-page">
      {/* HERO */}
      <section className="relative overflow-hidden grain">
  <DynamicBackground mode="cycle" />

  <div className="relative max-w-7xl mx-auto px-6 sm:px-10 pt-28 pb-32 sm:pt-40 sm:pb-44 text-white">
          <div className="max-w-3xl animate-fade-up">
            <p className="eyebrow text-white/80" data-testid="hero-eyebrow">AI-crafted travel · Since 2026</p>
            <h1 className="font-display mt-4 text-5xl sm:text-7xl leading-[1.02] tracking-tight" data-testid="hero-title">
              Journeys designed by <em className="not-italic text-[#F2B48A]">intelligence,</em> told with soul.
            </h1>
            <p className="mt-6 text-lg sm:text-xl text-white/85 max-w-2xl">{t("hero_sub")}</p>
            <div className="mt-10 flex flex-wrap gap-4">
              <button onClick={startPlanning} className="btn-primary flex items-center gap-2 text-base" data-testid="hero-plan-btn">
                <Sparkles size={18} /> {t("plan_my_trip")}
              </button>
              <Link to="/destinations" className="btn-secondary bg-white/10 border-white/40 text-white hover:bg-white/15" data-testid="hero-explore-btn">
                Explore destinations
              </Link>
            </div>

            <div className="mt-14 flex items-center gap-6 text-sm text-white/80">
              <div className="flex items-center gap-2"><Star size={16} className="fill-[#F2B48A] text-[#F2B48A]" /> 4.9 avg on 12k trips</div>
              <div className="hidden sm:block w-px h-4 bg-white/30" />
              <div className="hidden sm:flex items-center gap-2"><MapPinned size={16} /> 180+ destinations</div>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="max-w-7xl mx-auto px-6 sm:px-10 py-24" data-testid="how-section">
        <div className="max-w-2xl">
          <p className="eyebrow">{t("how_it_works")}</p>
          <h2 className="font-display text-4xl sm:text-5xl mt-3 tracking-tight">Three steps. One unforgettable trip.</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-8 mt-14">
          {[
            { icon: Wand2, title: t("step1"), desc: t("step1_d"), n: "01" },
            { icon: Sparkles, title: t("step2"), desc: t("step2_d"), n: "02" },
            { icon: MapPinned, title: t("step3"), desc: t("step3_d"), n: "03" },
          ].map((s, i) => (
            <div key={i} className="tp-card p-8" data-testid={`how-step-${i}`}>
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-full bg-[#0D5C75]/10 text-[#0D5C75] flex items-center justify-center">
                  <s.icon size={22} />
                </div>
                <span className="font-display text-3xl text-[#E76F51]/70">{s.n}</span>
              </div>
              <h3 className="font-display text-2xl mt-6">{s.title}</h3>
              <p className="text-slate-600 mt-3 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* DESTINATIONS */}
      <section className="max-w-7xl mx-auto px-6 sm:px-10 py-16">
        <div className="flex items-end justify-between mb-10">
          <div>
            <p className="eyebrow">{t("popular")}</p>
            <h2 className="font-display text-4xl sm:text-5xl mt-3 tracking-tight">Where the curious go</h2>
          </div>
          <Link to="/destinations" className="hidden sm:flex items-center gap-1 text-[#0D5C75] font-semibold hover:gap-2 transition-[gap]" data-testid="view-all-link">
            {t("view_all")} <ArrowRight size={16} />
          </Link>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {dests.map((d, idx) => (
            <div key={d.id} className="tp-card overflow-hidden" data-testid={`destination-card-${idx}`}>
              <div className="aspect-[4/3] overflow-hidden">
                <img src={d.image} alt={d.name} className="w-full h-full object-cover transition-transform duration-500 hover:scale-105" />
              </div>
              <div className="p-6">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-2xl">{d.name}</h3>
                  <span className="text-xs uppercase tracking-widest text-[#E76F51] font-semibold">{d.type}</span>
                </div>
                <p className="text-sm text-slate-500 mt-1">{d.country}</p>
                <p className="text-slate-600 mt-4 text-sm line-clamp-2">{d.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-6 sm:px-10 py-24">
        <div className="relative rounded-3xl overflow-hidden bg-[#0D5C75] text-white p-10 sm:p-16">
          <div className="max-w-2xl relative z-10">
            <h2 className="font-display text-4xl sm:text-5xl">Your next chapter is a click away.</h2>
            <p className="mt-4 text-slate-200 text-lg">Start with a five-minute questionnaire and receive a full itinerary in seconds.</p>
            <button onClick={startPlanning} className="btn-primary mt-8" data-testid="cta-plan-btn">{t("plan_my_trip")}</button>
          </div>
          <div className="absolute -right-16 -bottom-24 w-[420px] h-[420px] rounded-full bg-[#E76F51] opacity-30 blur-3xl" />
        </div>
      </section>
    </div>
  );
}

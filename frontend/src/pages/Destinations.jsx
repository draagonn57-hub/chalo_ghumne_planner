import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { MapPin } from "lucide-react";

export default function Destinations() {
  const [dests, setDests] = useState([]);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    const q = filter === "all" ? "" : `?trip_type=${filter}`;
    api.get(`/destinations${q}`).then((r) => setDests(r.data));
  }, [filter]);

  return (
    <div className="max-w-7xl mx-auto px-6 py-12" data-testid="destinations-page">
      <p className="eyebrow">Curated by our travel editors</p>
      <h1 className="font-display text-5xl mt-2 tracking-tight">Destinations</h1>

      <div className="mt-8 flex gap-2">
        {[["all", "All"], ["national", "National"], ["international", "International"]].map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)}
            className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${filter === k ? "bg-[#0D5C75] text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"}`}
            data-testid={`dest-filter-${k}`}>{l}</button>
        ))}
      </div>

      <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
        {dests.map((d) => (
          <div key={d.id} className="tp-card overflow-hidden" data-testid={`dest-${d.id}`}>
            <div className="aspect-[4/3] overflow-hidden">
              <img src={d.image} alt={d.name} className="w-full h-full object-cover transition-transform duration-500 hover:scale-105" />
            </div>
            <div className="p-6">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-display text-2xl">{d.name}</h3>
                  <div className="text-sm text-slate-500 flex items-center gap-1 mt-0.5"><MapPin size={12} />{d.country}</div>
                </div>
                <span className="text-xs uppercase tracking-widest text-[#E76F51] font-semibold">{d.type}</span>
              </div>
              <p className="text-slate-600 mt-4 text-sm leading-relaxed">{d.description}</p>
              <div className="flex flex-wrap gap-1.5 mt-4">
                {d.tags?.map((t) => <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{t}</span>)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

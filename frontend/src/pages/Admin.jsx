import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Users, MapPinned, BedDouble, MessageSquare, Trash2, Plus } from "lucide-react";

export default function Admin() {
  const [tab, setTab] = useState("stats");
  return (
    <div className="max-w-7xl mx-auto px-6 py-12" data-testid="admin-page">
      <p className="eyebrow">Command center</p>
      <h1 className="font-display text-5xl mt-2 tracking-tight">Admin</h1>

      <div className="mt-8 flex gap-2 flex-wrap border-b border-slate-200">
        {[
          ["stats", "Overview"], ["users", "Users"], ["destinations", "Destinations"],
          ["hotels", "Hotels"], ["feedback", "Feedback"],
        ].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${tab === k ? "border-[#E76F51] text-[#E76F51]" : "border-transparent text-slate-500 hover:text-slate-800"}`}
            data-testid={`admin-tab-${k}`}>{l}</button>
        ))}
      </div>

      <div className="mt-8">
        {tab === "stats" && <Stats />}
        {tab === "users" && <Users_ />}
        {tab === "destinations" && <Dests />}
        {tab === "hotels" && <Hotels />}
        {tab === "feedback" && <Feedback />}
      </div>
    </div>
  );
}

function Stats() {
  const [s, setS] = useState(null);
  useEffect(() => { api.get("/admin/stats").then((r) => setS(r.data)); }, []);
  if (!s) return <div className="grid sm:grid-cols-4 gap-4">{[1,2,3,4].map(i => <div key={i} className="skeleton h-28" />)}</div>;
  const cards = [
    { icon: Users, label: "Users", val: s.users },
    { icon: MapPinned, label: "Destinations", val: s.destinations },
    { icon: BedDouble, label: "Hotels", val: s.hotels },
    { icon: MessageSquare, label: "Feedback", val: s.feedback },
    { icon: MapPinned, label: "Saved trips", val: s.itineraries },
  ];
  return (
    <div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4" data-testid="admin-stats">
        {cards.map((c) => (
          <div key={c.label} className="tp-card p-6">
            <div className="w-10 h-10 rounded-full bg-[#0D5C75]/10 text-[#0D5C75] flex items-center justify-center"><c.icon size={18} /></div>
            <div className="font-display text-4xl mt-4">{c.val}</div>
            <div className="text-slate-500 text-sm mt-1">{c.label}</div>
          </div>
        ))}
      </div>
      {s.popular_destinations?.length > 0 && (
        <div className="tp-card p-6 mt-6">
          <h3 className="font-display text-2xl">Popular destinations</h3>
          <ul className="mt-4 space-y-2">
            {s.popular_destinations.map((p) => (
              <li key={p.name} className="flex justify-between text-sm">
                <span>{p.name}</span><span className="text-[#E76F51] font-semibold">{p.count} trips</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Users_() {
  const [list, setList] = useState([]);
  const load = () => api.get("/admin/users").then((r) => setList(r.data));
  useEffect(() => { load(); }, []);
  const del = async (id) => {
    if (!confirm("Delete user?")) return;
    await api.delete(`/admin/users/${id}`); toast.success("Deleted"); load();
  };
  return (
    <div className="tp-card overflow-hidden" data-testid="admin-users">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
          <tr><th className="p-4">Name</th><th className="p-4">Email</th><th className="p-4">Role</th><th className="p-4">Joined</th><th /></tr>
        </thead>
        <tbody>
          {list.map((u) => (
            <tr key={u.id} className="border-t border-slate-100" data-testid={`admin-user-${u.id}`}>
              <td className="p-4">{u.name}</td>
              <td className="p-4">{u.email}</td>
              <td className="p-4"><span className={`text-xs px-2 py-0.5 rounded-full ${u.role === 'admin' ? 'bg-[#0D5C75]/10 text-[#0D5C75]' : 'bg-slate-100 text-slate-600'}`}>{u.role}</span></td>
              <td className="p-4 text-slate-500">{new Date(u.created_at).toLocaleDateString()}</td>
              <td className="p-4 text-right">
                {u.role !== "admin" && <button onClick={() => del(u.id)} className="text-[#E76F51] hover:underline text-sm" data-testid={`del-user-${u.id}`}><Trash2 size={14} /></button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Dests() {
  const [list, setList] = useState([]);
  const [f, setF] = useState({ name: "", country: "", type: "national", description: "", image: "" });
  const load = () => api.get("/destinations").then((r) => setList(r.data));
  useEffect(() => { load(); }, []);
  const add = async (e) => {
    e.preventDefault();
    await api.post("/admin/destinations", { ...f, tags: [] });
    toast.success("Added"); setF({ name: "", country: "", type: "national", description: "", image: "" }); load();
  };
  const del = async (id) => { if (!confirm("Delete?")) return; await api.delete(`/admin/destinations/${id}`); load(); };
  return (
    <div className="grid lg:grid-cols-3 gap-6" data-testid="admin-dests">
      <form onSubmit={add} className="tp-card p-6 space-y-3">
        <h3 className="font-display text-xl">Add destination</h3>
        <input required placeholder="Name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200" data-testid="dest-name" />
        <input required placeholder="Country" value={f.country} onChange={(e) => setF({ ...f, country: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200" data-testid="dest-country" />
        <select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200" data-testid="dest-type">
          <option value="national">National</option><option value="international">International</option>
        </select>
        <input placeholder="Image URL" value={f.image} onChange={(e) => setF({ ...f, image: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200" data-testid="dest-image" />
        <textarea placeholder="Description" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} rows={3} className="w-full px-3 py-2 rounded-lg border border-slate-200" data-testid="dest-desc" />
        <button className="btn-primary flex items-center gap-2 text-sm" data-testid="dest-add"><Plus size={14} /> Add</button>
      </form>
      <div className="lg:col-span-2 space-y-3">
        {list.map((d) => (
          <div key={d.id} className="tp-card p-4 flex items-center gap-4" data-testid={`admin-dest-${d.id}`}>
            <img src={d.image} alt={d.name} className="w-16 h-16 rounded-lg object-cover" />
            <div className="flex-1"><div className="font-semibold">{d.name}, {d.country}</div><div className="text-xs text-slate-500">{d.type}</div></div>
            <button onClick={() => del(d.id)} className="text-[#E76F51]" data-testid={`del-dest-${d.id}`}><Trash2 size={16} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

function Hotels() {
  const [list, setList] = useState([]);
  const [f, setF] = useState({ name: "", city: "", price_per_night: 100, rating: 4.0, image: "" });
  const load = () => api.get("/hotels").then((r) => setList(r.data));
  useEffect(() => { load(); }, []);
  const add = async (e) => {
    e.preventDefault();
    await api.post("/admin/hotels", { ...f, price_per_night: Number(f.price_per_night), rating: Number(f.rating), amenities: [] });
    toast.success("Added"); setF({ name: "", city: "", price_per_night: 100, rating: 4.0, image: "" }); load();
  };
  const del = async (id) => { if (!confirm("Delete?")) return; await api.delete(`/admin/hotels/${id}`); load(); };
  return (
    <div className="grid lg:grid-cols-3 gap-6" data-testid="admin-hotels">
      <form onSubmit={add} className="tp-card p-6 space-y-3">
        <h3 className="font-display text-xl">Add hotel</h3>
        <input required placeholder="Name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200" data-testid="hotel-name" />
        <input required placeholder="City" value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200" data-testid="hotel-city" />
        <input type="number" placeholder="Price/night" value={f.price_per_night} onChange={(e) => setF({ ...f, price_per_night: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200" data-testid="hotel-price" />
        <input type="number" step="0.1" placeholder="Rating" value={f.rating} onChange={(e) => setF({ ...f, rating: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200" data-testid="hotel-rating" />
        <input placeholder="Image URL" value={f.image} onChange={(e) => setF({ ...f, image: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-200" data-testid="hotel-image" />
        <button className="btn-primary flex items-center gap-2 text-sm" data-testid="hotel-add"><Plus size={14} /> Add</button>
      </form>
      <div className="lg:col-span-2 space-y-3">
        {list.map((h) => (
          <div key={h.id} className="tp-card p-4 flex items-center gap-4">
            <img src={h.image} alt={h.name} className="w-16 h-16 rounded-lg object-cover" />
            <div className="flex-1"><div className="font-semibold">{h.name}</div><div className="text-xs text-slate-500">{h.city} · ${h.price_per_night}/night · ★{h.rating}</div></div>
            <button onClick={() => del(h.id)} className="text-[#E76F51]" data-testid={`del-hotel-${h.id}`}><Trash2 size={16} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

function Feedback() {
  const [list, setList] = useState([]);
  const load = () => api.get("/admin/feedback").then((r) => setList(r.data));
  useEffect(() => { load(); }, []);
  const del = async (id) => { if (!confirm("Delete?")) return; await api.delete(`/admin/feedback/${id}`); load(); };
  return (
    <div className="space-y-3" data-testid="admin-feedback">
      {list.length === 0 && <div className="text-slate-500">No feedback yet.</div>}
      {list.map((f) => (
        <div key={f.id} className="tp-card p-5">
          <div className="flex justify-between items-start">
            <div>
              <div className="font-semibold">{f.user_name} <span className="text-[#E76F51] ml-2">★ {f.rating}</span></div>
              <div className="text-xs text-slate-500">{f.target_type} · {new Date(f.created_at).toLocaleString()}</div>
            </div>
            <button onClick={() => del(f.id)} className="text-[#E76F51]" data-testid={`del-feedback-${f.id}`}><Trash2 size={16} /></button>
          </div>
          {f.comment && <p className="mt-3 text-slate-600">{f.comment}</p>}
        </div>
      ))}
    </div>
  );
}

import { useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { api } from "@/lib/api";
import { toast } from "sonner";

export default function Profile() {
  const { user, setUser } = useAuth();
  const [name, setName] = useState(user?.name || "");
  const [avatar, setAvatar] = useState(user?.avatar || "");
  const [busy, setBusy] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.patch("/auth/profile", { name, avatar });
      setUser(data);
      toast.success("Profile updated");
    } catch { toast.error("Update failed"); }
    finally { setBusy(false); }
  };

  if (!user) return null;
  return (
    <div className="max-w-3xl mx-auto px-6 py-12" data-testid="profile-page">
      <p className="eyebrow">Your account</p>
      <h1 className="font-display text-5xl mt-2 tracking-tight">Profile</h1>

      <div className="mt-10 flex items-center gap-5">
        <div className="w-20 h-20 rounded-full bg-[#E76F51] text-white flex items-center justify-center font-display text-3xl overflow-hidden">
          {avatar ? <img src={avatar} alt="avatar" className="w-full h-full object-cover" /> : (user.name?.[0]?.toUpperCase() || "U")}
        </div>
        <div>
          <div className="font-display text-2xl">{user.name}</div>
          <div className="text-slate-500 text-sm">{user.email}</div>
          {user.role === "admin" && <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded-full bg-[#0D5C75]/10 text-[#0D5C75] font-semibold">ADMIN</span>}
        </div>
      </div>

      <form onSubmit={save} className="tp-card p-8 mt-10 space-y-5" data-testid="profile-form">
        <label className="block">
          <span className="text-xs uppercase tracking-widest text-slate-500 font-semibold">Display name</span>
          <input value={name} onChange={(e) => setName(e.target.value)}
            className="mt-2 w-full px-4 py-3 rounded-xl border border-slate-200 bg-white focus:border-[#E76F51] focus:outline-none"
            data-testid="profile-name" />
        </label>
        <label className="block">
          <span className="text-xs uppercase tracking-widest text-slate-500 font-semibold">Avatar URL (optional)</span>
          <input value={avatar} onChange={(e) => setAvatar(e.target.value)} placeholder="https://…"
            className="mt-2 w-full px-4 py-3 rounded-xl border border-slate-200 bg-white focus:border-[#E76F51] focus:outline-none"
            data-testid="profile-avatar" />
        </label>
        <button className="btn-primary" disabled={busy} data-testid="profile-save">{busy ? "Saving…" : "Save changes"}</button>
      </form>
    </div>
  );
}

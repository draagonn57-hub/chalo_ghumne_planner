import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { api } from "@/lib/api";
import { toast } from "sonner";
import DynamicBackground from "@/components/DynamicBackground";

export function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const next = new URLSearchParams(loc.search).get("next") || "/dashboard";
  const [form, setForm] = useState({ email: "", password: "" });
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await login(form.email, form.password);
      toast.success("Welcome back");
      nav(next);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Login failed");
    } finally { setBusy(false); }
  };

  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to continue planning your next journey.">
      <form onSubmit={submit} className="space-y-4" data-testid="login-form">
        <Field label="Email" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} testid="login-email" />
        <Field label="Password" type="password" value={form.password} onChange={(v) => setForm({ ...form, password: v })} testid="login-password" />
        <button className="btn-primary w-full" disabled={busy} data-testid="login-submit">{busy ? "Signing in…" : "Sign in"}</button>
        <div className="flex items-center justify-between text-sm pt-2">
          <Link to="/forgot" className="text-[#0D5C75] hover:underline" data-testid="link-forgot">Forgot password?</Link>
          <Link to="/signup" className="text-[#0D5C75] hover:underline" data-testid="link-signup">Create account</Link>
        </div>
      </form>
    </AuthLayout>
  );
}

export function Signup() {
  const { signup } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await signup(form.name, form.email, form.password);
      toast.success("Account created");
      nav("/plan");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Signup failed");
    } finally { setBusy(false); }
  };

  return (
    <AuthLayout title="Begin your journey" subtitle="Create a free account to save trips and access your history.">
      <form onSubmit={submit} className="space-y-4" data-testid="signup-form">
        <Field label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} testid="signup-name" />
        <Field label="Email" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} testid="signup-email" />
        <Field label="Password (min 6 chars)" type="password" value={form.password} onChange={(v) => setForm({ ...form, password: v })} testid="signup-password" />
        <button className="btn-primary w-full" disabled={busy} data-testid="signup-submit">{busy ? "Creating…" : "Create account"}</button>
        <p className="text-sm text-center text-slate-500 pt-2">Already have an account? <Link to="/login" className="text-[#0D5C75] hover:underline" data-testid="link-login">Sign in</Link></p>
      </form>
    </AuthLayout>
  );
}

export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [resetToken, setResetToken] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.post("/auth/forgot-password", { email });
      if (data.reset_token) setResetToken(data.reset_token);
      toast.success(data.message);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed");
    } finally { setBusy(false); }
  };

  return (
    <AuthLayout title="Reset your password" subtitle="Enter your email and we'll send a reset link.">
      <form onSubmit={submit} className="space-y-4" data-testid="forgot-form">
        <Field label="Email" type="email" value={email} onChange={setEmail} testid="forgot-email" />
        <button className="btn-primary w-full" disabled={busy} data-testid="forgot-submit">{busy ? "Sending…" : "Send reset link"}</button>
      </form>
      {resetToken && (
        <div className="mt-6 p-4 rounded-xl bg-amber-50 border border-amber-200 text-sm" data-testid="reset-token-box">
          <div className="font-semibold text-amber-900">DEV MODE — email is MOCKED</div>
          <div className="mt-2 text-amber-800">Your reset token (paste on the reset page):</div>
          <code className="mt-2 block break-all bg-white p-2 rounded" data-testid="reset-token-value">{resetToken}</code>
          <Link to={`/reset?token=${resetToken}`} className="inline-block mt-3 text-[#0D5C75] font-semibold hover:underline" data-testid="use-token-link">Use this token →</Link>
        </div>
      )}
    </AuthLayout>
  );
}

export function ResetPassword() {
  const loc = useLocation();
  const nav = useNavigate();
  const [token, setToken] = useState(new URLSearchParams(loc.search).get("token") || "");
  const [pwd, setPwd] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post("/auth/reset-password", { token, new_password: pwd });
      toast.success("Password reset. Sign in.");
      nav("/login");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed");
    } finally { setBusy(false); }
  };

  return (
    <AuthLayout title="Set new password" subtitle="Paste your reset token and choose a new password.">
      <form onSubmit={submit} className="space-y-4" data-testid="reset-form">
        <Field label="Reset token" value={token} onChange={setToken} testid="reset-token" />
        <Field label="New password" type="password" value={pwd} onChange={setPwd} testid="reset-password" />
        <button className="btn-primary w-full" disabled={busy} data-testid="reset-submit">{busy ? "Saving…" : "Reset password"}</button>
      </form>
    </AuthLayout>
  );
}

function Field({ label, type = "text", value, onChange, testid }) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-widest text-slate-500 font-semibold">{label}</span>
      <input
        type={type} value={value} onChange={(e) => onChange(e.target.value)} required
        data-testid={testid}
        className="mt-2 w-full px-4 py-3 rounded-xl border border-slate-200 bg-white focus:border-[#E76F51] focus:outline-none transition-colors"
      />
    </label>
  );
}

function AuthLayout({ title, subtitle, children }) {
  return (
    <div className="relative min-h-[calc(100vh-5rem)] overflow-hidden">
      {/* Background */}
      <DynamicBackground
        mode="static"
        overlayClassName="bg-gradient-to-br from-[#0D5C75]/70 via-[#0A1E28]/45 to-[#0A1E28]/70"
      />

      <div className="relative z-10 min-h-[calc(100vh-5rem)] flex flex-col items-center justify-center px-6 py-16 sm:px-10">
        <div
          className="glass-card animate-glass-pop w-full max-w-md p-8 sm:p-10"
          data-testid="auth-glass-card"
        >
          <h1 className="font-display text-4xl tracking-tight text-[#0A1E28]">
            {title}
          </h1>

          <p className="text-slate-600 mt-2">
            {subtitle}
          </p>

          <div className="mt-8">
            {children}
          </div>
        </div>

        <div className="mt-8 text-center text-white/85 max-w-md animate-fade-up">
          <p className="eyebrow text-white/70">
            Voyage
          </p>

          <p className="font-display text-lg sm:text-xl mt-2 leading-snug">
            Every great trip begins with a whisper of curiosity.
          </p>
        </div>
      </div>
    </div>
  );
}

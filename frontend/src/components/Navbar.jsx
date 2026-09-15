import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { useLang } from "@/lib/LangContext";
import { Compass, Globe as Globe2, ChevronDown, Menu, X } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function Navbar() {
  const { user, logout } = useAuth();
  const { lang, setLang, t } = useLang();
  const nav = useNavigate();
  const loc = useLocation();
  const [open, setOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setOpen(false);
    setLangOpen(false);
  }, [loc.pathname]);

  useEffect(() => {
    const h = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
        setLangOpen(false);
      }
    };
    document.addEventListener("click", h);
    return () => document.removeEventListener("click", h);
  }, []);

  const isActive = (path) => loc.pathname === path;

  const navLink = (to, label, testId) => (
    <Link
      to={to}
      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
        isActive(to)
          ? "bg-[#0D5C75]/10 text-[#0D5C75]"
          : "text-slate-600 hover:bg-slate-100"
      }`}
      data-testid={testId}
    >
      {label}
    </Link>
  );

  return (
    <header
      className={`sticky top-0 z-40 transition-all duration-300 ${
        scrolled
          ? "backdrop-blur-md bg-[#FDFBF7]/90 border-b border-slate-100 shadow-sm"
          : "bg-[#FDFBF7]/60 backdrop-blur-sm"
      }`}
      data-testid="navbar"
    >
      <div className="max-w-7xl mx-auto px-6 sm:px-10 h-20 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2" data-testid="nav-logo">
          <div className="w-9 h-9 rounded-full bg-[#0D5C75] text-white flex items-center justify-center">
            <Compass size={18} strokeWidth={2.4} />
          </div>
          <span className="font-display text-2xl tracking-tight">Voyage</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1" ref={menuRef}>
          {navLink("/destinations", "Destinations", "nav-destinations")}
          {user && navLink("/dashboard", t("dashboard"), "nav-dashboard")}
          {user?.role === "admin" && navLink("/admin", t("admin"), "nav-admin")}

          <div className="relative">
            <button
              onClick={() => setLangOpen(!langOpen)}
              className="btn-ghost flex items-center gap-1"
              data-testid="nav-lang"
            >
              <Globe2 size={16} /> {lang.toUpperCase()} <ChevronDown size={14} />
            </button>
            {langOpen && (
              <div className="absolute right-0 mt-2 bg-white border border-slate-100 rounded-xl shadow-lg overflow-hidden min-w-[140px]">
                {[["en", "English"], ["es", "Español"], ["hi", "हिंदी"]].map(([k, label]) => (
                  <button
                    key={k}
                    onClick={() => { setLang(k); setLangOpen(false); }}
                    className="block w-full text-left px-4 py-2 text-sm hover:bg-[#0D5C75]/5"
                    data-testid={`lang-${k}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {!user ? (
            <>
              <Link to="/login" className="btn-ghost" data-testid="nav-login">{t("login")}</Link>
              <Link to="/signup" className="btn-primary text-sm" data-testid="nav-signup">{t("signup")}</Link>
            </>
          ) : (
            <div className="relative">
              <button
                onClick={() => setOpen(!open)}
                className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-full border border-slate-200 hover:bg-slate-50 transition-colors"
                data-testid="nav-user"
              >
                <div className="w-8 h-8 rounded-full bg-[#E76F51] text-white flex items-center justify-center font-semibold text-sm">
                  {user.name?.[0]?.toUpperCase() || "U"}
                </div>
                <span className="text-sm font-medium">{user.name}</span>
                <ChevronDown size={14} />
              </button>
              {open && (
                <div className="absolute right-0 mt-2 bg-white border border-slate-100 rounded-xl shadow-lg overflow-hidden min-w-[180px]">
                  <Link to="/profile" onClick={() => setOpen(false)} className="block px-4 py-2.5 text-sm hover:bg-[#0D5C75]/5" data-testid="menu-profile">{t("profile")}</Link>
                  <Link to="/dashboard" onClick={() => setOpen(false)} className="block px-4 py-2.5 text-sm hover:bg-[#0D5C75]/5" data-testid="menu-dashboard">{t("dashboard")}</Link>
                  <button
                    onClick={() => { logout(); setOpen(false); nav("/"); }}
                    className="block w-full text-left px-4 py-2.5 text-sm text-[#E76F51] hover:bg-[#E76F51]/5"
                    data-testid="menu-logout"
                  >
                    {t("logout")}
                  </button>
                </div>
              )}
            </div>
          )}
        </nav>

        {/* Mobile toggle */}
        <button
          className="md:hidden p-2 rounded-lg hover:bg-slate-100 transition-colors"
          onClick={() => setMobileOpen(!mobileOpen)}
          data-testid="nav-mobile-toggle"
        >
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="md:hidden overflow-hidden bg-[#FDFBF7] border-b border-slate-100"
          >
            <div className="px-6 py-4 space-y-2">
              {navLink("/destinations", "Destinations", "nav-destinations-mobile")}
              {user && navLink("/dashboard", t("dashboard"), "nav-dashboard-mobile")}
              {user?.role === "admin" && navLink("/admin", t("admin"), "nav-admin-mobile")}

              <div className="flex items-center gap-2 pt-2">
                <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Language</span>
                {[["en", "EN"], ["es", "ES"], ["hi", "HI"]].map(([k, label]) => (
                  <button
                    key={k}
                    onClick={() => setLang(k)}
                    className={`px-2 py-1 rounded-md text-xs font-medium ${
                      lang === k ? "bg-[#0D5C75] text-white" : "bg-slate-100 text-slate-600"
                    }`}
                    data-testid={`lang-mobile-${k}`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="pt-3 border-t border-slate-100">
                {!user ? (
                  <div className="flex gap-2">
                    <Link to="/login" className="btn-secondary flex-1 text-center text-sm" data-testid="nav-login-mobile">{t("login")}</Link>
                    <Link to="/signup" className="btn-primary flex-1 text-center text-sm" data-testid="nav-signup-mobile">{t("signup")}</Link>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Link to="/profile" className="block px-3 py-2 rounded-lg text-sm hover:bg-slate-100" data-testid="menu-profile-mobile">{t("profile")}</Link>
                    <button
                      onClick={() => { logout(); nav("/"); }}
                      className="block w-full text-left px-3 py-2 rounded-lg text-sm text-[#E76F51] hover:bg-[#E76F51]/5"
                      data-testid="menu-logout-mobile"
                    >
                      {t("logout")}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

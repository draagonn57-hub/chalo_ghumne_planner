import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { useLang } from "@/lib/LangContext";
import { useTheme } from "@/lib/ThemeContext";
import { Globe as Globe2, ChevronDown, Menu, X, Home, Sun, Moon, Search } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import SearchModal from "@/components/SearchModal";

export default function Navbar() {
  const { user, logout } = useAuth();
  const { lang, setLang, t } = useLang();
  const { isDark, toggle: toggleTheme } = useTheme();
  const nav = useNavigate();
  const loc = useLocation();
  const [open, setOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const menuRef = useRef(null);
  const mobileMenuId = "mobile-nav-menu";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setOpen(false);
    setLangOpen(false);
    setSearchOpen(false);
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

  // Escape closes mobile menu (Feature 4)
  useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [mobileOpen]);

  // Ctrl/Cmd+K opens search (Feature 2)
  useEffect(() => {
    const onKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const isActive = (path) => loc.pathname === path;

  const navLink = (to, label, testId) => (
    <Link
      to={to}
      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors relative ${
        isActive(to)
          ? "bg-[#0D5C75]/10 text-[#0D5C75] font-semibold after:absolute after:bottom-0 after:left-3 after:right-3 after:h-0.5 after:rounded-full after:bg-[#E76F51] dark:bg-[#0D5C75]/20 dark:text-[#5eead4]"
          : "text-slate-600 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10"
      }`}
      aria-current={isActive(to) ? "page" : undefined}
      data-testid={testId}
    >
      {label}
    </Link>
  );

  return (
    <header
      className={`sticky top-0 z-40 transition-all duration-300 ${
        scrolled
          ? "backdrop-blur-md bg-[#FDFBF7]/90 border-b border-slate-100 shadow-sm dark:bg-[#1A2530]/90 dark:border-slate-800"
          : "bg-[#FDFBF7]/60 backdrop-blur-sm dark:bg-[#1A2530]/60"
      }`}
      data-testid="navbar"
    >
      <div className="max-w-7xl mx-auto px-6 sm:px-10 h-20 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2" data-testid="nav-logo">
          <img
            src="/assets/images/logo.png"
            alt="Chalo Ghumne"
            className="w-11 h-11 object-contain rounded-full"
          />
          <span className="font-display text-2xl tracking-tight">Chalo Ghumne</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1" ref={menuRef}>
          {/* Home icon — only shown when not on the homepage */}
          {loc.pathname !== "/" && (
            <Link
              to="/"
              className="relative group p-2 rounded-full text-slate-500 hover:bg-slate-100 hover:text-[#0D5C75] transition-colors dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-[#5eead4]"
              aria-label="Go to Homepage"
              data-testid="nav-home"
            >
              <Home size={18} />
              {/* Tooltip */}
              <span className="pointer-events-none absolute top-full left-1/2 -translate-x-1/2 mt-2 whitespace-nowrap rounded-full bg-[#1A2530] text-white text-[11px] font-medium px-2.5 py-1 shadow-md opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50">
                Go to Homepage
              </span>
            </Link>
          )}

          {/* Search button */}
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="relative group p-2 rounded-full text-slate-500 hover:bg-slate-100 hover:text-[#0D5C75] transition-colors dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-[#5eead4]"
            aria-label="Search pages (Ctrl+K)"
            title="Search pages (Ctrl+K)"
            data-testid="nav-search"
          >
            <Search size={18} />
          </button>

          {/* Dark mode toggle */}
          <button
            type="button"
            onClick={toggleTheme}
            className="relative group p-2 rounded-full text-slate-500 hover:bg-slate-100 hover:text-[#0D5C75] transition-colors dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-[#5eead4]"
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
            aria-pressed={isDark}
            title={isDark ? "Switch to light mode" : "Switch to dark mode"}
            data-testid="nav-theme-toggle"
          >
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
            <span className="pointer-events-none absolute top-full left-1/2 -translate-x-1/2 mt-2 whitespace-nowrap rounded-full bg-[#1A2530] text-white text-[11px] font-medium px-2.5 py-1 shadow-md opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50">
              {isDark ? "Light mode" : "Dark mode"}
            </span>
          </button>

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
              <div className="absolute right-0 mt-2 bg-white border border-slate-100 rounded-xl shadow-lg overflow-hidden min-w-[140px] dark:bg-[#233140] dark:border-slate-700">
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
                className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-full border border-slate-200 hover:bg-slate-50 transition-colors dark:border-slate-700 dark:hover:bg-white/10"
                data-testid="nav-user"
              >
                <div className="w-8 h-8 rounded-full bg-[#E76F51] text-white flex items-center justify-center font-semibold text-sm">
                  {user.name?.[0]?.toUpperCase() || "U"}
                </div>
                <span className="text-sm font-medium">{user.name}</span>
                <ChevronDown size={14} />
              </button>
              {open && (
                <div className="absolute right-0 mt-2 bg-white border border-slate-100 rounded-xl shadow-lg overflow-hidden min-w-[180px] dark:bg-[#233140] dark:border-slate-700">
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
          aria-label="Toggle menu"
          aria-expanded={mobileOpen}
          aria-controls={mobileMenuId}
          data-testid="nav-mobile-toggle"
        >
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            id={mobileMenuId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="md:hidden overflow-hidden bg-[#FDFBF7] border-b border-slate-100 dark:bg-[#1A2530] dark:border-slate-800"
          >
            <div className="px-6 py-4 space-y-2">
              {loc.pathname !== "/" && (
                <Link
                  to="/"
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-[#0D5C75] transition-colors dark:text-slate-200 dark:hover:bg-white/10"
                  data-testid="nav-home-mobile"
                >
                  <Home size={16} />
                  Go to Homepage
                </Link>
              )}
              {/* Dark mode toggle (mobile) */}
              <button
                type="button"
                onClick={toggleTheme}
                className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors dark:text-slate-200 dark:hover:bg-white/10"
                aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
                aria-pressed={isDark}
                data-testid="nav-theme-toggle-mobile"
              >
                {isDark ? <Sun size={16} /> : <Moon size={16} />}
                {isDark ? "Light mode" : "Dark mode"}
              </button>
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
                      lang === k ? "bg-[#0D5C75] text-white" : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-200"
                    }`}
                    data-testid={`lang-mobile-${k}`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                {!user ? (
                  <div className="flex gap-2">
                    <Link to="/login" className="btn-secondary flex-1 text-center text-sm" data-testid="nav-login-mobile">{t("login")}</Link>
                    <Link to="/signup" className="btn-primary flex-1 text-center text-sm" data-testid="nav-signup-mobile">{t("signup")}</Link>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Link to="/profile" className="block px-3 py-2 rounded-lg text-sm hover:bg-slate-100 dark:hover:bg-white/10" data-testid="menu-profile-mobile">{t("profile")}</Link>
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

      {/* Site search modal (Feature 2) */}
      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
    </header>
  );
}

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TrendingUp, TrendingDown, Activity, LogOut, User, Menu, X } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { getStockInfo } from "@/lib/api";

const NAV_ITEMS = [
  { key: "dashboard" as const,   to: "/dashboard",   protected: true  },
  { key: "market" as const,      to: "/mercado",     protected: true  },
  { key: "forecasts" as const,   to: "/forecast",    protected: true  },
  { key: "analysis" as const,    to: "/analise",     protected: true  },
  { key: "portfolio" as const,   to: "/portfolio",   protected: true  },
  { key: "alerts" as const,      to: "/alertas",     protected: true  },
  { key: "compare" as const,     to: "/comparar",    protected: true  },
  { key: "backtesting" as const, to: "/backtesting", protected: true  },
  { key: "pricing" as const,     to: "/pricing",     protected: false },
];

const Navbar = () => {
  const { user, signOut } = useAuth();
  const { lang, setLang, t } = useLanguage();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sp500, setSp500] = useState<{ change: number | null }>({ change: null });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const fetchSp500 = async () => {
      try {
        const data = await getStockInfo("^GSPC");
        setSp500({ change: data.change ?? null });
      } catch {
        // keep previous value on error
      }
    };
    fetchSp500();
    intervalRef.current = setInterval(fetchSp500, 60_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const handleSignOut = async () => {
    await signOut();
    window.location.href = "/";
  };

  const handleNavClick = (item: typeof NAV_ITEMS[0]) => {
    navigate(item.protected && !user ? "/login" : item.to);
    setMobileOpen(false);
  };

  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="fixed top-0 left-0 right-0 z-50 glass"
    >
      <div className="container mx-auto flex items-center justify-between px-6 py-4">
        <Link to="/" className="flex items-center gap-2">
          <Activity className="h-6 w-6 text-primary" />
          <span className="text-xl font-bold tracking-tight text-foreground">
            Apex<span className="text-primary">Predict</span>
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-8">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.key}
              onClick={() => handleNavClick(item)}
              className="text-sm text-muted-foreground hover:text-primary transition-colors font-medium"
            >
              {t.nav[item.key]}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          {/* S&P 500 ticker */}
          <div className="hidden sm:flex items-center gap-2 rounded-lg bg-secondary px-3 py-1.5">
            {sp500.change !== null && sp500.change < 0 ? (
              <TrendingDown className="h-3.5 w-3.5 text-chart-down" />
            ) : (
              <TrendingUp className="h-3.5 w-3.5 text-chart-up" />
            )}
            <span className={`font-mono text-xs ${sp500.change !== null && sp500.change < 0 ? "text-chart-down" : "text-chart-up"}`}>
              S&P 500 {sp500.change !== null ? `${sp500.change >= 0 ? "+" : ""}${sp500.change.toFixed(2)}%` : "…"}
            </span>
          </div>

          {/* Language toggle */}
          <button
            onClick={() => setLang(lang === "en" ? "pt" : "en")}
            className="hidden sm:flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 font-mono text-xs font-semibold text-muted-foreground hover:text-primary hover:border-primary transition-colors"
            title={lang === "en" ? "Switch to Portuguese" : "Mudar para Inglês"}
          >
            {lang === "en" ? "PT" : "EN"}
          </button>

          {user ? (
            <div className="flex items-center gap-2">
              <Link
                to="/profile"
                className="hidden sm:flex items-center gap-1.5 rounded-lg bg-secondary px-3 py-1.5 hover:border hover:border-primary transition-colors"
              >
                <User className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-mono text-xs text-muted-foreground truncate max-w-[120px]">
                  {user.user_metadata?.full_name ?? user.email}
                </span>
              </Link>
              <button
                onClick={handleSignOut}
                className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted-foreground hover:text-primary hover:border-primary transition-colors"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{t.nav.logout}</span>
              </button>
            </div>
          ) : (
            <Link
              to="/login"
              className="hidden md:block rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
            >
              {t.nav.register}
            </Link>
          )}

          {/* Hamburger */}
          <button
            className="md:hidden flex items-center justify-center rounded-lg border border-border p-2 text-muted-foreground hover:text-primary hover:border-primary transition-colors"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="md:hidden border-t border-border overflow-hidden"
          >
            <div className="container mx-auto px-6 py-4 flex flex-col gap-1">
              {NAV_ITEMS.map((item) => (
                <button
                  key={item.key}
                  onClick={() => handleNavClick(item)}
                  className="text-left px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-primary hover:bg-secondary transition-colors"
                >
                  {t.nav[item.key]}
                </button>
              ))}
              {/* Language toggle mobile */}
              <button
                onClick={() => setLang(lang === "en" ? "pt" : "en")}
                className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-primary hover:bg-secondary transition-colors"
              >
                🌐 {lang === "en" ? "Português" : "English"}
              </button>
              {user ? (
                <>
                  <Link
                    to="/profile"
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-primary hover:bg-secondary transition-colors"
                  >
                    <User className="h-4 w-4" />
                    {t.nav.profile}
                  </Link>
                  <button
                    onClick={() => { setMobileOpen(false); handleSignOut(); }}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-destructive hover:bg-secondary transition-colors"
                  >
                    <LogOut className="h-4 w-4" />
                    {t.nav.logout}
                  </button>
                </>
              ) : (
                <Link
                  to="/login"
                  onClick={() => setMobileOpen(false)}
                  className="mt-2 flex items-center justify-center rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
                >
                  {t.nav.register}
                </Link>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
};

export default Navbar;

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TrendingUp, Activity, LogOut, User, Menu, X } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

const navLinks = [
  { label: "Dashboard",  to: "/dashboard", protected: true  },
  { label: "Mercado",    to: "/mercado",   protected: true  },
  { label: "Previsões",  to: "/forecast",  protected: true  },
  { label: "Análise",    to: "/analise",   protected: true  },
  { label: "Portfólio",  to: "/portfolio", protected: true  },
  { label: "Preços",     to: "/pricing",   protected: false },
];

const Navbar = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    window.location.href = "/";
  };

  const handleNavClick = (item: typeof navLinks[0]) => {
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
          {navLinks.map((item) => (
            <button
              key={item.label}
              onClick={() => handleNavClick(item)}
              className="text-sm text-muted-foreground hover:text-primary transition-colors font-medium"
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 rounded-lg bg-secondary px-3 py-1.5">
            <TrendingUp className="h-3.5 w-3.5 text-chart-up" />
            <span className="font-mono text-xs text-chart-up">S&P 500 +1.24%</span>
          </div>

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
                <span className="hidden sm:inline">Sair</span>
              </button>
            </div>
          ) : (
            <Link
              to="/login"
              className="hidden md:block rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
            >
              Começar
            </Link>
          )}

          {/* Hamburger — mobile only */}
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
              {navLinks.map((item) => (
                <button
                  key={item.label}
                  onClick={() => handleNavClick(item)}
                  className="text-left px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-primary hover:bg-secondary transition-colors"
                >
                  {item.label}
                </button>
              ))}
              {user ? (
                <>
                  <Link
                    to="/profile"
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-primary hover:bg-secondary transition-colors"
                  >
                    <User className="h-4 w-4" />
                    Perfil
                  </Link>
                  <button
                    onClick={() => { setMobileOpen(false); handleSignOut(); }}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-destructive hover:bg-secondary transition-colors"
                  >
                    <LogOut className="h-4 w-4" />
                    Sair
                  </button>
                </>
              ) : (
                <Link
                  to="/login"
                  onClick={() => setMobileOpen(false)}
                  className="mt-2 flex items-center justify-center rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
                >
                  Começar
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

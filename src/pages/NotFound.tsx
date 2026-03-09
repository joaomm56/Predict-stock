import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { Home, Search, TrendingUp } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

const NotFound = () => {
  const { t } = useLanguage();
  const location = useLocation();

  useEffect(() => {
    console.error("404:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center max-w-md"
      >
        <div className="inline-flex items-center justify-center h-20 w-20 rounded-2xl bg-primary/10 border border-primary/20 mb-6 mx-auto">
          <span className="font-mono text-3xl font-bold text-primary">404</span>
        </div>

        <h1 className="text-3xl font-bold text-foreground mb-2">{t.notfound.title}</h1>
        <p className="text-muted-foreground mb-8">
          {t.notfound.desc.split("{path}")[0]}<span className="font-mono text-sm text-primary">{location.pathname}</span>{t.notfound.desc.split("{path}")[1]}
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            to="/"
            className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 font-semibold text-sm text-primary-foreground hover:opacity-90 transition-opacity"
          >
            <Home className="h-4 w-4" />
            {t.notfound.home}
          </Link>
          <Link
            to="/mercado"
            className="flex items-center gap-2 rounded-lg border border-border px-5 py-2.5 font-semibold text-sm text-foreground hover:border-primary hover:text-primary transition-colors"
          >
            <TrendingUp className="h-4 w-4" />
            {t.notfound.market}
          </Link>
          <Link
            to="/forecast"
            className="flex items-center gap-2 rounded-lg border border-border px-5 py-2.5 font-semibold text-sm text-foreground hover:border-primary hover:text-primary transition-colors"
          >
            <Search className="h-4 w-4" />
            {t.notfound.predict}
          </Link>
        </div>
      </motion.div>
    </div>
  );
};

export default NotFound;

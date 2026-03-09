import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Bell, Plus, Trash2, TrendingUp, TrendingDown, Lock } from "lucide-react";
import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { supabase } from "@/lib/supabase";
import { getStockInfo } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePageTitle } from "@/hooks/usePageTitle";
import { usePlan } from "@/hooks/usePlan";

interface Alert {
  id: string;
  ticker: string;
  target_price: number;
  direction: "above" | "below";
  created_at: string;
  current_price?: number | null;
  triggered?: boolean;
}

const Alertas = () => {
  usePageTitle("Alerts");
  const { user } = useAuth();
  const { t } = useLanguage();
  const { plan } = usePlan();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [ticker, setTicker] = useState("");
  const [targetPrice, setTargetPrice] = useState("");
  const [direction, setDirection] = useState<"above" | "below">("above");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAlerts = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("price_alerts")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (!data) { setLoading(false); return; }

    // Enrich with current price
    const enriched = await Promise.all(
      data.map(async (a) => {
        try {
          const info = await getStockInfo(a.ticker);
          const triggered =
            a.direction === "above"
              ? (info.price ?? 0) >= a.target_price
              : (info.price ?? Infinity) <= a.target_price;
          return { ...a, current_price: info.price, triggered };
        } catch {
          return { ...a, current_price: null, triggered: false };
        }
      })
    );
    setAlerts(enriched);
    setLoading(false);
  };

  useEffect(() => { loadAlerts(); }, [user]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !ticker.trim() || !targetPrice) return;
    setAdding(true);
    setError(null);

    const sym = ticker.trim().toUpperCase();
    const price = parseFloat(targetPrice);
    if (isNaN(price) || price <= 0) {
      setError(t.alertas.invalid_price);
      setAdding(false);
      return;
    }

    try {
      await getStockInfo(sym); // validate ticker
    } catch {
      setError(t.alertas.not_found);
      setAdding(false);
      return;
    }

    const { error: dbError } = await supabase.from("price_alerts").insert({
      user_id: user.id,
      ticker: sym,
      target_price: price,
      direction,
    });

    if (dbError) {
      setError(dbError.message);
    } else {
      setTicker("");
      setTargetPrice("");
      await loadAlerts();
    }
    setAdding(false);
  };

  const handleDelete = async (id: string) => {
    await supabase.from("price_alerts").delete().eq("id", id);
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  };

  if (plan === "free") {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-6 pt-28 pb-20 max-w-2xl">
          <div className="glass rounded-2xl p-10 text-center">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Lock className="h-6 w-6 text-primary" />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">{t.alertas.locked_title}</h2>
            <p className="text-muted-foreground text-sm mb-6 max-w-xs mx-auto">
              {t.alertas.locked_desc}
            </p>
            <Link
              to="/pricing"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
            >
              {t.alertas.view_plans}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="container mx-auto px-6 pt-28 pb-20 max-w-2xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-10"
        >
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 border border-primary/20 px-4 py-1.5 mb-4">
            <Bell className="h-3.5 w-3.5 text-primary" />
            <span className="font-mono text-xs text-primary">{t.alertas.badge}</span>
          </div>
          <h1 className="text-3xl font-bold text-foreground">{t.alertas.title} <span className="text-primary">{t.alertas.title_hl}</span></h1>
          <p className="text-muted-foreground mt-1">{t.alertas.desc}</p>
        </motion.div>

        {/* Formulário */}
        <motion.form
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          onSubmit={handleAdd}
          className="glass rounded-2xl p-5 mb-8 space-y-4"
        >
          <p className="text-sm font-semibold text-foreground">{t.alertas.new_alert}</p>
          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-muted-foreground font-mono mb-1">{t.alertas.lbl_ticker}</label>
              <input
                type="text"
                placeholder="ex: AAPL"
                value={ticker}
                onChange={(e) => setTicker(e.target.value.toUpperCase())}
                className="w-full rounded-lg bg-secondary border border-border px-3 py-2 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground font-mono mb-1">{t.alertas.lbl_price}</label>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="ex: 200.00"
                value={targetPrice}
                onChange={(e) => setTargetPrice(e.target.value)}
                className="w-full rounded-lg bg-secondary border border-border px-3 py-2 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground font-mono mb-1">{t.alertas.lbl_condition}</label>
              <select
                value={direction}
                onChange={(e) => setDirection(e.target.value as "above" | "below")}
                className="w-full rounded-lg bg-secondary border border-border px-3 py-2 font-mono text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="above">{t.alertas.above}</option>
                <option value="below">{t.alertas.below}</option>
              </select>
            </div>
          </div>
          {error && <p className="text-xs text-destructive font-mono">{error}</p>}
          <button
            type="submit"
            disabled={adding || !ticker.trim() || !targetPrice}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 font-semibold text-sm text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            <Plus className="h-4 w-4" />
            {adding ? t.alertas.btn_creating : t.alertas.btn_create}
          </button>
        </motion.form>

        {/* Lista */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
        ) : alerts.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="glass rounded-2xl p-12 text-center"
          >
            <Bell className="h-10 w-10 text-primary/40 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">{t.alertas.empty}</p>
          </motion.div>
        ) : (
          <div className="space-y-3">
            {alerts.map((alert, i) => (
              <motion.div
                key={alert.id}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: i * 0.05 }}
                className={`glass rounded-xl px-5 py-4 flex items-center justify-between ${
                  alert.triggered ? "border border-primary/40 bg-primary/5" : ""
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    alert.triggered ? "bg-primary/20" : "bg-secondary"
                  }`}>
                    {alert.direction === "above"
                      ? <TrendingUp className={`h-4 w-4 ${alert.triggered ? "text-primary" : "text-muted-foreground"}`} />
                      : <TrendingDown className={`h-4 w-4 ${alert.triggered ? "text-primary" : "text-muted-foreground"}`} />
                    }
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-mono font-bold text-foreground">{alert.ticker}</p>
                      {alert.triggered && (
                        <span className="inline-flex items-center rounded-full bg-primary/10 border border-primary/20 px-2 py-0.5 text-[10px] font-semibold text-primary">
                          {t.alertas.triggered}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground font-mono">
                      {alert.direction === "above" ? t.alertas.above_lbl : t.alertas.below_lbl} ${alert.target_price.toFixed(2)}
                      {alert.current_price != null && (
                        <span className="ml-2 text-foreground">· {t.alertas.current} ${alert.current_price.toFixed(2)}</span>
                      )}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(alert.id)}
                  className="text-muted-foreground hover:text-destructive transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Alertas;

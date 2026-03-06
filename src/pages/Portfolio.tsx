import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Briefcase, Plus, Trash2, TrendingUp, TrendingDown } from "lucide-react";
import Navbar from "@/components/Navbar";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { getStockInfo } from "@/lib/api";
import { usePageTitle } from "@/hooks/usePageTitle";

interface Favorite {
  id: string;
  ticker: string;
  price?: number | null;
  change?: number | null;
}

const Portfolio = () => {
  usePageTitle("Portfólio");
  const { user } = useAuth();
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [newTicker, setNewTicker] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadFavorites = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("favorites")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (data) {
      // enrich with live price
      const enriched = await Promise.all(
        data.map(async (row) => {
          try {
            const info = await getStockInfo(row.ticker);
            return { id: row.id, ticker: row.ticker, price: info.price, change: info.change };
          } catch {
            return { id: row.id, ticker: row.ticker };
          }
        })
      );
      setFavorites(enriched);
    }
    setLoading(false);
  };

  useEffect(() => { loadFavorites(); }, [user]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTicker.trim() || !user) return;
    setAdding(true);
    setError(null);

    const ticker = newTicker.trim().toUpperCase();
    const { error: dbError } = await supabase
      .from("favorites")
      .insert({ user_id: user.id, ticker });

    if (dbError) {
      setError(dbError.message);
    } else {
      setNewTicker("");
      await loadFavorites();
    }
    setAdding(false);
  };

  const handleRemove = async (id: string) => {
    await supabase.from("favorites").delete().eq("id", id);
    setFavorites((prev) => prev.filter((f) => f.id !== id));
  };

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
            <Briefcase className="h-3.5 w-3.5 text-primary" />
            <span className="font-mono text-xs text-primary">O Meu Portfólio</span>
          </div>
          <h1 className="text-3xl font-bold text-foreground">As Minhas <span className="text-primary">Ações</span></h1>
          <p className="text-muted-foreground mt-1">Guarda os tickers que queres acompanhar.</p>
        </motion.div>

        {/* Adicionar */}
        <motion.form
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          onSubmit={handleAdd}
          className="flex gap-3 mb-8"
        >
          <input
            type="text"
            placeholder="Adicionar ticker (ex: AAPL)"
            value={newTicker}
            onChange={(e) => setNewTicker(e.target.value.toUpperCase())}
            className="flex-1 rounded-lg bg-secondary border border-border px-4 py-3 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <button
            type="submit"
            disabled={adding || !newTicker.trim()}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-3 font-semibold text-sm text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            <Plus className="h-4 w-4" />
            {adding ? "…" : "Adicionar"}
          </button>
        </motion.form>

        {error && <p className="text-sm text-destructive font-mono mb-4">{error}</p>}

        {/* Lista */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
        ) : favorites.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="glass rounded-2xl p-12 text-center"
          >
            <Briefcase className="h-10 w-10 text-primary/40 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">Ainda não tens ações guardadas.</p>
          </motion.div>
        ) : (
          <div className="space-y-3">
            {favorites.map((fav, i) => (
              <motion.div
                key={fav.id}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: i * 0.05 }}
                className="glass rounded-xl px-5 py-4 flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <span className="font-mono text-xs font-bold text-primary">{fav.ticker.slice(0, 2)}</span>
                  </div>
                  <div>
                    <p className="font-mono font-bold text-foreground">{fav.ticker}</p>
                    {fav.price != null && (
                      <p className="font-mono text-sm text-muted-foreground">${fav.price.toFixed(2)}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {fav.change != null && (
                    <div className={`flex items-center gap-1 font-mono text-sm ${fav.change >= 0 ? "text-chart-up" : "text-chart-down"}`}>
                      {fav.change >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                      {fav.change >= 0 ? "+" : ""}{fav.change.toFixed(2)}%
                    </div>
                  )}
                  <button
                    onClick={() => handleRemove(fav.id)}
                    className="text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Portfolio;

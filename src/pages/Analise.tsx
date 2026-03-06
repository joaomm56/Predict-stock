import { motion } from "framer-motion";
import { Activity, Search, BarChart3, TrendingUp, TrendingDown, Zap } from "lucide-react";
import { useState } from "react";
import Navbar from "@/components/Navbar";
import { getStockInfo, type StockInfo } from "@/lib/api";
import { Link } from "react-router-dom";
import { usePageTitle } from "@/hooks/usePageTitle";

const Analise = () => {
  usePageTitle("Análise");
  const [ticker, setTicker] = useState("");
  const [info, setInfo] = useState<StockInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticker.trim()) return;
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      const data = await getStockInfo(ticker.trim());
      setInfo(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ticker não encontrado.");
    } finally {
      setLoading(false);
    }
  };

  const isUp = info?.change != null ? info.change >= 0 : true;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="container mx-auto px-6 pt-28 pb-20 max-w-3xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-10"
        >
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 border border-primary/20 px-4 py-1.5 mb-4">
            <BarChart3 className="h-3.5 w-3.5 text-primary" />
            <span className="font-mono text-xs text-primary">Análise Rápida</span>
          </div>
          <h1 className="text-3xl font-bold text-foreground">Analisar <span className="text-primary">Ação</span></h1>
          <p className="text-muted-foreground mt-1">Pesquisa um ticker para ver informação e ir para a previsão.</p>
        </motion.div>

        <motion.form
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          onSubmit={handleSearch}
          className="flex gap-3 mb-8"
        >
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="ex: AAPL, TSLA, NVDA"
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              className="w-full rounded-lg bg-secondary border border-border pl-10 pr-4 py-3 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !ticker.trim()}
            className="rounded-lg bg-primary px-5 py-3 font-semibold text-sm text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            {loading ? "…" : "Pesquisar"}
          </button>
        </motion.form>

        {error && <p className="text-sm text-destructive font-mono mb-6">{error}</p>}

        {info && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="glass rounded-2xl p-6 space-y-6"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="font-mono text-2xl font-bold text-primary">{ticker.toUpperCase()}</p>
                <p className="text-muted-foreground text-sm mt-0.5">{info.name}</p>
              </div>
              {info.price != null && (
                <div className="text-right">
                  <p className="font-mono text-2xl font-bold text-foreground">${info.price.toFixed(2)}</p>
                  {info.change != null && (
                    <div className={`flex items-center justify-end gap-1 font-mono text-sm ${isUp ? "text-chart-up" : "text-chart-down"}`}>
                      {isUp ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                      {isUp ? "+" : ""}{info.change.toFixed(2)}%
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "Setor",   value: info.sector },
                { label: "País",    value: info.country },
                { label: "Moeda",   value: info.currency },
              ].map((item) => (
                <div key={item.label} className="bg-secondary/50 rounded-lg p-3 text-center">
                  <p className="text-xs text-muted-foreground font-mono mb-1">{item.label}</p>
                  <p className="text-sm font-semibold text-foreground">{item.value}</p>
                </div>
              ))}
            </div>

            <Link
              to={`/forecast?ticker=${ticker.toUpperCase()}`}
              className="flex items-center justify-center gap-2 w-full rounded-lg bg-primary px-6 py-3 font-semibold text-sm text-primary-foreground hover:opacity-90 transition-opacity"
            >
              <Zap className="h-4 w-4" />
              Gerar Previsão com IA
            </Link>
          </motion.div>
        )}

        {!info && !error && !loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="glass rounded-2xl p-10 text-center"
          >
            <Activity className="h-10 w-10 text-primary/40 mx-auto mb-3" />
            <p className="font-medium text-foreground mb-1">Pesquisa uma ação</p>
            <p className="text-sm text-muted-foreground mb-6">
              Introduz o ticker no campo acima para ver informação em tempo real.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <p className="w-full text-xs text-muted-foreground font-mono mb-1">Sugestões populares</p>
              {["AAPL", "TSLA", "NVDA", "MSFT", "AMZN", "GOOGL", "META", "BRK-B"].map((t) => (
                <button
                  key={t}
                  onClick={() => setTicker(t)}
                  className="rounded-lg border border-border px-3 py-1.5 font-mono text-xs text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                >
                  {t}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default Analise;

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { BarChart3, TrendingUp, TrendingDown, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { getStockInfo, type StockInfo } from "@/lib/api";
import { usePageTitle } from "@/hooks/usePageTitle";

const INDEX_TICKERS = [
  { ticker: "^GSPC",  label: "S&P 500"   },
  { ticker: "^IXIC",  label: "NASDAQ"    },
  { ticker: "^DJI",   label: "DOW JONES" },
  { ticker: "^VIX",   label: "VIX"       },
];

const STOCK_TICKERS = ["AAPL", "MSFT", "NVDA", "TSLA", "AMZN", "GOOGL", "META", "BRK-B"];

interface MarketItem {
  ticker: string;
  label: string;
  info: StockInfo | null;
  error: boolean;
}

function formatChange(change: number | null): string {
  if (change === null) return "—";
  return `${change >= 0 ? "+" : ""}${change.toFixed(2)}%`;
}

function formatPrice(price: number | null, currency = "USD"): string {
  if (price === null) return "—";
  const symbol = currency === "EUR" ? "€" : "$";
  return `${symbol}${price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const Mercado = () => {
  usePageTitle("Mercado");
  const [indices, setIndices] = useState<MarketItem[]>([]);
  const [stocks, setStocks] = useState<MarketItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const navigate = useNavigate();

  const fetchAll = async () => {
    setLoading(true);

    const [indexResults, stockResults] = await Promise.all([
      Promise.allSettled(INDEX_TICKERS.map((i) => getStockInfo(i.ticker))),
      Promise.allSettled(STOCK_TICKERS.map((t) => getStockInfo(t))),
    ]);

    setIndices(INDEX_TICKERS.map((item, i) => ({
      ticker: item.ticker,
      label: item.label,
      info: indexResults[i].status === "fulfilled" ? indexResults[i].value : null,
      error: indexResults[i].status === "rejected",
    })));

    setStocks(STOCK_TICKERS.map((ticker, i) => ({
      ticker,
      label: ticker,
      info: stockResults[i].status === "fulfilled" ? stockResults[i].value : null,
      error: stockResults[i].status === "rejected",
    })));

    setLastUpdated(new Date());
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const skeletonIndices = INDEX_TICKERS.map((i) => ({ ticker: i.ticker, label: i.label, info: null, error: false }));
  const skeletonStocks  = STOCK_TICKERS.map((t) => ({ ticker: t, label: t, info: null, error: false }));

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="container mx-auto px-6 pt-28 pb-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-10 flex items-start justify-between gap-4 flex-wrap"
        >
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 border border-primary/20 px-4 py-1.5 mb-4">
              <BarChart3 className="h-3.5 w-3.5 text-primary" />
              <span className="font-mono text-xs text-primary">Mercado Global</span>
            </div>
            <h1 className="text-3xl font-bold text-foreground">
              Visão do <span className="text-primary">Mercado</span>
            </h1>
            <p className="text-muted-foreground mt-1">
              Principais índices e ações em tempo real.
              {lastUpdated && (
                <span className="ml-2 font-mono text-xs">
                  Atualizado às {lastUpdated.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
            </p>
          </div>
          <button
            onClick={fetchAll}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:text-primary hover:border-primary transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </button>
        </motion.div>

        {/* Índices */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {(loading ? skeletonIndices : indices).map((idx, i) => (
            <motion.div
              key={idx.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className="glass rounded-xl p-5"
            >
              <p className="text-xs text-muted-foreground font-mono mb-1">{idx.label}</p>
              {loading ? (
                <div className="space-y-2 mt-2">
                  <div className="h-6 w-24 rounded bg-secondary animate-pulse" />
                  <div className="h-4 w-16 rounded bg-secondary animate-pulse" />
                </div>
              ) : idx.error ? (
                <p className="text-xs text-destructive font-mono mt-2">Indisponível</p>
              ) : (
                <>
                  <p className="font-mono text-xl font-bold text-foreground">
                    {formatPrice(idx.info?.price ?? null, idx.info?.currency)}
                  </p>
                  <div className={`flex items-center gap-1 mt-1 text-xs font-mono font-medium ${(idx.info?.change ?? 0) >= 0 ? "text-chart-up" : "text-chart-down"}`}>
                    {(idx.info?.change ?? 0) >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {formatChange(idx.info?.change ?? null)}
                  </div>
                </>
              )}
            </motion.div>
          ))}
        </div>

        {/* Tabela de ações */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="glass rounded-2xl overflow-hidden"
        >
          <div className="px-6 py-4 border-b border-border">
            <h2 className="font-semibold text-foreground">Ações em Destaque</h2>
          </div>
          <div className="divide-y divide-border">
            {(loading ? skeletonStocks : stocks).map((s) => (
              <div
                key={s.ticker}
                onClick={() => !loading && navigate(`/analise?ticker=${s.ticker}`)}
                className="flex items-center justify-between px-6 py-4 hover:bg-secondary/30 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                    <span className="font-mono text-xs font-bold text-primary">{s.ticker.slice(0, 2)}</span>
                  </div>
                  <div>
                    <p className="font-mono text-sm font-semibold text-foreground">{s.ticker}</p>
                    <p className="text-xs text-muted-foreground">{s.info?.name ?? "—"}</p>
                  </div>
                </div>
                <div className="text-right">
                  {loading ? (
                    <div className="space-y-1.5">
                      <div className="h-4 w-20 rounded bg-secondary animate-pulse ml-auto" />
                      <div className="h-3 w-14 rounded bg-secondary animate-pulse ml-auto" />
                    </div>
                  ) : s.error ? (
                    <p className="text-xs text-destructive font-mono">Indisponível</p>
                  ) : (
                    <>
                      <p className="font-mono text-sm font-semibold text-foreground">
                        {formatPrice(s.info?.price ?? null, s.info?.currency)}
                      </p>
                      <div className={`flex items-center justify-end gap-1 text-xs font-mono ${(s.info?.change ?? 0) >= 0 ? "text-chart-up" : "text-chart-down"}`}>
                        {(s.info?.change ?? 0) >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        {formatChange(s.info?.change ?? null)}
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Mercado;

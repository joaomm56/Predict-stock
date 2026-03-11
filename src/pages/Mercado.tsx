import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BarChart3, TrendingUp, TrendingDown, RefreshCw, Plus, Check, X, ExternalLink, Cpu } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import Navbar from "@/components/Navbar";
import { getStockInfo, getHistory, type StockInfo } from "@/lib/api";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/lib/supabase";
import { usePlan } from "@/hooks/usePlan";

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

interface ChartPoint { date: string; price: number; }

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
  usePageTitle("Market");
  const { user } = useAuth();
  const { t } = useLanguage();
  const { limits } = usePlan();
  const navigate = useNavigate();

  const [indices, setIndices] = useState<MarketItem[]>([]);
  const [stocks, setStocks] = useState<MarketItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [addedTickers, setAddedTickers] = useState<Set<string>>(new Set());
  const [limitReached, setLimitReached] = useState(false);

  const PERIODS = [
    { label: "1M", value: "1mo" },
    { label: "3M", value: "3mo" },
    { label: "6M", value: "6mo" },
    { label: "1A", value: "1y" },
    { label: "2A", value: "2y" },
    { label: "5A", value: "5y" },
    { label: t.mercado.period_max, value: "max" },
  ];

  // Expanded panel
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState("1y");
  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const [chartLoading, setChartLoading] = useState(false);
  const [livePrice, setLivePrice] = useState<StockInfo | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleAddToPortfolio = async (e: React.MouseEvent, ticker: string) => {
    e.stopPropagation();
    if (!user) return;
    if (limits.portfolioMax !== Infinity) {
      const { count } = await supabase
        .from("favorites")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id);
      if ((count ?? 0) >= limits.portfolioMax) {
        setLimitReached(true);
        setTimeout(() => setLimitReached(false), 4000);
        return;
      }
    }
    const { data: existing } = await supabase
      .from("favorites")
      .select("id")
      .eq("user_id", user.id)
      .eq("ticker", ticker)
      .maybeSingle();
    if (!existing) {
      await supabase.from("favorites").insert({ user_id: user.id, ticker });
    }
    setAddedTickers((prev) => new Set(prev).add(ticker));
  };

  const fetchAll = async () => {
    setLoading(true);
    const [indexResults, stockResults] = await Promise.all([
      Promise.allSettled(INDEX_TICKERS.map((i) => getStockInfo(i.ticker))),
      Promise.allSettled(STOCK_TICKERS.map((t) => getStockInfo(t))),
    ]);
    setIndices(INDEX_TICKERS.map((item, i) => ({
      ticker: item.ticker, label: item.label,
      info: indexResults[i].status === "fulfilled" ? indexResults[i].value : null,
      error: indexResults[i].status === "rejected",
    })));
    setStocks(STOCK_TICKERS.map((ticker, i) => ({
      ticker, label: ticker,
      info: stockResults[i].status === "fulfilled" ? stockResults[i].value : null,
      error: stockResults[i].status === "rejected",
    })));
    setLastUpdated(new Date());
    setLoading(false);
  };

  const loadTickerData = async (ticker: string, period: string) => {
    setChartLoading(true);
    try {
      const [hist, info] = await Promise.all([
        getHistory(ticker, period),
        getStockInfo(ticker),
      ]);
      setChartData(hist.dates.map((d, i) => ({ date: d, price: hist.values[i] })));
      setLivePrice(info);
    } catch {
      setChartData([]);
    }
    setChartLoading(false);
  };

  const handlePeriodChange = (period: string) => {
    if (!selectedTicker) return;
    setSelectedPeriod(period);
    loadTickerData(selectedTicker, period);
  };

  const refreshLivePrice = async (ticker: string) => {
    try {
      const info = await getStockInfo(ticker);
      setLivePrice(info);
    } catch { /* silent */ }
  };

  const handleRowClick = (ticker: string) => {
    if (loading) return;
    if (selectedTicker === ticker) {
      setSelectedTicker(null);
      setChartData([]);
      setLivePrice(null);
      if (intervalRef.current) clearInterval(intervalRef.current);
    } else {
      setSelectedTicker(ticker);
      setSelectedPeriod("1y");
      loadTickerData(ticker, "1y");
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(() => refreshLivePrice(ticker), 30_000);
    }
  };

  useEffect(() => { fetchAll(); }, []);
  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);

  const skeletonIndices = INDEX_TICKERS.map((i) => ({ ticker: i.ticker, label: i.label, info: null, error: false }));
  const skeletonStocks  = STOCK_TICKERS.map((t) => ({ ticker: t, label: t, info: null, error: false }));

  const priceMin = chartData.length ? Math.min(...chartData.map(d => d.price)) * 0.98 : 0;
  const priceMax = chartData.length ? Math.max(...chartData.map(d => d.price)) * 1.02 : 0;

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
              <span className="font-mono text-xs text-primary">{t.mercado.badge}</span>
            </div>
            <h1 className="text-3xl font-bold text-foreground">
              {t.mercado.title} <span className="text-primary">{t.mercado.title_hl}</span>
            </h1>
            <p className="text-muted-foreground mt-1">
              {t.mercado.desc}
              {lastUpdated && (
                <span className="ml-2 font-mono text-xs">
                  {t.mercado.updated} {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
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
            {t.mercado.refresh}
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
                <p className="text-xs text-destructive font-mono mt-2">{t.mercado.unavailable}</p>
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

        {/* Limit banner */}
        {limitReached && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3"
          >
            <p className="text-sm text-destructive font-mono">
              {t.mercado.limit_banner.replace("{max}", String(limits.portfolioMax))}
            </p>
            <Link to="/pricing" className="text-xs font-semibold text-primary hover:opacity-80 transition-opacity">
              {t.mercado.upgrade}
            </Link>
          </motion.div>
        )}

        {/* Tabela de ações */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="glass rounded-2xl overflow-hidden"
        >
          <div className="px-6 py-4 border-b border-border">
            <h2 className="font-semibold text-foreground">{t.mercado.stocks_title}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{t.mercado.stocks_hint}</p>
          </div>
          <div className="divide-y divide-border">
            {(loading ? skeletonStocks : stocks).map((s) => (
              <div key={s.ticker}>
                {/* Row */}
                <div
                  onClick={() => handleRowClick(s.ticker)}
                  className={`flex items-center justify-between px-3 sm:px-6 py-4 transition-colors cursor-pointer ${
                    selectedTicker === s.ticker
                      ? "bg-primary/5 border-l-2 border-primary"
                      : "hover:bg-secondary/30"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`h-9 w-9 rounded-lg flex items-center justify-center transition-colors ${
                      selectedTicker === s.ticker ? "bg-primary/20" : "bg-primary/10"
                    }`}>
                      <span className="font-mono text-xs font-bold text-primary">{s.ticker.slice(0, 2)}</span>
                    </div>
                    <div>
                      <p className="font-mono text-sm font-semibold text-foreground">{s.ticker}</p>
                      {loading ? (
                        <div className="h-3 w-28 rounded bg-secondary animate-pulse mt-1" />
                      ) : (
                        <p className="text-xs text-muted-foreground">{s.info?.name ?? "—"}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      {loading ? (
                        <div className="space-y-1.5">
                          <div className="h-4 w-20 rounded bg-secondary animate-pulse ml-auto" />
                          <div className="h-3 w-14 rounded bg-secondary animate-pulse ml-auto" />
                        </div>
                      ) : s.error ? (
                        <p className="text-xs text-destructive font-mono">{t.mercado.unavailable}</p>
                      ) : (
                        <>
                          <p className="font-mono text-sm font-semibold text-foreground">
                            {formatPrice(
                              selectedTicker === s.ticker && livePrice ? livePrice.price : s.info?.price ?? null,
                              s.info?.currency
                            )}
                          </p>
                          <div className={`flex items-center justify-end gap-1 text-xs font-mono ${(s.info?.change ?? 0) >= 0 ? "text-chart-up" : "text-chart-down"}`}>
                            {(s.info?.change ?? 0) >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                            {formatChange(s.info?.change ?? null)}
                          </div>
                        </>
                      )}
                    </div>
                    {user && !loading && (
                      <button
                        onClick={(e) => handleAddToPortfolio(e, s.ticker)}
                        className={`flex-shrink-0 h-8 w-8 rounded-lg border flex items-center justify-center transition-colors ${
                          addedTickers.has(s.ticker)
                            ? "border-primary/40 text-primary bg-primary/10"
                            : "border-border text-muted-foreground hover:border-primary hover:text-primary"
                        }`}
                      >
                        {addedTickers.has(s.ticker) ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded chart panel */}
                <AnimatePresence>
                  {selectedTicker === s.ticker && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3 }}
                      className="overflow-hidden border-t border-primary/20 bg-primary/5"
                    >
                      <div className="px-6 py-5">
                        {/* Header */}
                        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                          <div className="flex items-center gap-3">
                            <div>
                              <span className="font-mono text-sm font-bold text-primary">{s.ticker}</span>
                              <span className="ml-2 text-xs text-muted-foreground">{livePrice?.name ?? s.info?.name}</span>
                            </div>
                            {livePrice && (
                              <span className="font-mono text-lg font-bold text-foreground">
                                {formatPrice(livePrice.price, livePrice.currency)}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            {/* Period selector */}
                            <div className="flex items-center gap-1 rounded-lg border border-border p-0.5">
                              {PERIODS.map((p) => (
                                <button
                                  key={p.value}
                                  onClick={(e) => { e.stopPropagation(); handlePeriodChange(p.value); }}
                                  className={`px-2.5 py-1 rounded-md text-xs font-mono font-medium transition-colors ${
                                    selectedPeriod === p.value
                                      ? "bg-primary text-primary-foreground"
                                      : "text-muted-foreground hover:text-foreground"
                                  }`}
                                >
                                  {p.label}
                                </button>
                              ))}
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <span className="h-1.5 w-1.5 rounded-full bg-chart-up animate-pulse" />
                              {t.mercado.live}
                            </div>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleRowClick(s.ticker); }}
                              className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Chart */}
                        {chartLoading ? (
                          <div className="h-48 flex items-center justify-center">
                            <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                          </div>
                        ) : chartData.length > 0 ? (
                          <div className="h-48">
                            <ResponsiveContainer width="100%" height="100%">
                              <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                                <defs>
                                  <linearGradient id={`grad-${s.ticker}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                                  </linearGradient>
                                </defs>
                                <XAxis
                                  dataKey="date"
                                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                                  tickLine={false}
                                  axisLine={false}
                                  tickFormatter={(v) => v.slice(0, 7)}
                                />
                                <YAxis
                                  domain={[priceMin, priceMax]}
                                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                                  tickLine={false}
                                  axisLine={false}
                                  tickFormatter={(v) => `$${v.toFixed(0)}`}
                                  width={52}
                                />
                                <Tooltip
                                  contentStyle={{
                                    background: "hsl(var(--background))",
                                    border: "1px solid hsl(var(--border))",
                                    borderRadius: "8px",
                                    fontSize: "12px",
                                  }}
                                  formatter={(v: number) => [`$${v.toFixed(2)}`, t.common.price]}
                                />
                                <Area
                                  type="monotone"
                                  dataKey="price"
                                  stroke="hsl(var(--primary))"
                                  strokeWidth={2}
                                  fill={`url(#grad-${s.ticker})`}
                                  dot={false}
                                />
                              </AreaChart>
                            </ResponsiveContainer>
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground text-center py-10">{t.comparar.err_load}</p>
                        )}

                        {/* Actions */}
                        <div className="flex items-center gap-3 mt-4">
                          <button
                            onClick={(e) => { e.stopPropagation(); navigate(`/forecast?ticker=${s.ticker}`); }}
                            className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
                          >
                            <Cpu className="h-3.5 w-3.5" />
                            {t.mercado.btn_forecast}
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); navigate(`/analise?ticker=${s.ticker}`); }}
                            className="flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-xs font-semibold text-foreground hover:border-primary hover:text-primary transition-colors"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            {t.mercado.btn_analysis}
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Mercado;

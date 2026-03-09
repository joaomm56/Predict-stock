import { motion } from "framer-motion";
import { Activity, Search, BarChart3, TrendingUp, TrendingDown, Zap, Briefcase, CheckCircle, Lock } from "lucide-react";
import { useState } from "react";
import Navbar from "@/components/Navbar";
import { getStockInfo, getIndicators, type StockInfo, type IndicatorsResponse } from "@/lib/api";
import { Link } from "react-router-dom";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/lib/supabase";
import { usePlan } from "@/hooks/usePlan";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";

const Analise = () => {
  usePageTitle("Analysis");
  const { user } = useAuth();
  const { t } = useLanguage();
  const { plan, limits } = usePlan();
  const [ticker, setTicker] = useState("");
  const [info, setInfo] = useState<StockInfo | null>(null);
  const [indicators, setIndicators] = useState<IndicatorsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addingPortfolio, setAddingPortfolio] = useState(false);
  const [portfolioMsg, setPortfolioMsg] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticker.trim()) return;
    setLoading(true);
    setError(null);
    setInfo(null);
    setIndicators(null);
    try {
      const [data, ind] = await Promise.allSettled([
        getStockInfo(ticker.trim()),
        limits.advancedMetrics ? getIndicators(ticker.trim()) : Promise.reject("locked"),
      ]);
      if (data.status === "fulfilled") setInfo(data.value);
      else throw new Error(data.reason?.message ?? t.analise.empty_title);
      if (ind.status === "fulfilled") setIndicators(ind.value);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.analise.empty_title);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToPortfolio = async () => {
    if (!user || !ticker.trim()) return;
    setAddingPortfolio(true);
    setPortfolioMsg(null);

    const sym = ticker.trim().toUpperCase();

    if (limits.portfolioMax !== Infinity) {
      const { count } = await supabase
        .from("favorites")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id);
      if ((count ?? 0) >= limits.portfolioMax) {
        setPortfolioMsg(t.analise.limit_msg.replace("{max}", String(limits.portfolioMax)));
        setAddingPortfolio(false);
        return;
      }
    }

    const { data: existing } = await supabase
      .from("favorites")
      .select("id")
      .eq("user_id", user.id)
      .eq("ticker", sym)
      .maybeSingle();

    if (existing) {
      setPortfolioMsg(t.analise.already_in);
    } else {
      const { error } = await supabase.from("favorites").insert({ user_id: user.id, ticker: sym });
      setPortfolioMsg(error ? error.message : t.analise.added);
    }
    setAddingPortfolio(false);
  };

  const isUp = info?.change != null ? info.change >= 0 : true;

  // Build chart data for indicators
  const indChartData = indicators
    ? indicators.dates.map((d, i) => ({
        date: d.slice(0, 7),
        close: indicators.close[i],
        rsi: indicators.rsi[i],
        macd: indicators.macd[i],
        signal: indicators.macd_signal[i],
        hist: indicators.macd_hist[i],
        bb_upper: indicators.bb_upper[i],
        bb_mid: indicators.bb_mid[i],
        bb_lower: indicators.bb_lower[i],
      }))
    : [];

  const lastRsi = indicators?.rsi.filter((v) => v !== null).at(-1) ?? null;
  const lastMacd = indicators?.macd.filter((v) => v !== null).at(-1) ?? null;
  const lastSignal = indicators?.macd_signal.filter((v) => v !== null).at(-1) ?? null;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="container mx-auto px-6 pt-28 pb-20 max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-10"
        >
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 border border-primary/20 px-4 py-1.5 mb-4">
            <BarChart3 className="h-3.5 w-3.5 text-primary" />
            <span className="font-mono text-xs text-primary">{t.analise.badge}</span>
          </div>
          <h1 className="text-3xl font-bold text-foreground">{t.analise.title} <span className="text-primary">{t.analise.title_hl}</span></h1>
          <p className="text-muted-foreground mt-1">{t.analise.desc}</p>
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
              placeholder={t.analise.ph_ticker}
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
            {loading ? "…" : t.analise.btn_search}
          </button>
        </motion.form>

        {error && <p className="text-sm text-destructive font-mono mb-6">{error}</p>}

        {info && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="space-y-6"
          >
            {/* Info card */}
            <div className="glass rounded-2xl p-6 space-y-6">
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
                  { label: t.analise.lbl_sector,   value: info.sector },
                  { label: t.analise.lbl_country,  value: info.country },
                  { label: t.analise.lbl_currency, value: info.currency },
                ].map((item) => (
                  <div key={item.label} className="bg-secondary/50 rounded-lg p-3 text-center">
                    <p className="text-xs text-muted-foreground font-mono mb-1">{item.label}</p>
                    <p className="text-sm font-semibold text-foreground">{item.value}</p>
                  </div>
                ))}
              </div>

              <div className="flex flex-col gap-2">
                <Link
                  to={`/forecast?ticker=${ticker.toUpperCase()}`}
                  className="flex items-center justify-center gap-2 w-full rounded-lg bg-primary px-6 py-3 font-semibold text-sm text-primary-foreground hover:opacity-90 transition-opacity"
                >
                  <Zap className="h-4 w-4" />
                  {t.analise.btn_forecast}
                </Link>
                {user && (
                  <button
                    onClick={handleAddToPortfolio}
                    disabled={addingPortfolio}
                    className="flex items-center justify-center gap-2 w-full rounded-lg border border-border px-6 py-3 font-semibold text-sm text-foreground hover:border-primary hover:text-primary transition-colors disabled:opacity-50"
                  >
                    {portfolioMsg ? (
                      <><CheckCircle className="h-4 w-4" />{portfolioMsg}</>
                    ) : (
                      <><Briefcase className="h-4 w-4" />{addingPortfolio ? t.analise.btn_adding : t.analise.btn_portfolio}</>
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Technical indicators */}
            {!limits.advancedMetrics ? (
              <div className="glass rounded-2xl p-6 flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Lock className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground text-sm">{t.analise.tech_locked_title}</p>
                    <p className="text-xs text-muted-foreground">{t.analise.tech_locked_desc}</p>
                  </div>
                </div>
                <Link to="/pricing" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity">
                  {t.analise.upgrade}
                </Link>
              </div>
            ) : indicators && indChartData.length > 0 ? (
              <>
                {/* Summary badges */}
                <div className="flex flex-wrap gap-3">
                  {lastRsi !== null && (
                    <div className={`rounded-lg px-4 py-2 text-xs font-mono font-semibold ${
                      lastRsi > 70 ? "bg-destructive/10 text-destructive border border-destructive/30" :
                      lastRsi < 30 ? "bg-chart-up/10 text-chart-up border border-chart-up/30" :
                      "bg-secondary text-muted-foreground border border-border"
                    }`}>
                      RSI {lastRsi.toFixed(1)} — {lastRsi > 70 ? t.analise.rsi_overbought : lastRsi < 30 ? t.analise.rsi_oversold : t.analise.rsi_neutral}
                    </div>
                  )}
                  {lastMacd !== null && lastSignal !== null && (
                    <div className={`rounded-lg px-4 py-2 text-xs font-mono font-semibold border ${
                      lastMacd > lastSignal
                        ? "bg-chart-up/10 text-chart-up border-chart-up/30"
                        : "bg-destructive/10 text-destructive border-destructive/30"
                    }`}>
                      MACD {lastMacd > lastSignal ? t.analise.macd_bullish : t.analise.macd_bearish}
                    </div>
                  )}
                </div>

                {/* RSI chart */}
                <div className="glass rounded-2xl p-5">
                  <p className="font-mono text-sm font-semibold text-foreground mb-3">{t.analise.rsi_title}</p>
                  <div className="h-36">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={indChartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                        <XAxis dataKey="date" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} width={28} />
                        <Tooltip contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "11px" }} formatter={(v: number) => [v?.toFixed(2), "RSI"]} />
                        <ReferenceLine y={70} stroke="hsl(var(--destructive))" strokeDasharray="3 3" strokeOpacity={0.5} />
                        <ReferenceLine y={30} stroke="hsl(var(--chart-up))" strokeDasharray="3 3" strokeOpacity={0.5} />
                        <Line type="monotone" dataKey="rsi" stroke="hsl(var(--primary))" strokeWidth={1.5} dot={false} connectNulls />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* MACD chart */}
                <div className="glass rounded-2xl p-5">
                  <p className="font-mono text-sm font-semibold text-foreground mb-3">{t.analise.macd_title}</p>
                  <div className="h-36">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={indChartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                        <XAxis dataKey="date" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                        <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} width={36} />
                        <Tooltip contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "11px" }} />
                        <ReferenceLine y={0} stroke="hsl(var(--border))" />
                        <Bar dataKey="hist" name={t.analise.hist_lbl} fill="hsl(var(--primary))" opacity={0.5} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="h-24 mt-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={indChartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                        <XAxis dataKey="date" tick={false} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} width={36} />
                        <Tooltip contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "11px" }} />
                        <Line type="monotone" dataKey="macd" name="MACD" stroke="hsl(var(--primary))" strokeWidth={1.5} dot={false} connectNulls />
                        <Line type="monotone" dataKey="signal" name={t.analise.signal_lbl} stroke="hsl(var(--destructive))" strokeWidth={1.5} dot={false} connectNulls />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Bollinger Bands chart */}
                <div className="glass rounded-2xl p-5">
                  <p className="font-mono text-sm font-semibold text-foreground mb-3">{t.analise.bb_title}</p>
                  <div className="h-40">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={indChartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                        <XAxis dataKey="date" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                        <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} width={48} tickFormatter={(v) => `$${v.toFixed(0)}`} domain={["auto", "auto"]} />
                        <Tooltip contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "11px" }} formatter={(v: number) => [`$${v?.toFixed(2)}`]} />
                        <Line type="monotone" dataKey="close" name={t.common.price} stroke="hsl(var(--foreground))" strokeWidth={1.5} dot={false} connectNulls />
                        <Line type="monotone" dataKey="bb_upper" name={t.analise.bb_upper} stroke="hsl(var(--primary))" strokeWidth={1} strokeDasharray="4 2" dot={false} connectNulls />
                        <Line type="monotone" dataKey="bb_mid" name={t.analise.bb_mid} stroke="hsl(var(--muted-foreground))" strokeWidth={1} dot={false} connectNulls />
                        <Line type="monotone" dataKey="bb_lower" name={t.analise.bb_lower} stroke="hsl(var(--primary))" strokeWidth={1} strokeDasharray="4 2" dot={false} connectNulls />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </>
            ) : null}
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
            <p className="font-medium text-foreground mb-1">{t.analise.empty_title}</p>
            <p className="text-sm text-muted-foreground mb-6">
              {plan !== "free" ? t.analise.empty_desc_pro : t.analise.empty_desc}
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <p className="w-full text-xs text-muted-foreground font-mono mb-1">{t.analise.popular}</p>
              {["AAPL", "TSLA", "NVDA", "MSFT", "AMZN", "GOOGL", "META", "BRK-B"].map((sym) => (
                <button
                  key={sym}
                  onClick={() => setTicker(sym)}
                  className="rounded-lg border border-border px-3 py-1.5 font-mono text-xs text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                >
                  {sym}
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

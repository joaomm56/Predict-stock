import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Activity, Search, TrendingUp, TrendingDown, Brain, Lock, ChevronDown, Download } from "lucide-react";
import { useSearchParams, Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import StockChart from "@/components/StockChart";
import { getForecast, type ForecastResponse } from "@/lib/api";
import type { ChartPoint } from "@/components/StockChart";
import { usePageTitle } from "@/hooks/usePageTitle";
import { usePlan, getForecastUsage, incrementForecastUsage } from "@/hooks/usePlan";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/lib/supabase";

function buildChartData(result: ForecastResponse, chartHistoryDays: number): ChartPoint[] {
  const realMap = new Map(result.real.dates.map((d, i) => [d, result.real.values[i]]));
  const histMap = new Map(result.historic_pred.dates.map((d, i) => [d, result.historic_pred.values[i]]));

  const historicalPoints: ChartPoint[] = result.real.dates.map((d) => ({
    name: d.slice(0, 7),
    price: realMap.get(d) ?? null,
    predicted: histMap.get(d) ?? null,
  }));

  // Limit historical points shown based on plan's chartHistoryDays
  const trimmed = historicalPoints.slice(-chartHistoryDays);

  const futurePoints: ChartPoint[] = result.future_pred.dates.map((d, i) => {
    const confLow  = result.future_pred.conf_low?.[i]  ?? null;
    const confHigh = result.future_pred.conf_high?.[i] ?? null;
    return {
      name: d.slice(0, 7),
      price: null,
      predicted: result.future_pred.values[i],
      conf_low:  confLow,
      conf_band: confHigh !== null && confLow !== null ? confHigh - confLow : null,
    };
  });

  // Sample future to ~24 points
  const step = Math.max(1, Math.floor(futurePoints.length / 24));
  const sampledFuture = futurePoints.filter((_, i) => i % step === 0);

  return [...trimmed, ...sampledFuture];
}

const POPULAR = ["AAPL", "TSLA", "NVDA", "MSFT", "AMZN", "GOOGL"];

const Forecast = () => {
  usePageTitle("Forecasts");
  const { plan, limits } = usePlan();
  const { user } = useAuth();
  const { t } = useLanguage();
  const [searchParams] = useSearchParams();
  const [ticker, setTicker] = useState(searchParams.get("ticker") ?? "");

  // Lock start date based on plan's forecast training data limit
  const minStart = (() => {
    const d = new Date();
    d.setDate(d.getDate() - limits.forecastHistoryDays);
    return d.toISOString().slice(0, 10);
  })();

  const today = new Date().toISOString().slice(0, 10);
  const [start, setStart] = useState(minStart);
  const [days, setDays] = useState(() => Math.min(365, limits.forecastDaysMax));
  const [daysOpen, setDaysOpen] = useState(false);
  const daysRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ForecastResponse | null>(null);
  const [chartData, setChartData] = useState<ChartPoint[] | undefined>(undefined);

  // Remaining forecasts for free plan
  const usage = getForecastUsage();
  const forecastsUsed = usage.count;
  const forecastsLeft = limits.forecastsPerDay === Infinity
    ? Infinity
    : Math.max(0, limits.forecastsPerDay - forecastsUsed);

  useEffect(() => {
    const tp = searchParams.get("ticker");
    if (tp) setTicker(tp);
  }, [searchParams]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (daysRef.current && !daysRef.current.contains(e.target as Node)) {
        setDaysOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticker.trim()) return;

    if (forecastsLeft === 0) {
      setError(t.forecast.plan_limit_err.replace("{max}", String(limits.forecastsPerDay)));
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setChartData(undefined);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const data = await getForecast(
        { ticker: ticker.trim(), start, end: today, forecast_days: Math.min(days, limits.forecastDaysMax) },
        session?.access_token
      );
      incrementForecastUsage();
      setResult(data);
      setChartData(buildChartData(data, limits.chartHistoryDays));
      if (user) {
        await supabase.from("forecasts").insert({
          user_id: user.id,
          ticker: data.ticker,
          horizon_days: Math.min(days, limits.forecastDaysMax),
          predicted_price: data.forecast_end_price,
          last_price: data.last_price,
          r2: data.metrics.r2,
          mae: data.metrics.mae,
          mape: data.metrics.mape,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t.common.error);
    } finally {
      setLoading(false);
    }
  };

  const exportCSV = () => {
    if (!result) return;
    const rows = [
      ["Date", t.common.real_price, "Historic Forecast", t.common.ai_forecast],
      ...result.real.dates.map((d, i) => [
        d,
        result.real.values[i],
        result.historic_pred.values[i] ?? "",
        "",
      ]),
      ...result.future_pred.dates.map((d, i) => [d, "", "", result.future_pred.values[i]]),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${result.ticker}_forecast.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const isUp = result ? result.forecast_end_price >= result.last_price : false;
  const changePercent = result
    ? (((result.forecast_end_price - result.last_price) / result.last_price) * 100).toFixed(2)
    : null;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="container mx-auto px-6 pt-28 pb-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-3xl mx-auto mb-10 text-center"
        >
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 border border-primary/20 px-4 py-1.5 mb-6">
            <Activity className="h-3.5 w-3.5 text-primary" />
            <span className="font-mono text-xs text-primary">{t.forecast.badge}</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
            {t.forecast.title} <span className="text-primary">{t.forecast.title_hl}</span>
          </h1>
          <p className="text-muted-foreground max-w-lg mx-auto">
            {t.forecast.desc}
          </p>
        </motion.div>

        {/* Form */}
        <motion.form
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          onSubmit={handleSubmit}
          className="glass rounded-2xl p-6 max-w-3xl mx-auto mb-10 overflow-visible relative z-20"
        >
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4 items-end">
            <div>
              <label className="block text-xs text-muted-foreground mb-1.5 font-mono">{t.forecast.lbl_ticker}</label>
              <input
                type="text"
                placeholder={t.forecast.ph_ticker}
                value={ticker}
                onChange={(e) => setTicker(e.target.value.toUpperCase())}
                className="w-full rounded-lg bg-secondary border border-border px-3 py-2 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1.5 font-mono flex items-center gap-1">
                {t.forecast.lbl_start} {plan === "free" && <Lock className="h-2.5 w-2.5" />}
              </label>
              <input
                type="date"
                value={start}
                min={minStart}
                max={today}
                onChange={(e) => setStart(e.target.value)}
                className="w-full rounded-lg bg-secondary border border-border px-3 py-2 font-mono text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1.5 font-mono">{t.forecast.lbl_end}</label>
              <div className="w-full rounded-lg bg-secondary/50 border border-border px-3 py-2 font-mono text-sm text-muted-foreground cursor-default">
                {today}
              </div>
            </div>
            <div className="relative" ref={daysRef}>
              <label className="block text-xs text-muted-foreground mb-1.5 font-mono flex items-center gap-1">
                {t.forecast.lbl_horizon} {plan !== "premium" && <Lock className="h-2.5 w-2.5" />}
              </label>
              <button
                type="button"
                onClick={() => setDaysOpen((o) => !o)}
                className="w-full rounded-lg bg-secondary border border-border px-3 py-2 font-mono text-sm text-foreground flex items-center justify-between focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <span>{([
                  [15, t.forecast.horizon_opts.d15], [30, t.forecast.horizon_opts.d30], [60, t.forecast.horizon_opts.d60], [90, t.forecast.horizon_opts.d90],
                  [180, t.forecast.horizon_opts.d180], [270, t.forecast.horizon_opts.d270], [365, t.forecast.horizon_opts.d365], [730, t.forecast.horizon_opts.d730],
                ] as [number, string][]).find(([d]) => d === days)?.[1] ?? `${days}d`}</span>
                <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${daysOpen ? "rotate-180" : ""}`} />
              </button>
              {daysOpen && (
                <div className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-background shadow-lg overflow-hidden">
                  {([
                    [15, t.forecast.horizon_opts.d15], [30, t.forecast.horizon_opts.d30], [60, t.forecast.horizon_opts.d60], [90, t.forecast.horizon_opts.d90],
                    [180, t.forecast.horizon_opts.d180], [270, t.forecast.horizon_opts.d270], [365, t.forecast.horizon_opts.d365], [730, t.forecast.horizon_opts.d730],
                  ] as [number, string][]).map(([d, label]) => {
                    const locked = d > limits.forecastDaysMax;
                    return (
                      <button
                        key={d}
                        type="button"
                        disabled={locked}
                        onClick={() => { if (!locked) { setDays(d); setDaysOpen(false); } }}
                        className={`w-full flex items-center justify-between px-3 py-2 font-mono text-sm text-left transition-colors ${
                          d === days ? "bg-primary/10 text-primary" :
                          locked ? "text-muted-foreground/40 cursor-not-allowed" :
                          "text-foreground hover:bg-secondary"
                        }`}
                      >
                        {label}
                        {locked && <Lock className="h-3 w-3" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            <button
              type="submit"
              disabled={loading || !ticker.trim() || forecastsLeft === 0}
              className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 font-semibold text-sm text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Search className="h-4 w-4" />
              {loading ? t.forecast.btn_processing : t.forecast.btn_generate}
            </button>
            {plan === "free" && (
              <span className="font-mono text-xs text-muted-foreground">
                {forecastsLeft === 0
                  ? t.forecast.limit_today
                  : t.forecast.forecasts_left.replace("{n}", String(forecastsLeft)).replace("{max}", String(limits.forecastsPerDay))}
              </span>
            )}
          </div>

          {plan === "free" && (
            <p className="mt-3 text-xs text-muted-foreground font-mono flex items-center gap-1.5">
              <Lock className="h-3 w-3" />
              {t.forecast.free_limit.replace("{max}", String(limits.forecastDaysMax))}{" "}
              <Link to="/pricing" className="text-primary underline underline-offset-2">{t.forecast.upgrade}</Link>
            </p>
          )}

          {error && (
            <div className="mt-3 flex items-center gap-3 flex-wrap">
              <p className="text-sm text-destructive font-mono">{error}</p>
              <button
                type="submit"
                className="text-xs font-semibold text-primary underline underline-offset-2 hover:opacity-80 transition-opacity"
              >
                {t.forecast.btn_retry}
              </button>
            </div>
          )}
        </motion.form>

        {/* Loading state */}
        {loading && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-3xl mx-auto glass rounded-2xl p-10 text-center"
          >
            <div className="flex justify-center mb-5">
              <div className="relative h-14 w-14">
                <div className="absolute inset-0 rounded-full border-2 border-primary/20" />
                <div className="absolute inset-0 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                <Brain className="absolute inset-0 m-auto h-6 w-6 text-primary" />
              </div>
            </div>
            <p className="font-semibold text-foreground mb-1">{t.forecast.loading_title}</p>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto">
              {t.forecast.loading_desc}
            </p>
            <div className="mt-6 flex justify-center gap-1.5">
              {t.forecast.steps.map((step, i) => (
                <div key={step} className="flex items-center gap-1.5">
                  <div className="flex items-center gap-1">
                    <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" style={{ animationDelay: `${i * 0.3}s` }} />
                    <span className="text-xs text-muted-foreground font-mono">{step}</span>
                  </div>
                  {i < 2 && <div className="h-px w-4 bg-border" />}
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Empty state */}
        {!result && !loading && !error && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="max-w-3xl mx-auto glass rounded-2xl p-10 text-center"
          >
            <Activity className="h-10 w-10 text-primary/40 mx-auto mb-3" />
            <p className="font-medium text-foreground mb-1">{t.forecast.empty_title}</p>
            <p className="text-sm text-muted-foreground mb-6">
              {t.forecast.empty_desc}
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <p className="w-full text-xs text-muted-foreground font-mono mb-1">{t.forecast.popular}</p>
              {POPULAR.map((sym) => (
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

        {/* Results */}
        {result && chartData && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-5xl mx-auto space-y-6"
          >
            {/* Header info */}
            <div className="glass rounded-2xl p-6 flex flex-wrap gap-6 items-center justify-between">
              <div>
                <span className="font-mono text-2xl font-bold text-primary">{result.ticker}</span>
                <p className="text-sm text-muted-foreground mt-0.5">{result.meta.name} · {result.meta.sector} · {result.meta.country}</p>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-right">
                  <p className="text-xs text-muted-foreground font-mono mb-0.5">{t.forecast.result_current}</p>
                  <span className="font-mono text-xl font-bold text-foreground">
                    {result.last_price.toFixed(2)} {result.meta.currency}
                  </span>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground font-mono mb-0.5">{t.forecast.result_forecast.replace("{days}", String(days))}</p>
                  <div className={`flex items-center gap-1.5 font-mono text-xl font-bold ${isUp ? "text-chart-up" : "text-chart-down"}`}>
                    {isUp ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
                    {result.forecast_end_price.toFixed(2)} {result.meta.currency}
                    <span className="text-sm">({isUp ? "+" : ""}{changePercent}%)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Chart */}
            <div className="glass rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                <span className="font-mono text-sm text-primary font-medium">{t.forecast.chart_title}</span>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-primary" />
                    <span className="text-xs text-muted-foreground">{t.forecast.real_price}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-accent border border-dashed border-accent" />
                    <span className="text-xs text-muted-foreground">{t.forecast.ai_forecast}</span>
                  </div>
                  {plan === "premium" ? (
                    <button
                      onClick={exportCSV}
                      className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-primary hover:border-primary transition-colors"
                    >
                      <Download className="h-3.5 w-3.5" />
                      CSV
                    </button>
                  ) : (
                    <Link to="/pricing" className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-primary hover:border-primary transition-colors">
                      <Lock className="h-3 w-3" />
                      CSV
                    </Link>
                  )}
                </div>
              </div>
              <StockChart chartData={chartData} />
            </div>

            {/* Metrics */}
            {limits.advancedMetrics ? (
              <div className="grid sm:grid-cols-3 gap-4">
                {[
                  { label: "R² Score", value: result.metrics.r2.toFixed(4), desc: t.backtesting.r2_desc },
                  { label: "MAE", value: result.metrics.mae.toFixed(4), desc: t.backtesting.mae_desc },
                  { label: "MAPE", value: `${result.metrics.mape.toFixed(2)}%`, desc: t.backtesting.mape_desc },
                ].map((m) => (
                  <div key={m.label} className="glass rounded-xl p-5 text-center">
                    <p className="text-xs text-muted-foreground font-mono mb-1">{m.label}</p>
                    <p className="font-mono text-2xl font-bold text-primary">{m.value}</p>
                    <p className="text-xs text-muted-foreground mt-1">{m.desc}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="glass rounded-xl p-6 flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Lock className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground text-sm">{t.forecast.metrics_locked_title}</p>
                    <p className="text-xs text-muted-foreground">{t.forecast.metrics_locked_desc}</p>
                  </div>
                </div>
                <Link
                  to="/pricing"
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
                >
                  {t.forecast.upgrade}
                </Link>
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default Forecast;

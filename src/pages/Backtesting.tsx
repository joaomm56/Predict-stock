import { useState } from "react";
import { motion } from "framer-motion";
import { FlaskConical, Search, TrendingUp, TrendingDown, Lock } from "lucide-react";
import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { getForecast } from "@/lib/api";
import { usePageTitle } from "@/hooks/usePageTitle";
import { usePlan } from "@/hooks/usePlan";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, ReferenceLine,
} from "recharts";

interface BacktestResult {
  ticker: string;
  trainStart: string;
  trainEnd: string;
  testStart: string;
  testEnd: string;
  r2: number;
  mae: number;
  mape: number;
  chartData: { date: string; real: number; predicted: number }[];
  lastPrice: number;
  predictedEnd: number;
}

const Backtesting = () => {
  usePageTitle("Backtesting");
  const { t } = useLanguage();
  const { plan, limits } = usePlan();
  const [ticker, setTicker] = useState("");
  const [trainStart, setTrainStart] = useState(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 2);
    return d.toISOString().slice(0, 10);
  });
  const [trainEnd, setTrainEnd] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 3);
    return d.toISOString().slice(0, 10);
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BacktestResult | null>(null);

  const today = new Date().toISOString().slice(0, 10);

  const handleRun = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticker.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const data = await getForecast({
        ticker: ticker.trim(),
        start: trainStart,
        end: trainEnd,
        forecast_days: 90,
      });

      const chartData = data.real.dates.map((d, i) => ({
        date: d.slice(0, 7),
        real: data.real.values[i],
        predicted: data.historic_pred.values[i],
      }));

      setResult({
        ticker: data.ticker,
        trainStart,
        trainEnd,
        testStart: trainEnd,
        testEnd: today,
        r2: data.metrics.r2,
        mae: data.metrics.mae,
        mape: data.metrics.mape,
        chartData,
        lastPrice: data.last_price,
        predictedEnd: data.forecast_end_price,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : t.common.error);
    } finally {
      setLoading(false);
    }
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
            <h2 className="text-xl font-bold text-foreground mb-2">{t.backtesting.locked_title}</h2>
            <p className="text-muted-foreground text-sm mb-6 max-w-xs mx-auto">
              {t.backtesting.locked_desc}
            </p>
            <Link
              to="/pricing"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
            >
              {t.backtesting.view_plans}
            </Link>
          </div>
        </div>
      </div>
    );
  }

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
            <FlaskConical className="h-3.5 w-3.5 text-primary" />
            <span className="font-mono text-xs text-primary">{t.backtesting.badge}</span>
          </div>
          <h1 className="text-3xl font-bold text-foreground">
            {t.backtesting.title} <span className="text-primary">{t.backtesting.title_hl}</span>
          </h1>
          <p className="text-muted-foreground mt-1">
            {t.backtesting.desc}
          </p>
        </motion.div>

        {/* Form */}
        <motion.form
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          onSubmit={handleRun}
          className="glass rounded-2xl p-5 mb-8"
        >
          <div className="grid sm:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-xs text-muted-foreground font-mono mb-1.5">{t.backtesting.lbl_ticker}</label>
              <input
                type="text"
                placeholder="ex: AAPL"
                value={ticker}
                onChange={(e) => setTicker(e.target.value.toUpperCase())}
                className="w-full rounded-lg bg-secondary border border-border px-3 py-2 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground font-mono mb-1.5">{t.backtesting.lbl_start}</label>
              <input
                type="date"
                value={trainStart}
                max={trainEnd}
                onChange={(e) => setTrainStart(e.target.value)}
                className="w-full rounded-lg bg-secondary border border-border px-3 py-2 font-mono text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground font-mono mb-1.5">{t.backtesting.lbl_end}</label>
              <input
                type="date"
                value={trainEnd}
                min={trainStart}
                max={today}
                onChange={(e) => setTrainEnd(e.target.value)}
                className="w-full rounded-lg bg-secondary border border-border px-3 py-2 font-mono text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground font-mono mb-4">
            {t.backtesting.period_note.replace("{start}", trainStart).replace("{end}", trainEnd)}
          </p>
          {error && <p className="text-sm text-destructive font-mono mb-3">{error}</p>}
          <button
            type="submit"
            disabled={loading || !ticker.trim()}
            className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            <Search className="h-4 w-4" />
            {loading ? t.backtesting.btn_running : t.backtesting.btn_run}
          </button>
        </motion.form>

        {/* Loading */}
        {loading && (
          <div className="glass rounded-2xl p-10 text-center">
            <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto mb-4" />
            <p className="text-sm text-muted-foreground font-mono">{t.backtesting.loading}</p>
          </div>
        )}

        {/* Results */}
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="space-y-6"
          >
            {/* Metrics */}
            <div className="grid sm:grid-cols-3 gap-4">
              {[
                {
                  label: "R² Score",
                  value: result.r2.toFixed(4),
                  desc: result.r2 > 0.9 ? t.backtesting.r2_exc : result.r2 > 0.7 ? t.backtesting.r2_good : t.backtesting.r2_poor,
                  good: result.r2 > 0.7,
                },
                {
                  label: "MAE",
                  value: `$${result.mae.toFixed(2)}`,
                  desc: t.backtesting.mae_desc,
                  good: true,
                },
                {
                  label: "MAPE",
                  value: `${result.mape.toFixed(2)}%`,
                  desc: result.mape < 5 ? t.backtesting.mape_great : result.mape < 15 ? t.backtesting.mape_ok : t.backtesting.mape_poor,
                  good: result.mape < 15,
                },
              ].map((m) => (
                <div key={m.label} className="glass rounded-xl p-5 text-center">
                  <p className="text-xs text-muted-foreground font-mono mb-1">{m.label}</p>
                  <p className={`font-mono text-2xl font-bold ${m.good ? "text-primary" : "text-destructive"}`}>{m.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{m.desc}</p>
                </div>
              ))}
            </div>

            {/* Price summary */}
            <div className="glass rounded-xl px-5 py-4 flex flex-wrap gap-6 items-center">
              <div>
                <p className="text-xs text-muted-foreground font-mono mb-0.5">{t.backtesting.last_price}</p>
                <p className="font-mono text-lg font-bold text-foreground">${result.lastPrice.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-mono mb-0.5">{t.backtesting.pred_90}</p>
                <div className={`flex items-center gap-1 font-mono text-lg font-bold ${result.predictedEnd >= result.lastPrice ? "text-chart-up" : "text-chart-down"}`}>
                  {result.predictedEnd >= result.lastPrice ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                  ${result.predictedEnd.toFixed(2)}
                </div>
              </div>
              <div className="text-xs text-muted-foreground font-mono">
                {t.backtesting.train_period} {result.trainStart} → {result.trainEnd}
              </div>
            </div>

            {/* Chart */}
            <div className="glass rounded-2xl p-6">
              <p className="font-mono text-sm font-semibold text-foreground mb-4">{t.backtesting.chart_title}</p>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={result.chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                    <YAxis
                      tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                      tickLine={false}
                      axisLine={false}
                      width={52}
                      tickFormatter={(v) => `$${v.toFixed(0)}`}
                      domain={["auto", "auto"]}
                    />
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }}
                      formatter={(v: number, name) => [`$${v?.toFixed(2)}`, name === "real" ? t.backtesting.real_lbl : t.backtesting.pred_lbl]}
                    />
                    <Legend wrapperStyle={{ fontSize: "12px", fontFamily: "monospace" }} formatter={(v) => v === "real" ? t.backtesting.real_lbl : t.backtesting.pred_lbl} />
                    <ReferenceLine x={result.trainEnd.slice(0, 7)} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 2" label={{ value: t.backtesting.train_end_lbl, fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                    <Line type="monotone" dataKey="real" stroke="hsl(var(--foreground))" strokeWidth={2} dot={false} connectNulls />
                    <Line type="monotone" dataKey="predicted" stroke="hsl(var(--primary))" strokeWidth={2} strokeDasharray="5 3" dot={false} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </motion.div>
        )}

        {!result && !loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="glass rounded-2xl p-12 text-center"
          >
            <FlaskConical className="h-10 w-10 text-primary/40 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">{t.backtesting.empty}</p>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default Backtesting;

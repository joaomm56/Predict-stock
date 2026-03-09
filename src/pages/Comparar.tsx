import { useState } from "react";
import { motion } from "framer-motion";
import { GitCompare, Plus, X, Search } from "lucide-react";
import Navbar from "@/components/Navbar";
import { getHistory } from "@/lib/api";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--destructive))",
  "#f59e0b",
  "#8b5cf6",
];

const PERIODS = [
  { label: "1M", value: "1mo" },
  { label: "3M", value: "3mo" },
  { label: "6M", value: "6mo" },
  { label: "1A", value: "1y" },
  { label: "2A", value: "2y" },
  { label: "5A", value: "5y" },
];

interface TickerData {
  ticker: string;
  dates: string[];
  values: number[];
}

const Comparar = () => {
  usePageTitle("Compare");
  const { t } = useLanguage();
  const [tickers, setTickers] = useState<string[]>(["AAPL", "MSFT"]);
  const [input, setInput] = useState("");
  const [period, setPeriod] = useState("1y");
  const [data, setData] = useState<TickerData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [normalise, setNormalise] = useState(true);

  const addTicker = () => {
    const sym = input.trim().toUpperCase();
    if (!sym || tickers.includes(sym) || tickers.length >= 4) return;
    setTickers((prev) => [...prev, sym]);
    setInput("");
  };

  const removeTicker = (sym: string) => setTickers((prev) => prev.filter((x) => x !== sym));

  const handleCompare = async () => {
    if (tickers.length < 2) { setError(t.comparar.err_min); return; }
    setLoading(true);
    setError(null);
    try {
      const results = await Promise.all(tickers.map((sym) => getHistory(sym, period)));
      setData(results.map((r, i) => ({ ticker: tickers[i], dates: r.dates, values: r.values })));
    } catch (e) {
      setError(e instanceof Error ? e.message : t.comparar.err_load);
    } finally {
      setLoading(false);
    }
  };

  // Merge dates and build chart rows
  const chartData = (() => {
    if (!data.length) return [];
    // Use the shortest series as base
    const base = data.reduce((a, b) => a.dates.length < b.dates.length ? a : b);
    return base.dates.map((date, i) => {
      const row: Record<string, string | number> = { date: date.slice(0, 7) };
      data.forEach((d) => {
        const baseVal = normalise ? d.values[0] : 1;
        const idx = Math.min(i, d.values.length - 1);
        row[d.ticker] = normalise
          ? parseFloat(((d.values[idx] / baseVal) * 100).toFixed(2))
          : parseFloat(d.values[idx].toFixed(2));
      });
      return row;
    });
  })();

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
            <GitCompare className="h-3.5 w-3.5 text-primary" />
            <span className="font-mono text-xs text-primary">{t.comparar.badge}</span>
          </div>
          <h1 className="text-3xl font-bold text-foreground">{t.comparar.title} <span className="text-primary">{t.comparar.title_hl}</span></h1>
          <p className="text-muted-foreground mt-1">{t.comparar.desc}</p>
        </motion.div>

        {/* Controls */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="glass rounded-2xl p-5 mb-8 space-y-4"
        >
          {/* Ticker chips */}
          <div className="flex flex-wrap gap-2">
            {tickers.map((sym, i) => (
              <div
                key={sym}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-mono font-semibold border"
                style={{ borderColor: COLORS[i] + "60", color: COLORS[i], background: COLORS[i] + "15" }}
              >
                {sym}
                <button onClick={() => removeTicker(sym)} className="opacity-60 hover:opacity-100 transition-opacity">
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            {tickers.length < 4 && (
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  placeholder={t.comparar.ph_ticker}
                  value={input}
                  onChange={(e) => setInput(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTicker())}
                  className="rounded-lg bg-secondary border border-border px-3 py-1.5 font-mono text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary w-24"
                />
                <button
                  onClick={addTicker}
                  disabled={!input.trim()}
                  className="rounded-lg border border-border p-1.5 text-muted-foreground hover:text-primary hover:border-primary transition-colors disabled:opacity-40"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Period + options */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-1 rounded-lg border border-border p-0.5">
              {PERIODS.map((p) => (
                <button
                  key={p.value}
                  onClick={() => setPeriod(p.value)}
                  className={`px-2.5 py-1 rounded-md text-xs font-mono font-medium transition-colors ${
                    period === p.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={normalise}
                onChange={(e) => setNormalise(e.target.checked)}
                className="accent-primary"
              />
              {t.comparar.normalise}
            </label>
          </div>

          {error && <p className="text-xs text-destructive font-mono">{error}</p>}

          <button
            onClick={handleCompare}
            disabled={loading || tickers.length < 2}
            className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            <Search className="h-4 w-4" />
            {loading ? t.comparar.btn_loading : t.comparar.btn_compare}
          </button>
        </motion.div>

        {/* Chart */}
        {chartData.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="glass rounded-2xl p-6"
          >
            <p className="font-mono text-sm font-semibold text-foreground mb-4">
              {normalise ? t.comparar.chart_norm : t.comparar.chart_abs}
            </p>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                  <YAxis
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    tickLine={false}
                    axisLine={false}
                    width={normalise ? 36 : 52}
                    tickFormatter={(v) => normalise ? v : `$${v}`}
                    domain={["auto", "auto"]}
                  />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }}
                    formatter={(v: number, name) => [normalise ? `${v.toFixed(2)}` : `$${v.toFixed(2)}`, name]}
                  />
                  <Legend wrapperStyle={{ fontSize: "12px", fontFamily: "monospace" }} />
                  {data.map((d, i) => (
                    <Line
                      key={d.ticker}
                      type="monotone"
                      dataKey={d.ticker}
                      stroke={COLORS[i]}
                      strokeWidth={2}
                      dot={false}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        )}

        {!chartData.length && !loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="glass rounded-2xl p-12 text-center"
          >
            <GitCompare className="h-10 w-10 text-primary/40 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">{t.comparar.empty}</p>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default Comparar;

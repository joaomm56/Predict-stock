import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Activity, Search, TrendingUp, TrendingDown, Brain } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import Navbar from "@/components/Navbar";
import StockChart from "@/components/StockChart";
import { getForecast, type ForecastResponse } from "@/lib/api";
import type { ChartPoint } from "@/components/StockChart";
import { usePageTitle } from "@/hooks/usePageTitle";

function buildChartData(result: ForecastResponse): ChartPoint[] {
  const realMap = new Map(result.real.dates.map((d, i) => [d, result.real.values[i]]));
  const histMap = new Map(result.historic_pred.dates.map((d, i) => [d, result.historic_pred.values[i]]));

  const historicalPoints: ChartPoint[] = result.real.dates.map((d) => ({
    name: d.slice(0, 7),
    price: realMap.get(d) ?? null,
    predicted: histMap.get(d) ?? null,
  }));

  // Show only last 60 historical points to keep chart readable
  const trimmed = historicalPoints.slice(-60);

  const futurePoints: ChartPoint[] = result.future_pred.dates.map((d) => ({
    name: d.slice(0, 7),
    price: null,
    predicted: result.future_pred.values[result.future_pred.dates.indexOf(d)],
  }));

  // Sample future to ~24 points
  const step = Math.max(1, Math.floor(futurePoints.length / 24));
  const sampledFuture = futurePoints.filter((_, i) => i % step === 0);

  return [...trimmed, ...sampledFuture];
}

const POPULAR = ["AAPL", "TSLA", "NVDA", "MSFT", "AMZN", "GOOGL"];

const Forecast = () => {
  usePageTitle("Previsões");
  const [searchParams] = useSearchParams();
  const [ticker, setTicker] = useState(searchParams.get("ticker") ?? "");
  const [start, setStart] = useState("2022-01-01");
  const [end, setEnd] = useState(new Date().toISOString().slice(0, 10));
  const [days, setDays] = useState(365);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ForecastResponse | null>(null);
  const [chartData, setChartData] = useState<ChartPoint[] | undefined>(undefined);

  useEffect(() => {
    const t = searchParams.get("ticker");
    if (t) setTicker(t);
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticker.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setChartData(undefined);

    try {
      const data = await getForecast({ ticker: ticker.trim(), start, end, forecast_days: days });
      setResult(data);
      setChartData(buildChartData(data));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
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
            <span className="font-mono text-xs text-primary">Previsão com NeuralProphet</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
            Prever <span className="text-primary">Ação</span>
          </h1>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Insere o ticker, o intervalo histórico e quantos dias queres prever.
          </p>
        </motion.div>

        {/* Form */}
        <motion.form
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          onSubmit={handleSubmit}
          className="glass rounded-2xl p-6 max-w-3xl mx-auto mb-10"
        >
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="block text-xs text-muted-foreground mb-1.5 font-mono">Ticker</label>
              <input
                type="text"
                placeholder="ex: AAPL"
                value={ticker}
                onChange={(e) => setTicker(e.target.value.toUpperCase())}
                className="w-full rounded-lg bg-secondary border border-border px-3 py-2 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1.5 font-mono">Início</label>
              <input
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="w-full rounded-lg bg-secondary border border-border px-3 py-2 font-mono text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1.5 font-mono">Fim</label>
              <input
                type="date"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                className="w-full rounded-lg bg-secondary border border-border px-3 py-2 font-mono text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1.5 font-mono">Dias previsão</label>
              <input
                type="number"
                min={7}
                max={730}
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
                className="w-full rounded-lg bg-secondary border border-border px-3 py-2 font-mono text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !ticker.trim()}
            className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 font-semibold text-sm text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Search className="h-4 w-4" />
            {loading ? "A processar…" : "Gerar Previsão"}
          </button>

          {error && (
            <p className="mt-3 text-sm text-destructive font-mono">{error}</p>
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
            <p className="font-semibold text-foreground mb-1">A treinar o modelo de IA…</p>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto">
              O NeuralProphet está a processar os dados históricos. Isto pode demorar alguns minutos.
            </p>
            <div className="mt-6 flex justify-center gap-1.5">
              {["Dados históricos", "Treino", "Previsão"].map((step, i) => (
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
            <p className="font-medium text-foreground mb-1">Pronto para prever</p>
            <p className="text-sm text-muted-foreground mb-6">
              Preenche o formulário acima e clica em "Gerar Previsão".
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <p className="w-full text-xs text-muted-foreground font-mono mb-1">Sugestões populares</p>
              {POPULAR.map((t) => (
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
                  <p className="text-xs text-muted-foreground font-mono mb-0.5">Preço atual</p>
                  <span className="font-mono text-xl font-bold text-foreground">
                    {result.last_price.toFixed(2)} {result.meta.currency}
                  </span>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground font-mono mb-0.5">Previsão ({days}d)</p>
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
              <div className="flex items-center justify-between mb-4">
                <span className="font-mono text-sm text-primary font-medium">Histórico + Previsão</span>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-primary" />
                    <span className="text-xs text-muted-foreground">Preço Real</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-accent border border-dashed border-accent" />
                    <span className="text-xs text-muted-foreground">Previsão IA</span>
                  </div>
                </div>
              </div>
              <StockChart chartData={chartData} />
            </div>

            {/* Metrics */}
            <div className="grid sm:grid-cols-3 gap-4">
              {[
                { label: "R² Score", value: result.metrics.r2.toFixed(4), desc: "Qualidade do modelo" },
                { label: "MAE", value: result.metrics.mae.toFixed(4), desc: "Erro absoluto médio" },
                { label: "MAPE", value: `${result.metrics.mape.toFixed(2)}%`, desc: "Erro percentual médio" },
              ].map((m) => (
                <div key={m.label} className="glass rounded-xl p-5 text-center">
                  <p className="text-xs text-muted-foreground font-mono mb-1">{m.label}</p>
                  <p className="font-mono text-2xl font-bold text-primary">{m.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{m.desc}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default Forecast;

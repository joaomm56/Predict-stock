import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Heart, Zap, TrendingUp, TrendingDown, BarChart2, Clock, ArrowLeft, Lock,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import Navbar from "@/components/Navbar";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { getStockInfo, getHistory } from "@/lib/api";
import { usePageTitle } from "@/hooks/usePageTitle";
import { usePlan, getForecastUsage } from "@/hooks/usePlan";

/* ── Types ──────────────────────────────────────────────────────────────── */
interface FavItem {
  id: string;
  ticker: string;
  name?: string;
  price?: number | null;
  change?: number | null;
  loading: boolean;
}


/* ── Custom tooltip ─────────────────────────────────────────────────────── */
const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass rounded-lg px-3 py-2 text-xs font-mono">
      <p className="text-muted-foreground mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name === "real" ? "Preço Real" : "Previsão IA"}: ${p.value}
        </p>
      ))}
    </div>
  );
};

/* ── Component ──────────────────────────────────────────────────────────── */
const Dashboard = () => {
  usePageTitle("Dashboard");
  const { user } = useAuth();
  const { plan, limits } = usePlan();
  const navigate = useNavigate();

  // Map plan chart history limit to yfinance period string
  const historyPeriod = limits.chartHistoryDays <= 30 ? "1mo" : limits.chartHistoryDays <= 730 ? "2y" : "10y";

  // Forecasts remaining today (for free plan)
  const forecastsLeft = limits.forecastsPerDay === Infinity
    ? Infinity
    : Math.max(0, limits.forecastsPerDay - getForecastUsage().count);
  const [favs, setFavs]               = useState<FavItem[]>([]);
  const [favsLoading, setFavsLoading] = useState(true);
  const [perfChart, setPerfChart] = useState<{ mes: string; real: number }[]>([]);
  const [perfTicker, setPerfTicker] = useState<string>("");
  const [perfLoading, setPerfLoading] = useState(false);
  interface ForecastRow {
    id: string;
    ticker: string;
    horizon_days: number;
    predicted_price: number;
    last_price: number;
    mape: number | null;
    r2: number | null;
    created_at: string;
  }
  const [history, setHistory] = useState<ForecastRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  const firstName   = (user?.user_metadata?.full_name ?? user?.email ?? "").split(" ")[0];
  const avgAccuracy = history.length > 0
    ? (history.reduce((s, h) => s + Math.max(0, 100 - (h.mape ?? 100)), 0) / history.length).toFixed(1)
    : "—";
  const hitRate = history.length > 0
    ? Math.round((history.filter((h) => (h.r2 ?? 0) > 0).length / history.length) * 100)
    : "—";

  const loadChart = async (ticker: string) => {
    setPerfTicker(ticker);
    setPerfLoading(true);
    try {
      const hist = await getHistory(ticker, historyPeriod);
      setPerfChart(hist.dates.map((d, i) => ({ mes: d, real: hist.values[i] })));
    } catch {
      setPerfChart([]);
    } finally {
      setPerfLoading(false);
    }
  };

  /* Load favorites + live prices */
  useEffect(() => {
    if (!user) return;

    const load = async () => {
      setFavsLoading(true);

      const { data } = await supabase
        .from("favorites")
        .select("id, ticker")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (!data || data.length === 0) {
        setFavs([]);
        setFavsLoading(false);
        return;
      }

      // Show placeholders immediately
      setFavs(data.map((row) => ({ id: row.id, ticker: row.ticker, loading: true })));

      // Enrich with live prices in parallel
      const enriched = await Promise.all(
        data.map(async (row) => {
          try {
            const info = await getStockInfo(row.ticker);
            return { id: row.id, ticker: row.ticker, name: info.name, price: info.price, change: info.change, loading: false };
          } catch {
            return { id: row.id, ticker: row.ticker, loading: false };
          }
        })
      );

      setFavs(enriched);

      if (enriched.length > 0) loadChart(enriched[0].ticker);

      setFavsLoading(false);
    };

    load();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setHistoryLoading(true);
      const { data } = await supabase
        .from("forecasts")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      setHistory(data ?? []);
      setHistoryLoading(false);
    };
    load();
  }, [user]);

  const stats = [
    { icon: Heart,      label: "A seguir",            value: favsLoading ? "…" : favs.length,  color: "text-rose-400" },
    { icon: Zap,        label: "Precisão Média",       value: avgAccuracy === "—" ? "—" : `${avgAccuracy}%`, color: "text-primary"  },
    { icon: TrendingUp, label: "Taxa de Acerto",       value: hitRate     === "—" ? "—" : `${hitRate}%`,     color: "text-chart-up" },
    { icon: BarChart2,  label: "Previsões Rastreadas", value: history.length,                   color: "text-accent"   },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="container mx-auto px-6 pt-28 pb-20 max-w-6xl">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-10"
        >
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar ao início
          </button>
          <h1 className="text-3xl font-bold text-foreground">
            Meu <span className="text-primary">Dashboard</span>
          </h1>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <p className="text-muted-foreground">Bem-vindo, {firstName}</p>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 border border-primary/20 px-2.5 py-0.5 text-xs font-semibold text-primary capitalize">
              {plan}
            </span>
            {plan === "free" && (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground font-mono">
                <Zap className="h-3 w-3" />
                {forecastsLeft === 0 ? "Limite de previsões atingido" : `${forecastsLeft}/${limits.forecastsPerDay} previsões hoje`}
              </span>
            )}
          </div>
        </motion.div>

        {/* Stat cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {stats.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
              className="glass rounded-xl p-5 flex items-center gap-4"
            >
              <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                <s.icon className={`h-5 w-5 ${s.color}`} />
              </div>
              <div>
                <p className="text-xl font-bold font-mono text-foreground">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Main grid */}
        <div className="grid lg:grid-cols-[340px_1fr] gap-6 mb-6">

          {/* Favorites panel */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="glass rounded-2xl p-6 flex flex-col"
          >
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <Heart className="h-4 w-4 text-rose-400" />
                <h2 className="font-semibold text-foreground">A Seguir</h2>
              </div>
              {favs.length > 0 && (
                <Link to="/portfolio" className="text-xs text-primary hover:underline">Ver tudo</Link>
              )}
            </div>

            {!favsLoading && plan === "free" && favs.length > limits.portfolioMax && (
              <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 mb-4">
                <Lock className="h-3.5 w-3.5 text-destructive flex-shrink-0" />
                <p className="text-xs text-destructive flex-1">
                  Tens {favs.length} ações — limite Free é {limits.portfolioMax}.
                </p>
                <Link to="/portfolio" className="text-xs font-semibold text-primary whitespace-nowrap">Gerir</Link>
              </div>
            )}

            {favsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-secondary animate-pulse" />
                      <div className="space-y-1.5">
                        <div className="h-3.5 w-14 rounded bg-secondary animate-pulse" />
                        <div className="h-3 w-20 rounded bg-secondary animate-pulse" />
                      </div>
                    </div>
                    <div className="space-y-1.5 text-right">
                      <div className="h-3.5 w-16 rounded bg-secondary animate-pulse ml-auto" />
                      <div className="h-3 w-12 rounded bg-secondary animate-pulse ml-auto" />
                    </div>
                  </div>
                ))}
              </div>
            ) : favs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center flex-1">
                <Heart className="h-10 w-10 text-muted-foreground/20 mb-3" />
                <p className="text-sm text-muted-foreground mb-3">Ainda não segues nenhuma ação.</p>
                <Link to="/portfolio" className="text-sm text-primary hover:underline">
                  Adicionar ao portfólio
                </Link>
              </div>
            ) : (
              <div className="space-y-4 overflow-y-auto max-h-[280px] pr-1">
                {favs.map((fav) => (
                  <div key={fav.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <span className="font-mono text-xs font-bold text-primary">{fav.ticker.slice(0, 2)}</span>
                      </div>
                      <div>
                        <p className="font-mono text-sm font-bold text-foreground">{fav.ticker}</p>
                        <p className="text-xs text-muted-foreground truncate max-w-[120px]">{fav.name ?? "—"}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-sm font-semibold text-foreground">
                        {fav.price != null ? `$${fav.price.toFixed(2)}` : "—"}
                      </p>
                      {fav.change != null && (
                        <div className={`flex items-center justify-end gap-0.5 font-mono text-xs ${fav.change >= 0 ? "text-chart-up" : "text-chart-down"}`}>
                          {fav.change >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                          {fav.change >= 0 ? "+" : ""}{fav.change.toFixed(2)}%
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>

          {/* Performance chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.25 }}
            className="glass rounded-2xl p-6"
          >
            <div className="flex items-center gap-2 mb-3">
              <BarChart2 className="h-4 w-4 text-primary" />
              <h2 className="font-semibold text-foreground">Evolução do Portfólio</h2>
              {perfLoading && <span className="text-xs text-muted-foreground font-mono animate-pulse">a carregar…</span>}
            </div>
            {favs.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-4">
                {favs.map((f) => (
                  <button
                    key={f.ticker}
                    onClick={() => loadChart(f.ticker)}
                    className={`rounded-lg px-2.5 py-1 font-mono text-xs font-semibold transition-colors ${
                      perfTicker === f.ticker
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-muted-foreground hover:text-primary hover:border-primary border border-border"
                    }`}
                  >
                    {f.ticker}
                  </button>
                ))}
              </div>
            )}
            {perfChart.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={perfChart} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                  <defs>
                    <linearGradient id="gradReal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="hsl(175 80% 50%)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(175 80% 50%)" stopOpacity={0}   />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="mes" tick={{ fontSize: 10, fill: "hsl(220 10% 50%)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(220 10% 50%)" }} axisLine={false} tickLine={false} domain={["auto", "auto"]} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area type="monotone" dataKey="real" name="Preço Real" stroke="hsl(175 80% 50%)" strokeWidth={2} fill="url(#gradReal)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-[220px] text-center">
                <BarChart2 className="h-8 w-8 text-muted-foreground/20 mb-2" />
                <p className="text-sm text-muted-foreground">Adiciona ações ao portfólio para ver o gráfico.</p>
              </div>
            )}
          </motion.div>
        </div>

        {/* History table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="glass rounded-2xl overflow-hidden"
        >
          <div className="flex items-center gap-2 px-6 py-4 border-b border-border">
            <Clock className="h-4 w-4 text-primary" />
            <h2 className="font-semibold text-foreground">Histórico de Performance</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  {["Data", "Ativo", "Preço Atual", "Previsão", "Horizonte", "Tendência", "Precisão"].map((h) => (
                    <th key={h} className="px-6 py-3 text-left text-xs font-mono text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {historyLoading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-10 text-center text-sm text-muted-foreground font-mono">
                      A carregar…
                    </td>
                  </tr>
                ) : history.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-10 text-center text-sm text-muted-foreground">
                      Ainda não geraste nenhuma previsão.{" "}
                      <Link to="/forecast" className="text-primary underline underline-offset-2">Gerar agora</Link>
                    </td>
                  </tr>
                ) : history.map((row) => {
                  const isUp = row.predicted_price >= row.last_price;
                  const changePct = (((row.predicted_price - row.last_price) / row.last_price) * 100).toFixed(2);
                  const accuracy = Math.max(0, 100 - (row.mape ?? 100)).toFixed(1);
                  return (
                    <tr key={row.id} className="hover:bg-secondary/20 transition-colors">
                      <td className="px-6 py-4 text-sm text-muted-foreground font-mono">
                        {new Date(row.created_at).toLocaleDateString("pt-PT")}
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-mono text-sm font-bold text-primary">{row.ticker}</span>
                      </td>
                      <td className="px-6 py-4 font-mono text-sm text-foreground">${row.last_price.toFixed(2)}</td>
                      <td className="px-6 py-4 font-mono text-sm text-foreground">${row.predicted_price.toFixed(2)}</td>
                      <td className="px-6 py-4 font-mono text-sm text-muted-foreground">{row.horizon_days}d</td>
                      <td className="px-6 py-4">
                        <div className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-semibold font-mono ${
                          isUp ? "bg-chart-up/10 text-chart-up" : "bg-destructive/10 text-destructive"
                        }`}>
                          {isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                          {isUp ? "+" : ""}{changePct}%
                        </div>
                      </td>
                      <td className="px-6 py-4 font-mono text-sm text-foreground">{accuracy}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Dashboard;

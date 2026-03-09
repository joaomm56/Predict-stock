import { useAuth } from "@/contexts/AuthContext";

export type PlanKey = "free" | "pro" | "premium";

interface PlanLimits {
  portfolioMax: number;       // max stocks in portfolio
  forecastsPerDay: number;    // max AI forecasts per day
  chartHistoryDays: number;   // days shown in dashboard/portfolio charts
  forecastHistoryDays: number; // max days of training data for AI forecasts
  forecastDaysMax: number;    // max days into the future to forecast
  advancedMetrics: boolean;   // R², MAE, MAPE visibility
}

const LIMITS: Record<PlanKey, PlanLimits> = {
  free:    { portfolioMax: 3,        forecastsPerDay: 5,        chartHistoryDays: 30,   forecastHistoryDays: 365,  forecastDaysMax: 30,  advancedMetrics: false },
  pro:     { portfolioMax: Infinity, forecastsPerDay: Infinity, chartHistoryDays: 730,  forecastHistoryDays: 730,  forecastDaysMax: 365, advancedMetrics: true  },
  premium: { portfolioMax: Infinity, forecastsPerDay: Infinity, chartHistoryDays: 3650, forecastHistoryDays: 3650, forecastDaysMax: 730, advancedMetrics: true  },
};

const STORAGE_KEY = "forecast_usage";

interface ForecastUsage {
  date: string;
  count: number;
}

export function getForecastUsage(): ForecastUsage {
  const today = new Date().toISOString().slice(0, 10);
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed: ForecastUsage = JSON.parse(raw);
      if (parsed.date === today) return parsed;
    }
  } catch {}
  return { date: today, count: 0 };
}

export function incrementForecastUsage(): void {
  const usage = getForecastUsage();
  usage.count += 1;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(usage));
}

export function usePlan() {
  const { user } = useAuth();
  const plan = ((user?.user_metadata?.plan as PlanKey) ?? "free");
  const limits = LIMITS[plan] ?? LIMITS.free;
  return { plan, limits };
}

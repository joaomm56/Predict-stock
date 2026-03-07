const BASE_URL = import.meta.env.VITE_API_URL ?? "https://predict-stock-jnjm.onrender.com";

// ── Types ──────────────────────────────────────────────────────────────────

export interface StockInfo {
  name: string;
  currency: string;
  sector: string;
  country: string;
  price: number | null;
  change: number | null;
}

export interface ForecastRequest {
  ticker: string;
  start: string;
  end: string;
  forecast_days?: number;
}

export interface Series {
  dates: string[];
  values: number[];
}

export interface OhlcvSeries {
  dates: string[];
  open: number[];
  high: number[];
  low: number[];
  close: number[];
  volume: number[];
}

export interface ForecastMetrics {
  r2: number;
  mae: number;
  mape: number;
}

export interface ForecastResponse {
  meta: {
    name: string;
    currency: string;
    sector: string;
    country: string;
  };
  ticker: string;
  last_price: number;
  metrics: ForecastMetrics;
  forecast_end_price: number;
  real: Series;
  historic_pred: Series;
  future_pred: Series;
  ohlcv: OhlcvSeries;
}

// ── Helpers ────────────────────────────────────────────────────────────────

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail ?? `HTTP ${res.status}`);
  }

  return res.json() as Promise<T>;
}

// ── API calls ──────────────────────────────────────────────────────────────

export function getHealth() {
  return apiFetch<{ status: string }>("/health");
}

export function getStockInfo(ticker: string) {
  return apiFetch<StockInfo>(`/info/${encodeURIComponent(ticker.toUpperCase())}`);
}

export function getForecast(req: ForecastRequest) {
  return apiFetch<ForecastResponse>("/forecast", {
    method: "POST",
    body: JSON.stringify({ forecast_days: 365, ...req }),
  });
}

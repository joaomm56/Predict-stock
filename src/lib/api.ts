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

export function getHistory(ticker: string, period = "1y") {
  return apiFetch<{ ticker: string; dates: string[]; values: number[] }>(
    `/history/${encodeURIComponent(ticker.toUpperCase())}?period=${period}`
  );
}

export async function getForecast(req: ForecastRequest, token?: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}/forecast`, {
    method: "POST",
    headers,
    body: JSON.stringify({ forecast_days: 365, ...req }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail ?? `HTTP ${res.status}`);
  }

  return res.json() as Promise<ForecastResponse>;
}

export interface IndicatorsResponse {
  ticker: string;
  dates: string[];
  close: number[];
  rsi: (number | null)[];
  macd: (number | null)[];
  macd_signal: (number | null)[];
  macd_hist: (number | null)[];
  bb_upper: (number | null)[];
  bb_mid: (number | null)[];
  bb_lower: (number | null)[];
}

export function getIndicators(ticker: string, period = "1y") {
  return apiFetch<IndicatorsResponse>(
    `/indicators/${encodeURIComponent(ticker.toUpperCase())}?period=${period}`
  );
}

export function createCheckoutSession(plan: string, user_id: string) {
  return apiFetch<{ url: string }>("/create-checkout-session", {
    method: "POST",
    body: JSON.stringify({ plan, user_id }),
  });
}

export function verifyCheckout(session_id: string) {
  return apiFetch<{ plan: string; user_id: string }>(
    `/verify-checkout?session_id=${encodeURIComponent(session_id)}`
  );
}

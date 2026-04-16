import warnings
warnings.simplefilter(action="ignore", category=FutureWarning)
import matplotlib
matplotlib.use("Agg")
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import traceback
import os
import threading
from datetime import datetime
from dotenv import load_dotenv
load_dotenv()
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.starlette import StarletteIntegration
import stripe
import numpy as np
import pandas as pd
import yfinance as yf
from cachetools import TTLCache, cached
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.metrics import r2_score, mean_absolute_error, mean_absolute_percentage_error

# ── Observability ──────────────────────────────────────────────────────────────
from prometheus_fastapi_instrumentator import Instrumentator
from prometheus_client import Counter, Gauge, Histogram
import structlog
import logging
from pythonjsonlogger import jsonlogger

stripe.api_key = os.getenv("STRIPE_SECRET_KEY", "").strip()
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "").strip()

SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip()
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173").strip()

_sentry_dsn = os.getenv("SENTRY_DSN", "").strip()
if _sentry_dsn:
    sentry_sdk.init(
        dsn=_sentry_dsn,
        integrations=[StarletteIntegration(), FastApiIntegration()],
        traces_sample_rate=0.1,
    )

# ── Logger estruturado (JSON → Loki) ──────────────────────────────────────────
_log_handler = logging.StreamHandler()
_log_handler.setFormatter(jsonlogger.JsonFormatter(
    "%(asctime)s %(levelname)s %(name)s %(message)s"
))
logging.basicConfig(handlers=[_log_handler], level=logging.INFO)
logger = structlog.get_logger()

# ── Métricas Prometheus ────────────────────────────────────────────────────────
# IMPORTANTE: definidas AQUI, antes de qualquer uso (check_and_increment_quota, forecast)
forecast_requests_total = Counter(
    "predict_stock_forecast_total",
    "Total de forecasts realizados",
    ["ticker", "plan", "model_type"]
)

forecast_latency = Histogram(
    "predict_stock_forecast_duration_seconds",
    "Tempo de inferência do modelo por ticker",
    ["ticker"],
    buckets=[0.5, 1, 2, 5, 10, 20, 30, 60]
)

model_mae = Gauge(
    "predict_stock_model_mae",
    "Mean Absolute Error do modelo (última previsão)",
    ["ticker"]
)

model_mape = Gauge(
    "predict_stock_model_mape",
    "Mean Absolute Percentage Error do modelo (%)",
    ["ticker"]
)

model_r2 = Gauge(
    "predict_stock_model_r2",
    "R² score do modelo (última previsão)",
    ["ticker"]
)

quota_hits_total = Counter(
    "predict_stock_quota_exceeded_total",
    "Total de vezes que o limite diário foi atingido"
)

cache_hits_total = Counter(
    "predict_stock_cache_hits_total",
    "Cache hits no yfinance",
    ["cache_type"]
)

# ── yfinance cache ─────────────────────────────────────────────────────────────
_info_lock  = threading.Lock()
_hist_lock  = threading.Lock()
_stock_lock = threading.Lock()

_info_cache  = TTLCache(maxsize=256, ttl=300)
_hist_cache  = TTLCache(maxsize=128, ttl=600)
_stock_cache = TTLCache(maxsize=64,  ttl=300)


@cached(_info_cache, lock=_info_lock)
def _cached_ticker_info(ticker: str) -> dict:
    return yf.Ticker(ticker).info


@cached(_hist_cache, lock=_hist_lock)
def _cached_ticker_history(ticker: str, period: str):
    return yf.Ticker(ticker).history(period=period).copy()


@cached(_stock_cache, lock=_stock_lock)
def _cached_stock_fetch(ticker: str, start: str, end: str):
    tk = yf.Ticker(ticker)
    return tk.history(start=start, end=end).copy(), tk.info

PRICE_IDS = {
    "pro":     "price_1T8rsURNJEKtZi6YDft6rnbu",
    "premium": "price_1T8rsrRNJEKtZi6YYKE6RHVj",
}

limiter = Limiter(key_func=get_remote_address)

app = FastAPI(title="Stock Forecast API")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL, "http://localhost:5173", "http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Prometheus automático (latência, erros, requests por endpoint) ─────────────
# Logo após o middleware, antes dos routes
Instrumentator().instrument(app).expose(app)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    print(traceback.format_exc())
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error."},
        headers={"Access-Control-Allow-Origin": FRONTEND_URL},
    )


# ── Quota enforcement ─────────────────────────────────────────────────────────
FREE_FORECASTS_PER_DAY = 5


def check_and_increment_quota(token: str) -> str:
    if not token or not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        return "free"

    try:
        from supabase import create_client
        sb = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

        user_resp = sb.auth.get_user(token)
        user = user_resp.user
        if not user:
            return "free"

        meta = user.user_metadata or {}
        plan: str = meta.get("plan", "free") or "free"

        if plan != "free":
            return plan

        today = datetime.utcnow().strftime("%Y-%m-%d")
        quota_date = meta.get("quota_date", "")
        quota_count = int(meta.get("quota_count", 0)) if quota_date == today else 0

        if quota_count >= FREE_FORECASTS_PER_DAY:
            quota_hits_total.inc()  # ← métrica de limite atingido
            raise HTTPException(
                status_code=429,
                detail=f"Daily forecast limit reached ({FREE_FORECASTS_PER_DAY}/day). Upgrade to Pro for unlimited forecasts."
            )

        sb.auth.admin.update_user_by_id(user.id, {
            "user_metadata": {**meta, "quota_date": today, "quota_count": quota_count + 1}
        })
        return "free"

    except HTTPException:
        raise
    except Exception as e:
        print(f"Quota check error: {e}")
        return "free"


# ── Models ────────────────────────────────────────────────────────────────────
class ForecastRequest(BaseModel):
    ticker: str
    start: str
    end: str
    forecast_days: int = 365


class CheckoutRequest(BaseModel):
    plan: str
    user_id: str


# ── GBM helpers ───────────────────────────────────────────────────────────────
_LAGS    = [1, 2, 3, 5, 10, 20, 30, 60]
_WINDOWS = [5, 10, 20, 50]
_MIN_HIST = max(_LAGS + _WINDOWS)


class EnsembleModel:
    def __init__(self, models: list):
        self.models = models

    def predict(self, X: np.ndarray) -> np.ndarray:
        return np.mean([m.predict(X) for m in self.models], axis=0)


def _build_row(prices: np.ndarray, i: int, use_vol: bool, volumes: np.ndarray) -> list:
    row = []
    cur = prices[i - 1]
    safe_cur = max(cur, 1e-8)

    for lag in _LAGS:
        row.append(prices[i - lag] / safe_cur - 1.0)

    for lag in [1, 5, 10, 20]:
        prev = prices[i - lag - 1] if (i - lag - 1) >= 0 else prices[0]
        row.append(np.log(prices[i - 1] / prev) if prev > 0 else 0.0)

    for w in _WINDOWS:
        mean_w = float(np.mean(prices[i - w : i]))
        row.append(mean_w / safe_cur - 1.0)

    for w in [5, 20, 50]:
        row.append(float(np.std(prices[max(0, i - w) : i])) / safe_cur)

    for p in [5, 10, 20, 30]:
        base = prices[i - p - 1] if (i - p - 1) >= 0 else prices[0]
        row.append(prices[i - 1] / max(base, 1e-8) - 1.0)

    if use_vol:
        mean_20v = float(np.mean(volumes[max(0, i - 20) : i]))
        mean_5v  = float(np.mean(volumes[max(0, i - 5)  : i]))
        safe_20v = max(mean_20v, 1e-8)
        row.append(volumes[i - 1] / safe_20v - 1.0)
        row.append(mean_5v / safe_20v - 1.0)

    _diffs = np.diff(prices[max(0, i - 15) : i])
    if len(_diffs) > 0:
        _gains  = float(np.mean(np.maximum( _diffs, 0)))
        _losses = float(np.mean(np.maximum(-_diffs, 0)))
        _rs     = _gains / max(_losses, 1e-8)
        _rsi    = 100.0 - 100.0 / (1.0 + _rs)
    else:
        _rsi = 50.0
    row.append(float(np.clip(_rsi / 100.0 - 0.5, -0.5, 0.5)))

    _p_ewm = pd.Series(prices[max(0, i - 60) : i])
    _ema12 = float(_p_ewm.ewm(span=12, adjust=False).mean().iloc[-1])
    _ema26 = float(_p_ewm.ewm(span=26, adjust=False).mean().iloc[-1])
    row.append(float(np.clip((_ema12 - _ema26) / safe_cur, -1.0, 1.0)))

    _bb_w  = prices[max(0, i - 20) : i]
    _bb_m  = float(np.mean(_bb_w))
    _bb_s  = float(np.std(_bb_w))
    _bb_bw = max(4.0 * _bb_s, 1e-8)
    row.append(float(np.clip((prices[i - 1] - (_bb_m - 2.0 * _bb_s)) / _bb_bw - 0.5, -1.0, 1.0)))

    _ma200_w = prices[max(0, i - 200) : i]
    row.append(float(np.clip(prices[i - 1] / max(float(np.mean(_ma200_w)), 1e-8) - 1.0, -2.0, 2.0)))

    if i >= 21:
        _slope20 = (np.log(max(prices[i - 1], 1e-8)) - np.log(max(prices[i - 21], 1e-8))) / 20.0
    else:
        _slope20 = 0.0
    row.append(float(np.clip(_slope20, -0.5, 0.5)))

    return [float(np.clip(v, -10.0, 10.0)) for v in row]


def _build_feature_matrix(prices: np.ndarray, volumes: np.ndarray,
                          n_rows: int, start: int) -> np.ndarray:
    use_vol = len(volumes) == len(prices)
    cur = prices[start - 1 : start - 1 + n_rows]
    safe_cur = np.maximum(cur, 1e-8)

    cols: list[np.ndarray] = []

    for lag in _LAGS:
        cols.append(prices[start - lag : start - lag + n_rows] / safe_cur - 1.0)

    for lag in [1, 5, 10, 20]:
        prev = prices[start - lag - 1 : start - lag - 1 + n_rows]
        cols.append(np.log(np.maximum(cur, 1e-8) / np.maximum(prev, 1e-8)))

    price_ser = pd.Series(prices)
    for w in _WINDOWS:
        rm = price_ser.rolling(w).mean().values
        cols.append(rm[start - 1 : start - 1 + n_rows] / safe_cur - 1.0)

    for w in [5, 20, 50]:
        rs = price_ser.rolling(w).std().values
        cols.append(rs[start - 1 : start - 1 + n_rows] / safe_cur)

    for p in [5, 10, 20, 30]:
        base_p = prices[start - p - 1 : start - p - 1 + n_rows]
        cols.append(cur / np.maximum(base_p, 1e-8) - 1.0)

    if use_vol:
        vol_ser = pd.Series(volumes)
        mean_20 = vol_ser.rolling(20).mean().values[start - 1 : start - 1 + n_rows]
        mean_5  = vol_ser.rolling(5).mean().values[start - 1 : start - 1 + n_rows]
        vol_cur = volumes[start - 1 : start - 1 + n_rows]
        safe_20 = np.maximum(mean_20, 1e-8)
        cols.append(vol_cur / safe_20 - 1.0)
        cols.append(mean_5  / safe_20 - 1.0)

    _delta = price_ser.diff()
    _gain  = _delta.clip(lower=0).rolling(14).mean()
    _loss  = (-_delta.clip(upper=0)).rolling(14).mean()
    _rs    = _gain / (_loss + 1e-8)
    _rsi   = (100 - 100 / (1 + _rs)) / 100.0 - 0.5
    cols.append(_rsi.values[start - 1 : start - 1 + n_rows])

    _ema12 = price_ser.ewm(span=12, adjust=False).mean()
    _ema26 = price_ser.ewm(span=26, adjust=False).mean()
    _macd  = (_ema12 - _ema26) / price_ser.replace(0.0, 1e-8)
    cols.append(_macd.values[start - 1 : start - 1 + n_rows])

    _sma20   = price_ser.rolling(20).mean()
    _std20   = price_ser.rolling(20).std()
    _bb_lo   = _sma20 - 2 * _std20
    _bb_bw   = (4 * _std20).replace(0.0, 1e-8)
    _bb_pctb = (price_ser - _bb_lo) / _bb_bw - 0.5
    cols.append(_bb_pctb.fillna(0.0).values[start - 1 : start - 1 + n_rows])

    _ma200   = price_ser.rolling(200).mean()
    _dist200 = (price_ser / _ma200 - 1.0).fillna(0.0)
    cols.append(_dist200.values[start - 1 : start - 1 + n_rows])

    _log_p   = np.log(price_ser.replace(0.0, 1e-8))
    _slope20 = (_log_p - _log_p.shift(20)) / 20.0
    cols.append(_slope20.fillna(0.0).values[start - 1 : start - 1 + n_rows])

    X = np.column_stack(cols).astype(np.float64)
    X = np.nan_to_num(X, nan=0.0, posinf=0.0, neginf=0.0)
    return np.clip(X, -10.0, 10.0)


_MAX_TRAIN_ROWS = 1_500


def _make_features(prices: np.ndarray, volumes: np.ndarray):
    n = len(prices)
    n_rows_full = n - _MIN_HIST
    n_rows = min(n_rows_full, _MAX_TRAIN_ROWS)
    start  = n - n_rows

    X = _build_feature_matrix(prices, volumes, n_rows, start)
    base        = np.maximum(prices[start - 1 : start - 1 + n_rows], 1e-8)
    target      = np.maximum(prices[start     : start     + n_rows], 1e-8)
    log_returns = np.log(target / base)
    return X, log_returns.astype(np.float64)


def _recursive_forecast(model: GradientBoostingRegressor,
                         prices: np.ndarray, volumes: np.ndarray,
                         forecast_days: int,
                         return_bias: float = 0.0) -> list[float]:
    hist_log_rets = np.diff(np.log(np.maximum(prices[-252:], 1e-8)))
    if len(hist_log_rets) >= 10:
        cap_99 = float(np.percentile(np.abs(hist_log_rets), 99))
        _MAX_DAILY_LOG_RET = max(cap_99 * 1.5, np.log(1.02))
    else:
        _MAX_DAILY_LOG_RET = np.log(1.05)

    use_vol   = len(volumes) == len(prices)
    _buf_size = max(_MIN_HIST, 200)
    buf       = list(prices[-_buf_size:])
    vbuf      = list(volumes[-_buf_size:]) if use_vol else []

    raw_preds = []
    vol_arr   = np.array([])
    for _ in range(forecast_days):
        b = np.array(buf)
        if use_vol:
            vol_arr = np.array(vbuf)
        row     = _build_row(b, len(b), use_vol, vol_arr)
        log_ret = float(model.predict(np.array([row]))[0])

        log_ret -= return_bias
        log_ret  = float(np.clip(log_ret, -_MAX_DAILY_LOG_RET, _MAX_DAILY_LOG_RET))

        next_price = max(buf[-1] * np.exp(log_ret), 0.01)
        raw_preds.append(next_price)

        buf.append(next_price)
        buf = buf[1:]
        if use_vol:
            vbuf.append(vbuf[-1])
            vbuf = vbuf[1:]

    return raw_preds


_DIRECT_HORIZONS = [5, 10, 20, 30, 60, 90, 180, 365, 730]


def _make_features_direct(prices: np.ndarray, volumes: np.ndarray, horizon: int):
    n = len(prices)
    n_rows_full = n - _MIN_HIST - horizon + 1
    if n_rows_full < 20:
        return None, None
    n_rows = min(n_rows_full, _MAX_TRAIN_ROWS)
    start  = _MIN_HIST + (n_rows_full - n_rows)

    X      = _build_feature_matrix(prices, volumes, n_rows, start)
    base   = np.maximum(prices[start - 1           : start - 1 + n_rows], 1e-8)
    future = np.maximum(prices[start - 1 + horizon : start - 1 + horizon + n_rows], 1e-8)
    log_returns_h = np.log(future / base)
    return X, log_returns_h.astype(np.float64)


def _direct_forecast(prices: np.ndarray, volumes: np.ndarray,
                     forecast_days: int,
                     model_map: dict) -> list:
    use_vol = len(volumes) == len(prices)
    vol_arr = volumes if use_vol else np.array([])
    row = _build_row(prices, len(prices), use_vol, vol_arr)
    last_price = float(prices[-1])

    anchor_log_rets: dict[int, float] = {}
    for h, m in sorted(model_map.items()):
        lr = float(m.predict([row])[0])
        cap = np.log(1.05) * h
        anchor_log_rets[h] = float(np.clip(lr, -cap, cap))

    anchor_list = sorted(anchor_log_rets.keys())

    result: list[float] = []
    for t in range(1, forecast_days + 1):
        if t in anchor_log_rets:
            log_ret = anchor_log_rets[t]
        elif t < anchor_list[0]:
            h0 = anchor_list[0]
            log_ret = anchor_log_rets[h0] * t / h0
        elif t > anchor_list[-1]:
            h_last = anchor_list[-1]
            daily_rate = anchor_log_rets[h_last] / h_last
            raw = anchor_log_rets[h_last] + daily_rate * (t - h_last)
            cap = np.log(1.05) * t
            log_ret = float(np.clip(raw, -cap, cap))
        else:
            h_lo = max(h for h in anchor_list if h <= t)
            h_hi = min(h for h in anchor_list if h >= t)
            frac = (t - h_lo) / (h_hi - h_lo)
            log_ret = anchor_log_rets[h_lo] + frac * (anchor_log_rets[h_hi] - anchor_log_rets[h_lo])

        result.append(max(last_price * np.exp(log_ret), 0.01))

    return result


# ── Stock data helper ──────────────────────────────────────────────────────────
def fetch_stock(ticker: str, start: str, end: str):
    hist, info = _cached_stock_fetch(ticker, start, end)

    if hist.empty:
        raise HTTPException(status_code=404, detail=f"No data found for ticker '{ticker}'.")

    data = hist[["Close"]].reset_index()
    data.columns = ["ds", "y"]
    data["ds"] = pd.to_datetime(data["ds"]).dt.tz_localize(None)
    data = data.dropna().reset_index(drop=True)

    ohlcv = hist[["Open", "High", "Low", "Close", "Volume"]].reset_index()
    ohlcv.columns = ["ds", "open", "high", "low", "close", "volume"]
    ohlcv["ds"] = pd.to_datetime(ohlcv["ds"]).dt.tz_localize(None)

    meta = {
        "name":     info.get("shortName", ticker),
        "currency": info.get("currency", "USD"),
        "sector":   info.get("sector", "—"),
        "country":  info.get("country", "—"),
    }
    return data, ohlcv, meta


# ── Routes ────────────────────────────────────────────────────────────────────
@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/info/{ticker}")
@limiter.limit("60/minute")
def stock_info(request: Request, ticker: str):
    try:
        info = _cached_ticker_info(ticker.upper())
        if not info.get("shortName"):
            raise HTTPException(status_code=404, detail=f"Ticker '{ticker}' not found.")
        return {
            "name":     info.get("shortName", ticker),
            "currency": info.get("currency", "USD"),
            "sector":   info.get("sector", "—"),
            "country":  info.get("country", "—"),
            "price":    info.get("regularMarketPrice") or info.get("currentPrice"),
            "change":   info.get("regularMarketChangePercent"),
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/history/{ticker}")
@limiter.limit("60/minute")
def history(request: Request, ticker: str, period: str = "1y"):
    try:
        hist = _cached_ticker_history(ticker.upper(), period)
        if hist.empty:
            raise HTTPException(status_code=404, detail=f"No data for '{ticker}'.")
        hist = hist.copy()
        hist.index = hist.index.tz_localize(None)

        if period in ("1mo", "3mo"):
            series = hist["Close"].resample("W").last().dropna()
            fmt = "%d %b"
        elif period in ("6mo",):
            series = hist["Close"].resample("W").last().dropna()
            fmt = "%d %b"
        elif period in ("1y", "2y"):
            series = hist["Close"].resample("ME").last().dropna()
            fmt = "%b %Y"
        else:
            series = hist["Close"].resample("ME").last().dropna()
            fmt = "%b %Y"

        return {
            "ticker": ticker.upper(),
            "dates": series.index.strftime(fmt).tolist(),
            "values": [round(v, 2) for v in series.tolist()],
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/forecast")
@limiter.limit("10/minute")
def forecast(request: Request, req: ForecastRequest):
    ticker = req.ticker.upper()

    auth_header = request.headers.get("Authorization", "")
    token = auth_header[7:] if auth_header.startswith("Bearer ") else ""
    user_plan = check_and_increment_quota(token) if token else "free"

    try:
        min_start = (pd.Timestamp(req.end) - pd.Timedelta(days=130)).strftime("%Y-%m-%d")
        effective_start = min(req.start, min_start)

        data, ohlcv, meta = fetch_stock(ticker, effective_start, req.end)

        if len(data) < _MIN_HIST + 10:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient data for '{ticker}'. Try a wider date range."
            )

        prices  = data["y"].values.astype(np.float64)
        dates   = data["ds"]
        volumes = ohlcv["volume"].values.astype(np.float64)

        # ── Timer só envolve a inferência do modelo ────────────────────────────
        with forecast_latency.labels(ticker=ticker).time():
            X, y_true = _make_features(prices, volumes)
            train_start = len(prices) - len(X)

            def _make_gbm() -> GradientBoostingRegressor:
                return GradientBoostingRegressor(
                    n_estimators=300,
                    learning_rate=0.05,
                    max_depth=4,
                    subsample=0.8,
                    min_samples_leaf=5,
                    random_state=42,
                )

            val_size   = max(20, int(0.2 * len(X)))
            X_train, X_val = X[:-val_size], X[-val_size:]
            y_train, y_val = y_true[:-val_size], y_true[-val_size:]

            model_val = _make_gbm()
            model_val.fit(X_train, y_train)

            val_pred_returns = model_val.predict(X_val)

            val_start_idx     = train_start + (len(X) - val_size)
            val_prices_actual = prices[val_start_idx : val_start_idx + val_size]
            val_prices_base   = prices[val_start_idx - 1 : val_start_idx - 1 + val_size]
            val_prices_pred   = val_prices_base * np.exp(val_pred_returns)

            r2   = float(r2_score(val_prices_actual, val_prices_pred))
            mae  = float(mean_absolute_error(val_prices_actual, val_prices_pred))
            mape = float(mean_absolute_percentage_error(val_prices_actual, val_prices_pred) * 100)

            log_errors   = np.log(np.maximum(val_prices_pred, 1e-8) / np.maximum(val_prices_actual, 1e-8))
            pred_err_vol = float(np.std(log_errors)) if len(log_errors) >= 5 else float(np.std(y_true))
            realized_vol = float(np.std(y_true[-min(252, len(y_true)):]))
            daily_vol    = max(pred_err_vol, realized_vol)

            return_bias = float(np.mean(val_pred_returns - y_val))

            _ens_models = []
            for _seed in [42, 7, 13]:
                _m = GradientBoostingRegressor(
                    n_estimators=100, learning_rate=0.05, max_depth=4,
                    subsample=0.8, min_samples_leaf=5, random_state=_seed,
                )
                _m.fit(X, y_true)
                _ens_models.append(_m)
            model = EnsembleModel(_ens_models)

            hist_pred_returns = model.predict(X)
            hist_prices_base  = prices[train_start - 1 : train_start - 1 + len(X)]
            hist_pred_aligned = hist_prices_base * np.exp(hist_pred_returns)

            last_price = float(prices[-1])

            last_date    = pd.Timestamp(dates.iloc[-1])
            future_dates = pd.bdate_range(
                start=last_date + pd.Timedelta(days=1),
                periods=req.forecast_days,
            )

            def _make_direct_gbm() -> GradientBoostingRegressor:
                return GradientBoostingRegressor(
                    n_estimators=200,
                    learning_rate=0.05,
                    max_depth=4,
                    subsample=0.8,
                    min_samples_leaf=5,
                    random_state=42,
                )

            used_direct = False
            if user_plan in ("pro", "premium"):
                direct_models: dict = {}
                for h in _DIRECT_HORIZONS:
                    if h > req.forecast_days:
                        continue
                    X_h, y_h = _make_features_direct(prices, volumes, h)
                    if X_h is not None:
                        m_h = _make_direct_gbm()
                        m_h.fit(X_h, y_h)
                        direct_models[h] = m_h

                if direct_models:
                    future_values = _direct_forecast(prices, volumes, req.forecast_days, direct_models)
                    used_direct = True
                else:
                    future_values = _recursive_forecast(model, prices, volumes, req.forecast_days, return_bias)
            else:
                future_values = _recursive_forecast(model, prices, volumes, req.forecast_days, return_bias)

            end_price = future_values[-1]

            conf_low  = [
                max(v * np.exp(-1.96 * daily_vol * np.sqrt(t + 1)), 0.01)
                for t, v in enumerate(future_values)
            ]
            conf_high = [
                float(v * np.exp(1.96 * daily_vol * np.sqrt(t + 1)))
                for t, v in enumerate(future_values)
            ]

            hist_pred_full = [None] * train_start + [round(float(v), 4) for v in hist_pred_aligned]

        # ── Fora do with — métricas registadas após o timer ───────────────────
        forecast_requests_total.labels(
            ticker=ticker,
            plan=user_plan,
            model_type="direct" if used_direct else "recursive"
        ).inc()

        model_mae.labels(ticker=ticker).set(mae)
        model_mape.labels(ticker=ticker).set(mape)
        model_r2.labels(ticker=ticker).set(r2)

        logger.info(
            "forecast_completed",
            ticker=ticker,
            plan=user_plan,
            model_type="direct" if used_direct else "recursive",
            mae=round(mae, 4),
            mape=round(mape, 4),
            r2=round(r2, 4),
            forecast_days=req.forecast_days,
        )

        return {
            "meta": meta,
            "ticker": ticker,
            "last_price": last_price,
            "model_type": "direct" if used_direct else "recursive",
            "metrics": {"r2": round(r2, 4), "mae": round(mae, 4), "mape": round(mape, 4)},
            "forecast_end_price": round(end_price, 2),
            "real": {
                "dates":  dates.dt.strftime("%Y-%m-%d").tolist(),
                "values": [round(float(v), 4) for v in prices],
            },
            "historic_pred": {
                "dates":  dates.dt.strftime("%Y-%m-%d").tolist(),
                "values": hist_pred_full,
            },
            "future_pred": {
                "dates":    [d.strftime("%Y-%m-%d") for d in future_dates],
                "values":   [round(float(v), 4) for v in future_values],
                "conf_low": [round(float(v), 4) for v in conf_low],
                "conf_high":[round(float(v), 4) for v in conf_high],
            },
            "ohlcv": {
                "dates":  ohlcv["ds"].dt.strftime("%Y-%m-%d").tolist(),
                "open":   ohlcv["open"].round(4).tolist(),
                "high":   ohlcv["high"].round(4).tolist(),
                "low":    ohlcv["low"].round(4).tolist(),
                "close":  ohlcv["close"].round(4).tolist(),
                "volume": ohlcv["volume"].tolist(),
            },
        }

    except HTTPException:
        raise
    except Exception as exc:
        tb = traceback.format_exc()
        logger.error("forecast_failed", ticker=ticker, error=str(exc))
        print(tb)
        raise HTTPException(status_code=500, detail=f"{type(exc).__name__}: {exc}")


@app.get("/indicators/{ticker}")
@limiter.limit("60/minute")
def indicators(request: Request, ticker: str, period: str = "1y"):
    try:
        hist = _cached_ticker_history(ticker.upper(), period)
        if hist.empty:
            raise HTTPException(status_code=404, detail=f"No data for '{ticker}'.")

        close = hist["Close"].copy()

        delta = close.diff()
        gain = delta.clip(lower=0).rolling(14).mean()
        loss = (-delta.clip(upper=0)).rolling(14).mean()
        rs = gain / loss
        rsi = (100 - 100 / (1 + rs)).round(2)

        ema12 = close.ewm(span=12, adjust=False).mean()
        ema26 = close.ewm(span=26, adjust=False).mean()
        macd_line = (ema12 - ema26).round(4)
        signal_line = macd_line.ewm(span=9, adjust=False).mean().round(4)
        histogram = (macd_line - signal_line).round(4)

        sma20 = close.rolling(20).mean()
        std20 = close.rolling(20).std()
        bb_upper = (sma20 + 2 * std20).round(4)
        bb_lower = (sma20 - 2 * std20).round(4)
        bb_mid   = sma20.round(4)

        dates = hist.index.tz_localize(None).strftime("%Y-%m-%d").tolist()

        def clean(series):
            return [None if pd.isna(v) else v for v in series.tolist()]

        return {
            "ticker": ticker.upper(),
            "dates": dates,
            "close": [round(v, 4) for v in close.tolist()],
            "rsi": clean(rsi),
            "macd": clean(macd_line),
            "macd_signal": clean(signal_line),
            "macd_hist": clean(histogram),
            "bb_upper": clean(bb_upper),
            "bb_mid": clean(bb_mid),
            "bb_lower": clean(bb_lower),
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/create-checkout-session")
def create_checkout_session(req: CheckoutRequest):
    price_id = PRICE_IDS.get(req.plan)
    if not price_id:
        raise HTTPException(status_code=400, detail="Plano inválido.")
    if not stripe.api_key:
        raise HTTPException(status_code=500, detail="Stripe não configurado.")

    try:
        session = stripe.checkout.Session.create(
            line_items=[{"price": price_id, "quantity": 1}],
            mode="subscription",
            success_url=f"{FRONTEND_URL}/pricing?success=true&session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{FRONTEND_URL}/pricing?cancelled=true",
            client_reference_id=req.user_id,
            metadata={"plan": req.plan, "user_id": req.user_id},
        )
        return {"url": session.url}
    except stripe.StripeError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/verify-checkout")
def verify_checkout(session_id: str):
    if not stripe.api_key:
        raise HTTPException(status_code=500, detail="Stripe não configurado.")
    try:
        session = stripe.checkout.Session.retrieve(session_id)
        if session.status != "complete":
            raise HTTPException(status_code=400, detail="Pagamento não concluído.")
        plan = session.metadata.get("plan")
        user_id = session.metadata.get("user_id")
        return {"plan": plan, "user_id": user_id}
    except stripe.StripeError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")

    if not STRIPE_WEBHOOK_SECRET:
        raise HTTPException(status_code=500, detail="Webhook secret not configured.")

    try:
        event = stripe.Webhook.construct_event(payload, sig, STRIPE_WEBHOOK_SECRET)
    except stripe.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature.")

    event_id   = event["id"]
    event_type = event["type"]

    if not (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY):
        raise HTTPException(status_code=500, detail="Supabase not configured.")

    from supabase import create_client
    sb = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    existing = sb.table("webhook_events").select("event_id").eq("event_id", event_id).eq("status", "processed").execute()
    if existing.data:
        return {"received": True, "duplicate": True}

    if event_type == "checkout.session.completed":
        session = event["data"]["object"]
        user_id = session.get("metadata", {}).get("user_id")
        plan    = session.get("metadata", {}).get("plan")

        if user_id and plan:
            try:
                sb.auth.admin.update_user_by_id(user_id, {"user_metadata": {"plan": plan}})
                sb.table("webhook_events").insert({
                    "event_id": event_id, "event_type": event_type,
                    "user_id": user_id, "plan": plan, "status": "processed"
                }).execute()
            except Exception as e:
                sb.table("webhook_events").insert({
                    "event_id": event_id, "event_type": event_type,
                    "user_id": user_id, "plan": plan,
                    "status": "failed", "error": str(e)
                }).execute()
                raise HTTPException(status_code=500, detail="Failed to update user plan.")

    return {"received": True}
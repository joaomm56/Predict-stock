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

# ── yfinance cache ─────────────────────────────────────────────────────────────
_info_lock  = threading.Lock()
_hist_lock  = threading.Lock()
_stock_lock = threading.Lock()

_info_cache  = TTLCache(maxsize=256, ttl=300)   # 5 min — ticker metadata + price
_hist_cache  = TTLCache(maxsize=128, ttl=600)   # 10 min — period history
_stock_cache = TTLCache(maxsize=64,  ttl=300)   # 5 min — forecast raw data


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
    allow_origins=[FRONTEND_URL, "http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    print(traceback.format_exc())  # logs only on server
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error."},
        headers={"Access-Control-Allow-Origin": FRONTEND_URL},
    )


# ── Quota enforcement ─────────────────────────────────────────────────────────
FREE_FORECASTS_PER_DAY = 5


def check_and_increment_quota(token: str) -> str:
    """Validates user JWT, enforces daily quota for free-plan users, and returns the plan.

    Raises HTTPException 429 if the free daily limit is reached.
    Returns 'free' if Supabase is unavailable (fails open — rate limiting covers abuse).
    """
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
            return plan  # paid plans have no daily limit

        today = datetime.utcnow().strftime("%Y-%m-%d")
        quota_date = meta.get("quota_date", "")
        quota_count = int(meta.get("quota_count", 0)) if quota_date == today else 0

        if quota_count >= FREE_FORECASTS_PER_DAY:
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
        print(f"Quota check error: {e}")  # fail open
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
_MIN_HIST = max(_LAGS + _WINDOWS)  # 60 — minimum history needed


def _build_row(prices: np.ndarray, i: int, use_vol: bool, volumes: np.ndarray) -> list:
    """Build one feature row at position i (i >= _MIN_HIST).

    All price-based features are NORMALISED relative to prices[i-1] so the
    model learns patterns in relative terms (scale-invariant).  This means a
    model trained while the stock was at $100 generalises correctly when the
    stock is at $200 — something raw-price features cannot achieve.
    """
    row = []
    cur = prices[i - 1]  # most recent known close

    # Normalised lag prices  (relative distance from current price)
    for lag in _LAGS:
        row.append(prices[i - lag] / cur - 1.0 if cur > 0 else 0.0)

    # Log momentum (unchanged — already relative)
    for lag in [1, 5, 10, 20]:
        prev = prices[i - lag - 1] if (i - lag - 1) >= 0 else prices[0]
        row.append(np.log(prices[i - 1] / prev) if prev > 0 else 0.0)

    # Rolling mean (normalised)
    for w in _WINDOWS:
        mean_w = float(np.mean(prices[i - w : i]))
        row.append(mean_w / cur - 1.0 if cur > 0 else 0.0)

    # Rolling volatility (normalised — coefficient of variation)
    for w in [5, 20, 50]:
        row.append(float(np.std(prices[max(0, i - w) : i])) / cur if cur > 0 else 0.0)

    # Momentum / % change (unchanged — already relative)
    for p in [5, 10, 20, 30]:
        base = prices[i - p - 1] if (i - p - 1) >= 0 else prices[0]
        row.append(prices[i - 1] / base - 1.0 if base > 0 else 0.0)

    # Volume features (normalised relative to 20-day average)
    if use_vol:
        mean_20v = float(np.mean(volumes[max(0, i - 20) : i]))
        mean_5v  = float(np.mean(volumes[max(0, i - 5)  : i]))
        row.append(volumes[i - 1] / mean_20v - 1.0 if mean_20v > 0 else 0.0)
        row.append(mean_5v / mean_20v - 1.0          if mean_20v > 0 else 0.0)

    return row


def _make_features(prices: np.ndarray, volumes: np.ndarray):
    """Create (X, y).

    Target y is the **log-return** for each day (more stationary than raw price).
    Predicting log-returns forces the model to learn how much the price *moves*
    rather than what the price *is*, which generalises far better out-of-sample.
    """
    use_vol = len(volumes) == len(prices)
    rows = [_build_row(prices, i, use_vol, volumes) for i in range(_MIN_HIST, len(prices))]
    base = np.maximum(prices[_MIN_HIST - 1 : -1], 1e-8)
    log_returns = np.log(np.maximum(prices[_MIN_HIST:], 1e-8) / base)
    return np.array(rows, dtype=np.float64), log_returns.astype(np.float64)


def _recursive_forecast(model: GradientBoostingRegressor,
                         prices: np.ndarray, volumes: np.ndarray,
                         forecast_days: int,
                         return_bias: float = 0.0) -> list[float]:
    """Recursively predict future prices using log-return predictions.

    Two safeguards prevent runaway (exponentially exploding) forecasts:

    1. Bias correction  — subtracts the model's mean in-sample error so
       systematic over-optimism / over-pessimism doesn't compound over hundreds
       of steps.

    2. Daily return cap — clamps each predicted log-return to ±5 % per day.
       Real stocks almost never move more than that on a single session, so
       anything outside this range is a model artefact, not a valid signal.
    """
    _MAX_DAILY_LOG_RET = np.log(1.05)   # ±5 % per day hard cap

    use_vol = len(volumes) == len(prices)
    buf     = list(prices[-_MIN_HIST:])
    vbuf    = list(volumes[-_MIN_HIST:]) if use_vol else []

    raw_preds = []
    vol_arr   = np.array([])
    for _ in range(forecast_days):
        b = np.array(buf)
        if use_vol:
            vol_arr = np.array(vbuf)
        row     = _build_row(b, len(b), use_vol, vol_arr)
        log_ret = float(model.predict(np.array([row]))[0])

        # 1. Remove systematic bias
        log_ret -= return_bias
        # 2. Hard cap — no single-day move beyond ±5 %
        log_ret  = float(np.clip(log_ret, -_MAX_DAILY_LOG_RET, _MAX_DAILY_LOG_RET))

        # Convert predicted log-return back to price
        next_price = max(buf[-1] * np.exp(log_ret), 0.01)
        raw_preds.append(next_price)

        buf.append(next_price)
        buf = buf[1:]
        if use_vol:
            vbuf.append(vbuf[-1])
            vbuf = vbuf[1:]

    return raw_preds


# ── Direct multi-step helpers (pro / premium) ─────────────────────────────────
# Horizons (in trading days) for which we train a dedicated model.
_DIRECT_HORIZONS = [5, 10, 20, 30, 60, 90, 180, 365, 730]


def _make_features_direct(prices: np.ndarray, volumes: np.ndarray, horizon: int):
    """Feature matrix with the *h-step-ahead* cumulative log-return as target.

    Instead of predicting tomorrow's log-return (which compounds error over
    hundreds of recursive steps), each model directly predicts the total
    log-return from the current price to `horizon` days ahead.  Separate models
    per horizon avoid the error accumulation that plagues recursive approaches.
    """
    use_vol = len(volumes) == len(prices)
    n_rows = len(prices) - _MIN_HIST - horizon + 1
    if n_rows < 20:
        return None, None
    rows = [_build_row(prices, i, use_vol, volumes) for i in range(_MIN_HIST, _MIN_HIST + n_rows)]
    base   = np.maximum(prices[_MIN_HIST - 1 : _MIN_HIST - 1 + n_rows], 1e-8)
    future = np.maximum(prices[_MIN_HIST - 1 + horizon : _MIN_HIST - 1 + horizon + n_rows], 1e-8)
    log_returns_h = np.log(future / base)
    return np.array(rows, dtype=np.float64), log_returns_h.astype(np.float64)


def _direct_forecast(prices: np.ndarray, volumes: np.ndarray,
                     forecast_days: int,
                     model_map: dict) -> list:
    """Produce a `forecast_days`-long price series from direct h-step models.

    Each anchor horizon gives an independent (low-bias) estimate of the future
    price.  Intermediate days are filled by linearly interpolating between
    adjacent anchors in log-return space — preserving monotonicity and avoiding
    the compounding error of recursive chaining.
    """
    use_vol = len(volumes) == len(prices)
    vol_arr = volumes if use_vol else np.array([])
    row = _build_row(prices, len(prices), use_vol, vol_arr)
    last_price = float(prices[-1])

    # --- Predict anchors -------------------------------------------------------
    anchor_log_rets: dict[int, float] = {}
    for h, m in sorted(model_map.items()):
        lr = float(m.predict([row])[0])
        # Cap implied daily move to ±5 % (same safeguard as recursive model)
        cap = np.log(1.05) * h
        anchor_log_rets[h] = float(np.clip(lr, -cap, cap))

    anchor_list = sorted(anchor_log_rets.keys())

    # --- Interpolate / extrapolate for every day t (1-indexed) ----------------
    result: list[float] = []
    for t in range(1, forecast_days + 1):
        if t in anchor_log_rets:
            log_ret = anchor_log_rets[t]
        elif t < anchor_list[0]:
            # Before the first anchor — scale proportionally from 0
            h0 = anchor_list[0]
            log_ret = anchor_log_rets[h0] * t / h0
        elif t > anchor_list[-1]:
            # Beyond last anchor — extrapolate at the last anchor's daily rate
            h_last = anchor_list[-1]
            daily_rate = anchor_log_rets[h_last] / h_last
            raw = anchor_log_rets[h_last] + daily_rate * (t - h_last)
            cap = np.log(1.05) * t
            log_ret = float(np.clip(raw, -cap, cap))
        else:
            # Linear interpolation between the two surrounding anchors
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
    """Quick ticker info without running the model."""
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
    """Closing price history for a ticker. Granularity auto-selected by period."""
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
        else:  # 5y, 10y, ytd, max
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
        # Always fetch at least 130 calendar days so GBM has enough lag history.
        # The frontend trims chart display to the user's plan limit — training data
        # can be wider without exposing extra data visually.
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

        # 1. Build feature matrix (normalised features, log-return targets)
        X, y_true = _make_features(prices, volumes)

        def _make_gbm() -> GradientBoostingRegressor:
            return GradientBoostingRegressor(
                n_estimators=300,
                learning_rate=0.05,
                max_depth=4,
                subsample=0.8,
                min_samples_leaf=5,
                random_state=42,
            )

        # 2. Out-of-sample metrics via a proper train / validation split.
        #    We evaluate on the HELD-OUT last 20 % of rows so the reported
        #    numbers reflect genuine future-prediction performance, not overfitting.
        val_size   = max(20, int(0.2 * len(X)))
        X_train, X_val = X[:-val_size], X[-val_size:]
        y_train, y_val = y_true[:-val_size], y_true[-val_size:]

        model_val = _make_gbm()
        model_val.fit(X_train, y_train)

        val_pred_returns = model_val.predict(X_val)

        # Convert log-return predictions → price predictions for human-readable metrics
        val_start_idx      = _MIN_HIST + (len(X) - val_size)
        val_prices_actual  = prices[val_start_idx:]
        val_prices_base    = prices[val_start_idx - 1 : -1]
        val_prices_pred    = val_prices_base * np.exp(val_pred_returns)

        r2   = float(r2_score(val_prices_actual, val_prices_pred))
        mae  = float(mean_absolute_error(val_prices_actual, val_prices_pred))
        mape = float(mean_absolute_percentage_error(val_prices_actual, val_prices_pred) * 100)

        # Daily prediction-error volatility — drives the confidence-interval width
        log_errors = np.log(np.maximum(val_prices_pred, 1e-8) / np.maximum(val_prices_actual, 1e-8))
        daily_vol  = float(np.std(log_errors)) if len(log_errors) >= 5 else float(np.std(y_true))

        # 3. Final model trained on ALL data for the actual forecast
        model = _make_gbm()
        model.fit(X, y_true)

        # 4. In-sample price predictions (for the historical overlay on the chart)
        hist_pred_returns  = model.predict(X)
        hist_prices_base   = prices[_MIN_HIST - 1 : -1]
        hist_pred_aligned  = hist_prices_base * np.exp(hist_pred_returns)

        last_price = float(prices[-1])

        # 5. Future dates (business days) and recursive forecast
        last_date    = pd.Timestamp(dates.iloc[-1])
        future_dates = pd.bdate_range(
            start=last_date + pd.Timedelta(days=1),
            periods=req.forecast_days,
        )
        # Bias = mean in-sample prediction error in log-return space.
        # Subtracting it stops systematic over/under-shooting from compounding
        # over hundreds of recursive steps (e.g. TRMD-style explosions).
        return_bias = float(np.mean(hist_pred_returns - y_true))

        # 5b. For paid plans: train direct h-step models per anchor horizon.
        #     Each model predicts the total log-return from today to day h,
        #     eliminating recursive error accumulation for long-horizon forecasts.
        def _make_direct_gbm() -> GradientBoostingRegressor:
            return GradientBoostingRegressor(
                n_estimators=200,       # fewer than main model — speed trade-off
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
                # Fallback to recursive if not enough data for any horizon
                future_values = _recursive_forecast(model, prices, volumes, req.forecast_days, return_bias)
        else:
            future_values = _recursive_forecast(model, prices, volumes, req.forecast_days, return_bias)

        end_price = future_values[-1]

        # 6. Confidence intervals: uncertainty grows as ±1.96·σ·√t (random-walk scaling).
        #    This produces the realistic "cone of uncertainty" — narrow near the start,
        #    widening as the horizon extends.
        conf_low  = [
            max(v * np.exp(-1.96 * daily_vol * np.sqrt(t + 1)), 0.01)
            for t, v in enumerate(future_values)
        ]
        conf_high = [
            float(v * np.exp(1.96 * daily_vol * np.sqrt(t + 1)))
            for t, v in enumerate(future_values)
        ]

        # 7. Full historic_pred — first _MIN_HIST entries have no prediction → None
        hist_pred_full = [None] * _MIN_HIST + [round(float(v), 4) for v in hist_pred_aligned]

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
        print(tb)
        raise HTTPException(status_code=500, detail=f"{type(exc).__name__}: {exc}")


@app.get("/indicators/{ticker}")
@limiter.limit("60/minute")
def indicators(request: Request, ticker: str, period: str = "1y"):
    """RSI, MACD and Bollinger Bands for a ticker."""
    try:
        hist = _cached_ticker_history(ticker.upper(), period)
        if hist.empty:
            raise HTTPException(status_code=404, detail=f"No data for '{ticker}'.")

        close = hist["Close"].copy()

        # RSI (14)
        delta = close.diff()
        gain = delta.clip(lower=0).rolling(14).mean()
        loss = (-delta.clip(upper=0)).rolling(14).mean()
        rs = gain / loss
        rsi = (100 - 100 / (1 + rs)).round(2)

        # MACD (12, 26, 9)
        ema12 = close.ewm(span=12, adjust=False).mean()
        ema26 = close.ewm(span=26, adjust=False).mean()
        macd_line = (ema12 - ema26).round(4)
        signal_line = macd_line.ewm(span=9, adjust=False).mean().round(4)
        histogram = (macd_line - signal_line).round(4)

        # Bollinger Bands (20, 2)
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

    # Idempotência — ignora eventos já processados
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

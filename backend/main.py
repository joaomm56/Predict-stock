import warnings
warnings.simplefilter(action="ignore", category=FutureWarning)
import matplotlib
matplotlib.use("Agg")
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import traceback
import os
from dotenv import load_dotenv
load_dotenv()
import stripe
import numpy as np
import pandas as pd
import yfinance as yf
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.metrics import r2_score, mean_absolute_error, mean_absolute_percentage_error

stripe.api_key = os.getenv("STRIPE_SECRET_KEY", "").strip()
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "").strip()

SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip()
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173").strip()

PRICE_IDS = {
    "pro":     "price_1T8rsURNJEKtZi6YDft6rnbu",
    "premium": "price_1T8rsrRNJEKtZi6YYKE6RHVj",
}

app = FastAPI(title="Stock Forecast API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL, "http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    tb = traceback.format_exc()
    print(tb)
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc), "traceback": tb},
        headers={"Access-Control-Allow-Origin": FRONTEND_URL},
    )


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
    """Build one feature row at position i (i >= _MIN_HIST)."""
    row = []
    # Lag prices
    for lag in _LAGS:
        row.append(prices[i - lag])
    # Log momentum
    for lag in [1, 5, 10, 20]:
        prev = prices[i - lag - 1] if (i - lag - 1) >= 0 else prices[0]
        row.append(np.log(prices[i - 1] / prev) if prev > 0 else 0.0)
    # Rolling mean
    for w in _WINDOWS:
        row.append(float(np.mean(prices[i - w : i])))
    # Rolling volatility
    for w in [5, 20, 50]:
        row.append(float(np.std(prices[max(0, i - w) : i])))
    # Momentum (% change)
    for p in [5, 10, 20, 30]:
        base = prices[i - p - 1] if (i - p - 1) >= 0 else prices[0]
        row.append(prices[i - 1] / base - 1.0 if base > 0 else 0.0)
    # Volume features
    if use_vol:
        row.append(float(volumes[i - 1]))
        row.append(float(np.mean(volumes[max(0, i - 20) : i])))
    return row


def _make_features(prices: np.ndarray, volumes: np.ndarray):
    """Create (X, y) from the price/volume arrays. y = prices[_MIN_HIST:]."""
    use_vol = len(volumes) == len(prices)
    rows = [_build_row(prices, i, use_vol, volumes) for i in range(_MIN_HIST, len(prices))]
    return np.array(rows, dtype=np.float64), prices[_MIN_HIST:].astype(np.float64)


def _recursive_forecast(model: GradientBoostingRegressor,
                         prices: np.ndarray, volumes: np.ndarray,
                         forecast_days: int) -> list[float]:
    """Recursively predict future prices, blending GBM (short-term) with a
    log-linear trend extrapolation (long-term) so predictions don't mean-revert
    on long horizons.

    Blend weight for GBM decays as exp(-t / tau):
      t=0  → 100% GBM   (pure momentum/pattern model)
      t=45 →  37% GBM   (equal weight around ~6 weeks)
      t=90 →  14% GBM   (trend takes over ~3 months out)
    """
    use_vol = len(volumes) == len(prices)
    buf     = list(prices[-_MIN_HIST:])
    vbuf    = list(volumes[-20:]) if use_vol else []

    # Fit log-linear trend on last 90 days of actual prices for long-horizon anchor
    lookback = min(90, len(prices))
    recent   = np.log(prices[-lookback:])
    x_fit    = np.arange(lookback, dtype=np.float64)
    slope, _ = np.polyfit(x_fit, recent, 1)   # daily log-return drift (intercept unused)
    last_log  = np.log(max(prices[-1], 1e-6))
    tau = 45.0  # e-folding time in days — tune higher to trust GBM longer

    raw_preds   = []
    vol_arr     = np.array([])
    for t in range(forecast_days):
        b = np.array(buf)
        if use_vol:
            vol_arr = np.array(vbuf)
        row  = _build_row(b, len(b), use_vol, vol_arr)
        gbm  = max(float(model.predict(np.array([row]))[0]), 0.01)

        # Trend anchor: exponential extrapolation from last real price
        trend = float(np.exp(last_log + slope * (t + 1)))
        trend = max(trend, 0.01)

        # Smooth blend: GBM weight decays, trend weight grows
        alpha = float(np.exp(-t / tau))
        pred  = alpha * gbm + (1.0 - alpha) * trend

        raw_preds.append(max(pred, 0.01))
        buf.append(gbm)   # feed raw GBM into the next step's feature window
        buf = buf[1:]
        if use_vol:
            vbuf.append(vbuf[-1])
            vbuf = vbuf[1:]

    return raw_preds


# ── Stock data helper ──────────────────────────────────────────────────────────
def fetch_stock(ticker: str, start: str, end: str):
    tk   = yf.Ticker(ticker)
    info = tk.info
    hist = tk.history(start=start, end=end)

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
def stock_info(ticker: str):
    """Quick ticker info without running the model."""
    try:
        tk   = yf.Ticker(ticker.upper())
        info = tk.info
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
def history(ticker: str, period: str = "1y"):
    """Closing price history for a ticker. Granularity auto-selected by period."""
    try:
        tk = yf.Ticker(ticker.upper())
        hist = tk.history(period=period)
        if hist.empty:
            raise HTTPException(status_code=404, detail=f"No data for '{ticker}'.")
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
def forecast(req: ForecastRequest):
    ticker = req.ticker.upper()

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

        # 1. Build feature matrix
        X, y_true = _make_features(prices, volumes)

        # 2. Train Gradient Boosting model
        model = GradientBoostingRegressor(
            n_estimators=300,
            learning_rate=0.05,
            max_depth=4,
            subsample=0.8,
            min_samples_leaf=5,
            random_state=42,
        )
        model.fit(X, y_true)

        # 3. In-sample predictions
        hist_pred_aligned = model.predict(X)

        # 4. Metrics (1-step-ahead in-sample)
        r2   = float(r2_score(y_true, hist_pred_aligned))
        mae  = float(mean_absolute_error(y_true, hist_pred_aligned))
        mape = float(mean_absolute_percentage_error(y_true, hist_pred_aligned) * 100)

        last_price = float(prices[-1])

        # 5. Future dates (business days) and recursive forecast
        last_date    = pd.Timestamp(dates.iloc[-1])
        future_dates = pd.bdate_range(
            start=last_date + pd.Timedelta(days=1),
            periods=req.forecast_days,
        )
        future_values = _recursive_forecast(model, prices, volumes, req.forecast_days)
        end_price     = future_values[-1]

        # 6. Full historic_pred — first _MIN_HIST entries have no prediction → None
        hist_pred_full = [None] * _MIN_HIST + [round(float(v), 4) for v in hist_pred_aligned]

        return {
            "meta": meta,
            "ticker": ticker,
            "last_price": last_price,
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
                "dates":  [d.strftime("%Y-%m-%d") for d in future_dates],
                "values": [round(float(v), 4) for v in future_values],
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
def indicators(ticker: str, period: str = "1y"):
    """RSI, MACD and Bollinger Bands for a ticker."""
    try:
        tk = yf.Ticker(ticker.upper())
        hist = tk.history(period=period)
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

    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        user_id = session.get("metadata", {}).get("user_id")
        plan = session.get("metadata", {}).get("plan")

        if user_id and plan and SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY:
            from supabase import create_client
            sb = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
            sb.auth.admin.update_user_by_id(user_id, {"user_metadata": {"plan": plan}})

    return {"received": True}

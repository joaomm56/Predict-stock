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
import pandas as pd
import yfinance as yf
from prophet import Prophet
from sklearn.metrics import r2_score, mean_absolute_error, mean_absolute_percentage_error

stripe.api_key = os.getenv("STRIPE_SECRET_KEY", "").strip()

PRICE_IDS = {
    "pro":     "price_1T8rsURNJEKtZi6YDft6rnbu",
    "premium": "price_1T8rsrRNJEKtZi6YYKE6RHVj",
}

app = FastAPI(title="Stock Forecast API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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
        headers={"Access-Control-Allow-Origin": "*"},
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


# ── Helpers ───────────────────────────────────────────────────────────────────
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
        # 1. Fetch data
        data, ohlcv, meta = fetch_stock(ticker, req.start, req.end)

        if len(data) < 30:
            raise HTTPException(status_code=400, detail="Dados insuficientes. Escolhe um intervalo maior.")

        # 2. Train Prophet model
        model = Prophet(
            daily_seasonality=False,
            weekly_seasonality=True,
            yearly_seasonality=True,
            changepoint_prior_scale=0.1,
        )
        model.fit(data)

        # 3. Historical predictions (for chart overlay and metrics)
        hist_forecast = model.predict(data[["ds"]])

        # 4. Future forecast
        future_df = model.make_future_dataframe(periods=req.forecast_days, freq="B")
        full_forecast = model.predict(future_df)
        future_only = full_forecast[full_forecast["ds"] > data["ds"].max()].head(req.forecast_days).reset_index(drop=True)

        # 5. Metrics
        y_true = data["y"].values
        y_pred = hist_forecast["yhat"].values

        r2   = float(r2_score(y_true, y_pred))
        mae  = float(mean_absolute_error(y_true, y_pred))
        mape = float(mean_absolute_percentage_error(y_true, y_pred) * 100)

        last_price = float(data["y"].iloc[-1])
        end_price  = float(future_only["yhat"].iloc[-1])

        def to_series(df, date_col, val_col):
            return {
                "dates":  df[date_col].dt.strftime("%Y-%m-%d").tolist(),
                "values": df[val_col].round(4).tolist(),
            }

        return {
            "meta": meta,
            "ticker": ticker,
            "last_price": last_price,
            "metrics": {"r2": round(r2, 4), "mae": round(mae, 4), "mape": round(mape, 4)},
            "forecast_end_price": round(end_price, 2),
            "real":          to_series(data, "ds", "y"),
            "historic_pred": to_series(hist_forecast, "ds", "yhat"),
            "future_pred":   to_series(future_only, "ds", "yhat"),
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


@app.post("/create-checkout-session")
def create_checkout_session(req: CheckoutRequest):
    price_id = PRICE_IDS.get(req.plan)
    if not price_id:
        raise HTTPException(status_code=400, detail="Plano inválido.")
    if not stripe.api_key:
        raise HTTPException(status_code=500, detail="Stripe não configurado.")

    origin = os.getenv("FRONTEND_URL", "http://localhost:5173")
    try:
        session = stripe.checkout.Session.create(
            line_items=[{"price": price_id, "quantity": 1}],
            mode="subscription",
            success_url=f"{origin}/pricing?success=true&session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{origin}/pricing?cancelled=true",
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

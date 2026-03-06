import warnings
warnings.simplefilter(action="ignore", category=FutureWarning)

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from datetime import date
import traceback
import pandas as pd
import yfinance as yf
import torch
import torch.serialization
from neuralprophet import NeuralProphet
from sklearn.metrics import r2_score, mean_absolute_error, mean_absolute_percentage_error

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
    print(tb)  # imprime no terminal do uvicorn
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


# ── Helpers ───────────────────────────────────────────────────────────────────
def patch_torch():
    orig = torch.serialization.load
    torch.load = lambda *a, **kw: orig(*a, **kw, weights_only=False)


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


@app.post("/forecast")
def forecast(req: ForecastRequest):
    ticker = req.ticker.upper()

    try:
        # 1. Fetch data
        data, ohlcv, meta = fetch_stock(ticker, req.start, req.end)

        # 2. Train model
        patch_torch()
        model = NeuralProphet()
        model.fit(data, freq="B")

        # 3. Forecast
        future_df = model.make_future_dataframe(data, periods=req.forecast_days)
        ff = model.predict(future_df)
        fh = model.predict(data)

        # 4. Separate future-only rows
        future_only = ff.tail(req.forecast_days).copy().reset_index(drop=True)

        # 5. Metrics
        y_true = fh["y"].dropna()
        y_pred = fh["yhat1"][y_true.index]

        r2   = float(r2_score(y_true, y_pred))
        mae  = float(mean_absolute_error(y_true, y_pred))
        mape = float(mean_absolute_percentage_error(y_true, y_pred) * 100)

        last_price = float(data["y"].iloc[-1])
        end_price  = float(future_only["yhat1"].iloc[-1])

        def to_series(df, col):
            return {
                "dates":  df["ds"].dt.strftime("%Y-%m-%d").tolist(),
                "values": df[col].round(4).tolist(),
            }

        return {
            "meta": meta,
            "ticker": ticker,
            "last_price": last_price,
            "metrics": {"r2": round(r2, 4), "mae": round(mae, 4), "mape": round(mape, 4)},
            "forecast_end_price": round(end_price, 2),
            "real":           to_series(data, "y"),
            "historic_pred":  to_series(fh,   "yhat1"),
            "future_pred":    to_series(future_only, "yhat1"),
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
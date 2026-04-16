from prometheus_fastapi_instrumentator import Instrumentator
from prometheus_client import Counter, Gauge, Histogram

# ── Métricas de forecast ───────────────────────────────────────────────────────
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

# ── Métricas de qualidade do modelo ───────────────────────────────────────────
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

# ── Métricas de quota e cache ─────────────────────────────────────────────────
quota_hits_total = Counter(
    "predict_stock_quota_exceeded_total",
    "Total de vezes que o limite diário foi atingido"
)

cache_hits_total = Counter(
    "predict_stock_cache_hits_total",
    "Cache hits no yfinance",
    ["cache_type"]
)


def setup_metrics(app):
    """Liga o Instrumentator ao app FastAPI e expõe o endpoint /metrics."""
    Instrumentator().instrument(app).expose(app)
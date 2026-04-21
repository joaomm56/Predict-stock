import os
from urllib.parse import unquote
from prometheus_fastapi_instrumentator import Instrumentator
from prometheus_client import Counter, Gauge, Histogram

# ── OTEL Metrics Push ──────────────────────────────────────────────────────────
from opentelemetry import metrics
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader
from opentelemetry.exporter.otlp.proto.http.metric_exporter import OTLPMetricExporter
from opentelemetry.sdk.resources import Resource

# ── Prometheus metrics (pull local /metrics) ───────────────────────────────────
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

# ── OTEL instruments (push para Grafana Cloud + Dynatrace) ────────────────────
_meter = None
_otel_forecast_counter = None
_otel_latency_histogram = None
_otel_quota_counter = None
_otel_cache_counter = None

# Armazena últimos valores de gauges para o ObservableGauge callback
_gauge_store = {}  # chave: (metric_name, ticker) → valor


def _mae_callback(options):
    for (name, ticker), value in _gauge_store.items():
        if name == "mae":
            yield metrics.Observation(value, {"ticker": ticker})


def _mape_callback(options):
    for (name, ticker), value in _gauge_store.items():
        if name == "mape":
            yield metrics.Observation(value, {"ticker": ticker})


def _r2_callback(options):
    for (name, ticker), value in _gauge_store.items():
        if name == "r2":
            yield metrics.Observation(value, {"ticker": ticker})


def _parse_headers(headers_str):
    headers = {}
    if headers_str:
        for part in headers_str.split(","):
            if "=" in part:
                k, v = part.split("=", 1)
                headers[k.strip()] = unquote(v.strip())
    return headers


def setup_metrics(app):
    """Liga Prometheus pull + OTEL push para Grafana Cloud e Dynatrace."""
    global _meter, _otel_forecast_counter, _otel_latency_histogram
    global _otel_quota_counter, _otel_cache_counter

    # Prometheus automático (pull local)
    Instrumentator().instrument(app).expose(app)

    resource = Resource.create({"service.name": "predict-stock-api"})
    readers = []

    # ── Grafana Cloud reader ───────────────────────────────────
    endpoint = os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT", "")
    headers_str = os.getenv("OTEL_EXPORTER_OTLP_HEADERS", "")
    if endpoint and headers_str:
        headers = _parse_headers(headers_str)
        grafana_exporter = OTLPMetricExporter(
            endpoint=f"{endpoint}/v1/metrics",
            headers=headers
        )
        readers.append(PeriodicExportingMetricReader(
            grafana_exporter, export_interval_millis=30000
        ))
        print("[OTEL METRICS] Push configurado para Grafana Cloud")

    # ── Dynatrace reader (independente do Grafana) ─────────────
    dt_endpoint = os.getenv("DT_OTEL_ENDPOINT", "").strip()
    dt_token = os.getenv("DT_OTEL_TOKEN", "").strip()
    if dt_endpoint and dt_token:
        dt_exporter = OTLPMetricExporter(
            endpoint=f"{dt_endpoint}/v1/metrics",
            headers={"Authorization": f"Api-Token {dt_token}"}
        )
        readers.append(PeriodicExportingMetricReader(
            dt_exporter, export_interval_millis=30000
        ))
        print("[OTEL METRICS] Dynatrace configurado")

    if readers:
        provider = MeterProvider(resource=resource, metric_readers=readers)
        metrics.set_meter_provider(provider)
        _meter = metrics.get_meter("predict-stock")

        _otel_forecast_counter = _meter.create_counter(
            "predict_stock.forecast.total",
            description="Total de forecasts realizados"
        )
        _otel_latency_histogram = _meter.create_histogram(
            "predict_stock.forecast.duration",
            unit="s",
            description="Tempo de inferência do modelo"
        )
        _otel_quota_counter = _meter.create_counter(
            "predict_stock.quota_exceeded.total",
            description="Total de vezes que o limite foi atingido"
        )
        _otel_cache_counter = _meter.create_counter(
            "predict_stock.cache_hits.total",
            description="Cache hits no yfinance"
        )
        _meter.create_observable_gauge(
            "predict_stock.model.mae",
            callbacks=[_mae_callback],
            description="Mean Absolute Error do modelo"
        )
        _meter.create_observable_gauge(
            "predict_stock.model.mape",
            callbacks=[_mape_callback],
            description="Mean Absolute Percentage Error do modelo (%)"
        )
        _meter.create_observable_gauge(
            "predict_stock.model.r2",
            callbacks=[_r2_callback],
            description="R² score do modelo"
        )
    else:
        print("[OTEL METRICS] Sem endpoint, apenas Prometheus local")


# ── Helper functions (chamadas pelo código da app) ─────────────────────────────

def record_forecast(ticker, plan, model_type, duration):
    """Regista um forecast nos dois sistemas."""
    forecast_requests_total.labels(
        ticker=ticker, plan=plan, model_type=model_type
    ).inc()
    forecast_latency.labels(ticker=ticker).observe(duration)

    if _otel_forecast_counter:
        _otel_forecast_counter.add(1, {
            "ticker": ticker, "plan": plan, "model_type": model_type
        })
    if _otel_latency_histogram:
        _otel_latency_histogram.record(duration, {"ticker": ticker})


def record_model_quality(ticker, mae, mape, r2):
    """Regista métricas de qualidade do modelo nos dois sistemas."""
    model_mae.labels(ticker=ticker).set(mae)
    model_mape.labels(ticker=ticker).set(mape)
    model_r2.labels(ticker=ticker).set(r2)

    # Guardar para os callbacks OTEL
    _gauge_store[("mae", ticker)] = mae
    _gauge_store[("mape", ticker)] = mape
    _gauge_store[("r2", ticker)] = r2


def record_quota_hit():
    """Regista limite atingido nos dois sistemas."""
    quota_hits_total.inc()
    if _otel_quota_counter:
        _otel_quota_counter.add(1)


def record_cache_hit(cache_type):
    """Regista cache hit nos dois sistemas."""
    cache_hits_total.labels(cache_type=cache_type).inc()
    if _otel_cache_counter:
        _otel_cache_counter.add(1, {"cache_type": cache_type})
import os
from urllib.parse import unquote
from prometheus_fastapi_instrumentator import Instrumentator
from prometheus_client import Counter, Gauge, Histogram

# ── OTEL Metrics Push (para Grafana Cloud) ─────────────────────────────────────
from opentelemetry import metrics
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader
from opentelemetry.exporter.otlp.proto.http.metric_exporter import OTLPMetricExporter
from opentelemetry.sdk.resources import Resource

# ── Prometheus metrics (pull local) ────────────────────────────────────────────
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

# ── OTEL Meter (para push ao Grafana Cloud) ───────────────────────────────────
_meter = None

def get_meter():
    global _meter
    return _meter


def setup_metrics(app):
    """Liga Prometheus pull + OTEL push para Grafana Cloud e Dynatrace."""
    global _meter

    # Prometheus automático (pull local)
    Instrumentator().instrument(app).expose(app)

    # OTEL push (Grafana Cloud)
    endpoint = os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT", "")
    headers_str = os.getenv("OTEL_EXPORTER_OTLP_HEADERS", "")

    if endpoint and headers_str:
        headers = {}
        for part in headers_str.split(","):
            if "=" in part:
                k, v = part.split("=", 1)
                headers[k.strip()] = unquote(v.strip())

        resource = Resource.create({"service.name": "predict-stock-api"})
        
        readers = []
        
        # Grafana Cloud reader
        grafana_exporter = OTLPMetricExporter(
            endpoint=f"{endpoint}/v1/metrics",
            headers=headers
        )
        readers.append(PeriodicExportingMetricReader(grafana_exporter, export_interval_millis=30000))
        print("[OTEL METRICS] Push configurado para Grafana Cloud")

        # Dynatrace reader
        dt_endpoint = os.getenv("DT_OTEL_ENDPOINT", "")
        dt_token = os.getenv("DT_OTEL_TOKEN", "")
        if dt_endpoint and dt_token:
            dt_exporter = OTLPMetricExporter(
                endpoint=f"{dt_endpoint}/v1/metrics",
                headers={"Authorization": f"Api-Token {dt_token}"}
            )
            readers.append(PeriodicExportingMetricReader(dt_exporter, export_interval_millis=30000))
            print("[OTEL METRICS] Dynatrace configurado")

        provider = MeterProvider(resource=resource, metric_readers=readers)
        metrics.set_meter_provider(provider)
        _meter = metrics.get_meter("predict-stock")
    else:
        print("[OTEL METRICS] Sem endpoint, apenas Prometheus local")
from .metrics import (
    setup_metrics,
    record_forecast,
    record_model_quality,
    record_quota_hit,
    record_cache_hit,
    forecast_latency,
)
from .logging import setup_logging, get_logger
from .tracing import setup_tracing


def setup_observability(app):
    """Inicializa toda a stack de observabilidade — métricas, logs e traces."""
    setup_logging()
    setup_metrics(app)
    setup_tracing(app)
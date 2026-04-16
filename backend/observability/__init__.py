from .metrics import (
    setup_metrics,
    forecast_requests_total,
    forecast_latency,
    model_mae,
    model_mape,
    model_r2,
    quota_hits_total,
    cache_hits_total,
)
from .logging import setup_logging, get_logger
from .tracing import setup_tracing


def setup_observability(app):
    """Inicializa toda a stack de observabilidade — métricas, logs e traces."""
    setup_logging()
    setup_metrics(app)
    setup_tracing(app)
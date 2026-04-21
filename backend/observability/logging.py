import os
import logging
import structlog
from urllib.parse import unquote
from pythonjsonlogger import jsonlogger
from opentelemetry._logs import set_logger_provider
from opentelemetry.sdk._logs import LoggerProvider, LoggingHandler
from opentelemetry.sdk._logs.export import BatchLogRecordProcessor
from opentelemetry.exporter.otlp.proto.http._log_exporter import OTLPLogExporter
from opentelemetry.sdk.resources import Resource

_logger = None


def _parse_headers(headers_str):
    headers = {}
    if headers_str:
        for part in headers_str.split(","):
            if "=" in part:
                k, v = part.split("=", 1)
                headers[k.strip()] = unquote(v.strip())
    return headers


def setup_logging():
    handler = logging.StreamHandler()
    handler.setFormatter(jsonlogger.JsonFormatter(
        "%(asctime)s %(levelname)s %(name)s %(message)s"
    ))

    resource = Resource.create({"service.name": "predict-stock-api"})
    log_provider = LoggerProvider(resource=resource)
    set_logger_provider(log_provider)

    # ── Grafana Cloud ──────────────────────────────────────────
    endpoint = os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT", "http://localhost:4320")
    headers_str = os.getenv("OTEL_EXPORTER_OTLP_HEADERS", "")
    headers = _parse_headers(headers_str)
    print(f"[OTEL LOGS] Endpoint: {endpoint}")
    print(f"[OTEL LOGS] Headers present: {bool(headers_str)}")

    grafana_exporter = OTLPLogExporter(
        endpoint=f"{endpoint}/v1/logs",
        headers=headers
    )
    log_provider.add_log_record_processor(BatchLogRecordProcessor(grafana_exporter))

    # ── Dynatrace ──────────────────────────────────────────────
    dt_endpoint = os.getenv("DT_OTEL_ENDPOINT", "")
    dt_token = os.getenv("DT_OTEL_TOKEN", "")
    if dt_endpoint and dt_token:
        dt_exporter = OTLPLogExporter(
            endpoint=f"{dt_endpoint}/v1/logs",
            headers={"Authorization": f"Api-Token {dt_token}"}
        )
        log_provider.add_log_record_processor(BatchLogRecordProcessor(dt_exporter))
        print("[OTEL LOGS] Dynatrace configurado")

    otel_handler = LoggingHandler(logger_provider=log_provider)
    structlog.configure(
    processors=[
        structlog.stdlib.add_log_level,
        structlog.stdlib.add_logger_name,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer()
    ],
    wrapper_class=structlog.stdlib.BoundLogger,
    logger_factory=structlog.stdlib.LoggerFactory(),
    cache_logger_on_first_use=True,
)
    logging.basicConfig(handlers=[handler, otel_handler], level=logging.INFO)


def get_logger():
    global _logger
    if _logger is None:
        _logger = structlog.get_logger()
    return _logger
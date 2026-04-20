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


def setup_logging():
    """Configura logger JSON para stdout e OTEL para Loki via Grafana Cloud."""
    handler = logging.StreamHandler()
    handler.setFormatter(jsonlogger.JsonFormatter(
        "%(asctime)s %(levelname)s %(name)s %(message)s"
    ))

    endpoint = os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT", "http://localhost:4320")
    headers_str = os.getenv("OTEL_EXPORTER_OTLP_HEADERS", "")
    print(f"[OTEL LOGS] Endpoint: {endpoint}")
    print(f"[OTEL LOGS] Headers present: {bool(headers_str)}")

    headers = {}
    if headers_str:
        for part in headers_str.split(","):
            if "=" in part:
                k, v = part.split("=", 1)
                headers[k.strip()] = unquote(v.strip())

    resource = Resource.create({"service.name": "predict-stock-api"})
    log_provider = LoggerProvider(resource=resource)
    set_logger_provider(log_provider)
    log_exporter = OTLPLogExporter(
        endpoint=f"{endpoint}/v1/logs",
        headers=headers
    )
    log_provider.add_log_record_processor(BatchLogRecordProcessor(log_exporter))
    otel_handler = LoggingHandler(logger_provider=log_provider)

    logging.basicConfig(handlers=[handler, otel_handler], level=logging.INFO)


def get_logger():
    """Devolve o logger structlog partilhado."""
    global _logger
    if _logger is None:
        _logger = structlog.get_logger()
    return _logger
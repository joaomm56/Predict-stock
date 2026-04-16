import os
import logging
import structlog
from pythonjsonlogger import jsonlogger
from opentelemetry._logs import set_logger_provider
from opentelemetry.sdk._logs import LoggerProvider, LoggingHandler
from opentelemetry.sdk._logs.export import BatchLogRecordProcessor
from opentelemetry.exporter.otlp.proto.grpc._log_exporter import OTLPLogExporter

_logger = None


def setup_logging():
    """Configura logger JSON para stdout e OTEL para Loki via Collector."""
    # Handler JSON para stdout
    handler = logging.StreamHandler()
    handler.setFormatter(jsonlogger.JsonFormatter(
        "%(asctime)s %(levelname)s %(name)s %(message)s"
    ))

    # Handler OTEL para Loki via Collector
    endpoint = os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT", "http://localhost:4319")
    log_provider = LoggerProvider()
    set_logger_provider(log_provider)
    log_exporter = OTLPLogExporter(endpoint=endpoint, insecure=True)
    log_provider.add_log_record_processor(BatchLogRecordProcessor(log_exporter))
    otel_handler = LoggingHandler(logger_provider=log_provider)

    logging.basicConfig(handlers=[handler, otel_handler], level=logging.INFO)


def get_logger():
    """Devolve o logger structlog partilhado."""
    global _logger
    if _logger is None:
        _logger = structlog.get_logger()
    return _logger
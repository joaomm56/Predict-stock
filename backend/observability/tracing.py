import os
from urllib.parse import unquote
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.resources import Resource
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor


def _parse_headers(headers_str):
    headers = {}
    if headers_str:
        for part in headers_str.split(","):
            if "=" in part:
                k, v = part.split("=", 1)
                headers[k.strip()] = unquote(v.strip())
    return headers


def setup_tracing(app):
    resource = Resource.create({"service.name": "predict-stock-api"})
    provider = TracerProvider(resource=resource)

    # ── Grafana Cloud ──────────────────────────────────────────
    endpoint = os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT", "http://localhost:4320")
    headers_str = os.getenv("OTEL_EXPORTER_OTLP_HEADERS", "")
    headers = _parse_headers(headers_str)

    grafana_exporter = OTLPSpanExporter(
        endpoint=f"{endpoint}/v1/traces",
        headers=headers
    )
    provider.add_span_processor(BatchSpanProcessor(grafana_exporter))

    # ── Dynatrace ──────────────────────────────────────────────
    dt_endpoint = os.getenv("DT_OTEL_ENDPOINT", "")
    dt_token = os.getenv("DT_OTEL_TOKEN", "")
    if dt_endpoint and dt_token:
        dt_exporter = OTLPSpanExporter(
            endpoint=f"{dt_endpoint}/v1/traces",
            headers={"Authorization": f"Api-Token {dt_token}"}
        )
        provider.add_span_processor(BatchSpanProcessor(dt_exporter))
        print("[OTEL TRACES] Dynatrace configurado")

    trace.set_tracer_provider(provider)
    FastAPIInstrumentor.instrument_app(app, tracer_provider=provider)
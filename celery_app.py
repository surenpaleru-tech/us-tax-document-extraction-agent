import os

from celery import Celery
from services.logging_service import LoggingService

logger = LoggingService.get_logger("CeleryApp")

broker_url = os.getenv("CELERY_BROKER_URL", os.getenv("REDIS_URL", "redis://localhost:6379/0"))
result_backend = os.getenv("CELERY_RESULT_BACKEND", os.getenv("REDIS_URL", "redis://localhost:6379/1"))

app = Celery(
    "tax_document_intelligence",
    broker=broker_url,
    backend=result_backend,
)

app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    task_default_queue="tax_document_tasks",
    task_routes={
        "tasks.process_document": {"queue": "tax_document_tasks"}
    },
    worker_prefetch_multiplier=1,
    task_acks_late=True,
)

logger.info(f"Celery configured with broker={broker_url} backend={result_backend}")

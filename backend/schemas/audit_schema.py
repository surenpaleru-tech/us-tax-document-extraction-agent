from datetime import datetime
from pydantic import BaseModel


class AuditRecord(
    BaseModel
):

    timestamp: datetime

    document_name: str

    document_type: str

    model_used: str

    confidence_score: float

    validation_errors: list
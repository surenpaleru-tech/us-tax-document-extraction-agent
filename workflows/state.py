from typing import TypedDict


class ExtractionState(
    TypedDict,
    total=False
):

    pdf_path: str

    document: dict

    extracted_data: dict

    validation_errors: list

    confidence_score: float

    requires_human_review: bool

    processing_started_at: float

    processing_time_seconds: float

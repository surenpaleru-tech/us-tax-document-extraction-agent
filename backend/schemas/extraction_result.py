from pydantic import BaseModel

from schemas.tax_document_schema import (
    TaxDocumentSchema
)


class ExtractionResult(
    BaseModel
):

    data: TaxDocumentSchema

    validation_errors: list

    confidence_score: float

    requires_human_review: bool
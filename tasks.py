import time
from pathlib import Path

from celery_app import app
from agents.tax_document_extraction_agent import TaxDocumentExtractionAgent
from services.database_service import DatabaseService
from services.pdf_service import PDFService
from services.logging_service import LoggingService

logger = LoggingService.get_logger("CeleryTasks")


@app.task(bind=True, name="tasks.process_document")
def process_document(self, pdf_path: str):
    start = time.time()
    pdf_path = str(pdf_path)
    logger.info(f"Starting async document extraction: {pdf_path}")

    document = PDFService.load_document(pdf_path)
    extractor = TaxDocumentExtractionAgent()

    if document["document_mode"] == "digital":
        extracted_data = extractor.extract_from_text(document["text"])
    else:
        extracted_data = extractor.extract_from_images(document["images"])

    requires_review = (
        not extracted_data.get("document_type")
        or not extracted_data.get("ein")
        or not extracted_data.get("tax_year")
    )

    database = DatabaseService()
    database.save_document(
        file_name=Path(pdf_path).name,
        extracted_data=extracted_data,
        confidence_score=0.0,
        validation_errors=[],
        requires_review=requires_review,
        processing_time_seconds=time.time() - start,
    )

    logger.info(f"Async extraction finished: {pdf_path}")
    return {
        "status": "completed",
        "file_name": Path(pdf_path).name,
        "requires_review": requires_review,
    }

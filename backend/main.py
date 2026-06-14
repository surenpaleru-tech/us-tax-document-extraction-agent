
from workflows.extraction_graph import graph
from services.logging_service import LoggingService
from services.document_batch_processor import DocumentBatchProcessor
from services.config_loader import ConfigLoader

logger = LoggingService.get_logger("Main")

def process_document(file_path):
    return graph.invoke({
        "pdf_path": str(file_path),
        "document": {},
        "extracted_data": {},
        "validation_errors": [],
        "confidence_score": 0.0,
        "requires_human_review": False
    })

def main():
    cfg = ConfigLoader.get_config("batch_processing.yaml")

    files = DocumentBatchProcessor.get_documents(
        cfg["input_folder"],
        cfg.get("supported_extensions", ["pdf"]),
        cfg.get("recursive", True)
    )

    logger.info(f"Found {len(files)} documents")

    results = DocumentBatchProcessor.process_batch(
        files,
        process_document,
        cfg.get("max_workers", 4)
    )

    logger.info(f"Processed {len(results)} documents")

if __name__ == "__main__":
    main()

"""
Workflow Nodes
"""

from pathlib import Path
import time

from services.pdf_service import PDFService

from agents.tax_document_extraction_agent import (
    TaxDocumentExtractionAgent
)

from agents.validation_agent import (
    ValidationAgent
)

from agents.confidence_agent import (
    ConfidenceAgent
)

from agents.export_agent import (
    ExportAgent
)

from agents.human_review_agent import (
    HumanReviewAgent
)

from services.database_service import (
    DatabaseService
)

from services.logging_service import (
    LoggingService
)


logger = LoggingService.get_logger(
    "WorkflowNodes"
)


def load_document_node(state):

    logger.info(
        f"Loading document: {state['pdf_path']}"
    )

    state[
        "processing_started_at"
    ] = time.perf_counter()

    document = (
        PDFService.load_document(
            state["pdf_path"]
        )
    )

    state["document"] = document

    logger.info(
        f"Document Mode: {document['document_mode']}"
    )

    return state


def extract_node(state):

    logger.info(
        "Starting extraction"
    )

    extractor = (
        TaxDocumentExtractionAgent()
    )

    document = (
        state["document"]
    )

    if (
        document["document_mode"]
        == "digital"
    ):

        extracted_data = (
            extractor.extract_from_text(
                document["text"]
            )
        )

    else:

        extracted_data = (
            extractor.extract_from_images(
                document["images"]
            )
        )

    state[
        "extracted_data"
    ] = extracted_data

    logger.info(
        f"Document Type: "
        f"{extracted_data.get('document_type')}"
    )

    return state


def validate_node(state):

    logger.info(
        "Starting validation"
    )

    validator = (
        ValidationAgent()
    )

    validation_errors = (
        validator.validate(
            state[
                "extracted_data"
            ]
        )
    )

    state[
        "validation_errors"
    ] = validation_errors

    logger.info(
        f"Validation Errors: "
        f"{len(validation_errors)}"
    )

    return state


def confidence_node(state):

    logger.info(
        "Calculating confidence"
    )

    confidence_agent = (
        ConfidenceAgent()
    )

    confidence_score = (
        confidence_agent.calculate(
            state[
                "extracted_data"
            ],
            state[
                "validation_errors"
            ]
        )
    )

    state[
        "confidence_score"
    ] = confidence_score

    logger.info(
        f"Confidence Score: "
        f"{confidence_score}"
    )

    return state


def persist_node(state):

    logger.info(
        "Persisting results"
    )

    extracted_data = (
        state["extracted_data"]
    )

    confidence_score = (
        state["confidence_score"]
    )

    validation_errors = (
        state["validation_errors"]
    )

    review_agent = (
        HumanReviewAgent()
    )

    requires_review = (
        review_agent.requires_review(
            confidence_score
        )
    )

    state[
        "requires_human_review"
    ] = requires_review

    exporter = (
        ExportAgent()
    )

    exporter.export(
        extracted_data
    )

    logger.info(
        "Excel export completed"
    )

    database = (
        DatabaseService()
    )

    processing_time_seconds = round(
        time.perf_counter()
        -
        state.get(
            "processing_started_at",
            time.perf_counter()
        ),
        2
    )

    state[
        "processing_time_seconds"
    ] = processing_time_seconds

    database.save_document(
        file_name=Path(
            state["pdf_path"]
        ).name,

        extracted_data=
            extracted_data,

        confidence_score=
            confidence_score,

        validation_errors=
            validation_errors,

        requires_review=
            requires_review,

        processing_time_seconds=
            processing_time_seconds
    )

    logger.info(
        "Database save completed"
    )

    if requires_review:

        review_agent.save_review_case(
            pdf_name=Path(
                state["pdf_path"]
            ).stem,

            extraction_data=
                extracted_data,

            confidence_score=
                confidence_score,

            validation_errors=
                validation_errors
        )

        logger.warning(
            "Document requires review"
        )

    logger.info(
        "Workflow completed"
    )

    return state

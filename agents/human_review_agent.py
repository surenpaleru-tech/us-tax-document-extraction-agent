"""
Human Review Agent
"""

from pathlib import Path
import json
from datetime import datetime

from services.config_loader import (
    ConfigLoader
)

from services.logging_service import (
    LoggingService
)


logger = LoggingService.get_logger(
    "HumanReviewAgent"
)


class HumanReviewAgent:

    def __init__(self):

        self.application_config = (
            ConfigLoader.get_config(
                "application.yaml"
            )
        )

        self.confidence_config = (
            ConfigLoader.get_config(
                "confidence.yaml"
            )
        )

    def requires_review(
        self,
        confidence_score
    ):

        threshold = (
            self.confidence_config[
                "human_review_threshold"
            ]
        )

        return (
            confidence_score
            <
            threshold
        )

    def save_review_case(
        self,
        pdf_name,
        extraction_data,
        confidence_score,
        validation_errors
    ):

        review_folder = (
            self.application_config[
                "output"
            ][
                "review_folder"
            ]
        )

        Path(
            review_folder
        ).mkdir(
            parents=True,
            exist_ok=True
        )

        review_data = {

            "pdf_name":
                pdf_name,

            "status":
                "pending_review",

            "created_at":
                datetime.utcnow().isoformat(),

            "confidence_score":
                confidence_score,

            "validation_errors":
                validation_errors,

            "extracted_data":
                extraction_data
        }

        output_file = (
            Path(
                review_folder
            )
            /
            f"{pdf_name}.json"
        )

        with open(
            output_file,
            "w",
            encoding="utf-8"
        ) as file:

            json.dump(
                review_data,
                file,
                indent=4,
                ensure_ascii=False
            )

        logger.warning(
            f"Review case created: {pdf_name}"
        )

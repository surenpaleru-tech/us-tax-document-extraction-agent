"""
Confidence Agent
"""

from services.config_loader import (
    ConfigLoader
)

from services.logging_service import (
    LoggingService
)


logger = LoggingService.get_logger(
    "ConfidenceAgent"
)


class ConfidenceAgent:

    def __init__(self):

        self.config = (
            ConfigLoader.get_config(
                "confidence.yaml"
            )
        )

    def calculate(
        self,
        extracted_data,
        validation_errors
    ):

        score = (
            self.config[
                "base_score"
            ]
        )

        score -= (
            len(validation_errors)
            *
            self.config[
                "validation_error_penalty"
            ]
        )

        empty_fields = 0

        for value in (
            extracted_data.values()
        ):

            if value in [
                None,
                "",
                {},
                []
            ]:

                empty_fields += 1

        score -= (
            empty_fields
            *
            self.config[
                "empty_field_penalty"
            ]
        )

        score = max(
            score,
            0
        )

        logger.info(
            f"Confidence Score: {score}"
        )

        return score
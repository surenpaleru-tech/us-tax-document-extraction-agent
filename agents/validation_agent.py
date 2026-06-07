"""
Validation Agent
"""

from services.config_loader import (
    ConfigLoader
)

from services.logging_service import (
    LoggingService
)


logger = LoggingService.get_logger(
    "ValidationAgent"
)


class ValidationAgent:

    def __init__(self):

        self.config = (
            ConfigLoader.get_config(
                "confidence.yaml"
            )
        )

    def validate(
        self,
        extracted_data
    ):

        errors = []

        required_fields = (
            self.config[
                "required_fields"
            ]
        )

        for field in required_fields:

            value = (
                extracted_data.get(
                    field
                )
            )

            if value in [
                None,
                "",
                {}
            ]:

                errors.append(
                    f"{field} missing"
                )

        logger.info(
            f"Validation Errors: {len(errors)}"
        )

        return errors
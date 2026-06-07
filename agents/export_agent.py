"""
Excel Export Agent
"""

from pathlib import Path

import pandas as pd

from services.config_loader import (
    ConfigLoader
)

from services.logging_service import (
    LoggingService
)


logger = LoggingService.get_logger(
    "ExportAgent"
)


class ExportAgent:

    def __init__(self):

        self.config = (
            ConfigLoader.get_config(
                "application.yaml"
            )
        )

        self.output_file = (
            self.config[
                "output"
            ][
                "excel_file"
            ]
        )

    def export(
        self,
        extracted_data
    ):

        Path(
            self.output_file
        ).parent.mkdir(
            parents=True,
            exist_ok=True
        )

        row = pd.json_normalize(
            extracted_data
        )

        if Path(
            self.output_file
        ).exists():

            existing = pd.read_excel(
                self.output_file
            )

            combined = pd.concat(
                [
                    existing,
                    row
                ],
                ignore_index=True
            )

        else:

            combined = row

        combined.to_excel(
            self.output_file,
            index=False
        )

        logger.info(
            "Excel export completed"
        )
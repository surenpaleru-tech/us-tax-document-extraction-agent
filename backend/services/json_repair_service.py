"""
JSON Repair Service

Purpose:
- Extract JSON from LLM responses
- Repair malformed JSON
- Return dictionary
"""

import json
import re

from services.logging_service import (
    LoggingService
)


logger = LoggingService.get_logger(
    "JsonRepairService"
)


class JsonRepairService:

    @staticmethod
    def parse(
        response_text: str
    ) -> dict:

        try:

            return json.loads(
                response_text
            )

        except Exception:

            logger.warning(
                "Direct JSON parse failed"
            )

        try:

            match = re.search(
                r"\{.*\}",
                response_text,
                re.DOTALL
            )

            if match:

                json_text = (
                    match.group(0)
                )

                return json.loads(
                    json_text
                )

        except Exception as ex:

            logger.error(
                f"JSON repair failed: {ex}"
            )

        return {}
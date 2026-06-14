"""
Enterprise Result Merger
"""

from copy import deepcopy

from services.logging_service import (
    LoggingService
)


logger = LoggingService.get_logger(
    "ResultMerger"
)


class ResultMerger:

    @staticmethod
    def merge(
        page_results
    ):

        merged = {}

        for result in page_results:

            if not isinstance(
                result,
                dict
            ):
                continue

            for key, value in (
                result.items()
            ):

                if value in [
                    None,
                    "",
                    {},
                    []
                ]:
                    continue

                if key not in merged:

                    merged[key] = (
                        deepcopy(value)
                    )

                    continue

                if (
                    isinstance(value, dict)
                    and
                    isinstance(
                        merged[key],
                        dict
                    )
                ):

                    merged[key].update(
                        value
                    )

        logger.info(
            f"Merged {len(page_results)} pages"
        )

        return merged
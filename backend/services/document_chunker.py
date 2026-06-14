"""
Document Chunker
"""

from services.config_loader import (
    ConfigLoader
)

from services.logging_service import (
    LoggingService
)


logger = LoggingService.get_logger(
    "DocumentChunker"
)


class DocumentChunker:

    @staticmethod
    def split_text(
        text
    ):

        config = (
            ConfigLoader.get_config(
                "extraction.yaml"
            )
        )

        chunk_size = (
            config[
                "chunking"
            ][
                "chunk_size"
            ]
        )

        chunks = []

        start = 0

        while start < len(text):

            end = (
                start +
                chunk_size
            )

            chunks.append(
                text[start:end]
            )

            start = end

        logger.info(
            f"Created {len(chunks)} chunks"
        )

        return chunks
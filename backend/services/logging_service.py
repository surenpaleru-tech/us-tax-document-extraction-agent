"""
Central Logging Service with optional structlog JSON output
"""

import logging
from pathlib import Path

try:
    import structlog
except Exception:
    structlog = None


class LoggingService:

    @staticmethod
    def get_logger(name: str):

        Path("logs").mkdir(
            parents=True,
            exist_ok=True
        )

        if structlog:
            # Configure structlog for JSON output once
            if not getattr(LoggingService, "_configured", False):
                structlog.configure(
                    processors=[
                        structlog.processors.TimeStamper(fmt="iso"),
                        structlog.processors.add_log_level,
                        structlog.processors.StackInfoRenderer(),
                        structlog.processors.format_exc_info,
                        structlog.processors.JSONRenderer()
                    ],
                    context_class=dict,
                    logger_factory=structlog.stdlib.LoggerFactory(),
                    wrapper_class=structlog.stdlib.BoundLogger,
                    cache_logger_on_first_use=True,
                )
                LoggingService._configured = True

            return structlog.get_logger(name)

        # Fallback to standard logging
        logger = logging.getLogger(name)

        if logger.handlers:
            return logger

        logger.setLevel(logging.INFO)

        formatter = logging.Formatter(
            "%(asctime)s | %(levelname)s | %(name)s | %(message)s"
        )

        file_handler = logging.FileHandler(
            "logs/application.log",
            encoding="utf-8"
        )

        file_handler.setFormatter(formatter)

        console_handler = logging.StreamHandler()
        console_handler.setFormatter(formatter)

        logger.addHandler(file_handler)
        logger.addHandler(console_handler)

        logger.propagate = False

        return logger
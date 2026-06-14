"""
Database Service

Reads:

config/database.yaml
config/sql_queries.yaml
"""

import json
import sqlite3

from pathlib import Path
from datetime import datetime

from services.config_loader import (
    ConfigLoader
)

from services.logging_service import (
    LoggingService
)


logger = LoggingService.get_logger(
    "DatabaseService"
)


class DatabaseService:

    def __init__(self):

        self.database_config = (
            ConfigLoader.get_config(
                "database.yaml"
            )
        )

        self.sql_queries = (
            ConfigLoader.get_config(
                "sql_queries.yaml"
            )
        )

        self.db_path = (
            self.database_config[
                "database_path"
            ]
        )

        Path(
            self.db_path
        ).parent.mkdir(
            parents=True,
            exist_ok=True
        )

        self.initialize_database()

    def get_connection(
        self
    ):

        return sqlite3.connect(
            self.db_path
        )

    def initialize_database(
        self
    ):

        logger.info(
            "Initializing database"
        )

        connection = (
            self.get_connection()
        )

        cursor = (
            connection.cursor()
        )

        cursor.execute(
            self.sql_queries[
                "create_tax_documents_table"
            ]
        )

        connection.commit()

        connection.close()

    def save_document(
        self,
        file_name,
        extracted_data,
        confidence_score,
        validation_errors,
        requires_review,
        processing_time_seconds=0
    ):

        connection = (
            self.get_connection()
        )

        cursor = (
            connection.cursor()
        )

        cursor.execute(
            self.sql_queries[
                "insert_tax_document"
            ],
            (
                file_name,

                extracted_data.get(
                    "document_type"
                ),

                extracted_data.get(
                    "tax_year"
                ),

                extracted_data.get(
                    "filing_entity"
                ),

                extracted_data.get(
                    "ein"
                ),

                confidence_score,

                len(
                    validation_errors
                ),

                int(
                    requires_review
                ),

                json.dumps(
                    extracted_data,
                    ensure_ascii=False
                ),

                json.dumps(
                    validation_errors,
                    ensure_ascii=False
                ),

                processing_time_seconds,

                datetime.utcnow()
                .isoformat()
            )
        )

        connection.commit()

        connection.close()

        logger.info(
            f"Saved document: {file_name}"
        )

    def get_all_documents(
        self
    ):

        connection = (
            self.get_connection()
        )

        cursor = (
            connection.cursor()
        )

        rows = cursor.execute(
            self.sql_queries[
                "select_all_documents"
            ]
        ).fetchall()

        connection.close()

        return rows

    def get_document_by_id(
        self,
        document_id
    ):

        connection = (
            self.get_connection()
        )

        cursor = (
            connection.cursor()
        )

        row = cursor.execute(
            self.sql_queries[
                "select_document_by_id"
            ],
            (
                document_id,
            )
        ).fetchone()

        connection.close()

        return row

    def get_review_documents(
        self
    ):

        connection = (
            self.get_connection()
        )

        cursor = (
            connection.cursor()
        )

        rows = cursor.execute(
            self.sql_queries[
                "select_review_documents"
            ]
        ).fetchall()

        connection.close()

        return rows

    def get_document_count(
        self
    ):

        connection = (
            self.get_connection()
        )

        cursor = (
            connection.cursor()
        )

        count = cursor.execute(
            self.sql_queries[
                "select_document_count"
            ]
        ).fetchone()[0]

        connection.close()

        return count
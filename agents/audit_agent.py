import json
from pathlib import Path
from datetime import datetime


class AuditAgent:

    def save(
        self,
        audit_data
    ):

        Path(
            "output/audit"
        ).mkdir(
            parents=True,
            exist_ok=True
        )

        file_name = (
            datetime.now()
            .strftime(
                "%Y%m%d_%H%M%S"
            )
        )

        output_file = (
            f"output/audit/"
            f"{file_name}.json"
        )

        with open(
            output_file,
            "w",
            encoding="utf-8"
        ) as f:

            json.dump(
                audit_data,
                f,
                indent=4
            )
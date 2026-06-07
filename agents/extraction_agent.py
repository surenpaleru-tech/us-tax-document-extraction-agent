from services.llm_service import (
    LLMService
)

from services.json_parser import (
    JsonParser
)

from services.config_loader import (
    ConfigLoader
)


class ExtractionAgent:

    def __init__(self):

        models = (
            ConfigLoader
            .get_config(
                "models.yaml"
            )
        )

        self.llm = LLMService(
            models[
                "extractor_model"
            ]
        )

    def extract_page(
        self,
        page_text
    ):

        prompt = f"""
Extract tax data.

Return JSON.

Fields:

document_type
tax_year
ein

taxpayer

partnership

financial

financial_boxes

foreign_information

Text:

{page_text[:4000]}
"""

        response = (
            self.llm.invoke(
                prompt
            )
        )

        return (
            JsonParser
            .parse(
                response
            )
        )

    def extract_document(
        self,
        document_text
    ):

        pages = (
            document_text
            .split("\f")
        )

        results = []

        for page in pages:

            if page.strip():

                results.append(
                    self.extract_page(
                        page
                    )
                )

        return results
from services.llm_service import (
    LLMService
)

from services.config_loader import (
    ConfigLoader
)


class VisionExtractionAgent:

    def __init__(self):

        models = ConfigLoader.get_config(
            "models.yaml"
        )

        self.llm = LLMService(
            models["vision_model"]
        )

    def extract_image(
        self,
        image_path: str
    ):

        prompt = f"""
Analyze this tax form image.

Extract:

document_type
tax_year
ein

taxpayer

partnership

financial

financial_boxes

foreign_information

Return JSON.
"""

        # TEMPORARY
        # We'll add actual image support
        # after validating your Ollama version.

        return self.llm.invoke(
            prompt
        )

    def extract_document(
        self,
        image_paths
    ):

        results = []

        for image in image_paths:

            results.append(
                self.extract_image(
                    image
                )
            )

        return results
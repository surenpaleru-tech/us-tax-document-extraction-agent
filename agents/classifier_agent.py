from services.llm_service import (
    LLMService
)

from services.config_loader import (
    ConfigLoader
)


class ClassifierAgent:

    def __init__(self):

        models = ConfigLoader.get_config(
            "models.yaml"
        )

        self.llm = LLMService(
            models["classifier_model"]
        )

    def classify(
        self,
        text: str
    ):

        prompt = f"""
Classify this tax document.

Possible values:

K1
K2
K3
W2
1099
UNKNOWN

Return only category.

Document:

{text[:3000]}
"""

        return (
            self.llm.invoke(prompt)
            .strip()
        )
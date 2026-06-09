"""
Universal tax document extraction agent.

Handles digital PDFs with text extraction and scanned PDFs with vision models.
The model/provider is controlled by config/models.yaml.
"""

import re
from typing import Any, Dict, List

from services.config_loader import ConfigLoader
from services.document_chunker import DocumentChunker
from services.json_repair_service import JsonRepairService
from services.llm_service import LLMService
from services.logging_service import LoggingService
from services.result_merger import ResultMerger

logger = LoggingService.get_logger("TaxDocumentExtractionAgent")


class TaxDocumentExtractionAgent:
    def __init__(self) -> None:
        models = ConfigLoader.get_config("models.yaml") or {}
        provider = models.get("active_provider", "ollama")
        provider_config = (models.get("providers") or {}).get(provider, {})
        self.text_model = provider_config.get("text_model", "qwen3.5:4b")
        self.vision_model = provider_config.get("vision_model", self.text_model)
        self.llm = LLMService(provider=provider, model=self.text_model, vision=False)
        self.vision_llm = LLMService(provider=provider, model=self.vision_model, vision=True)
        logger.info(f"Provider: {provider}; text model: {self.text_model}; vision model: {self.vision_model}")

    def build_prompt(self, content: str) -> str:
        return f"""
You are an enterprise tax document extraction agent.

Extract all useful fields from the tax document. Return valid JSON only, with no markdown.
Use null when a field is unavailable. Preserve exact values from the document.

Required JSON shape:
{{
  "document_type": null,
  "tax_year": null,
  "filing_entity": null,
  "ein": null,
  "taxpayer": {{}},
  "organization": {{}},
  "financial": {{}},
  "state_information": {{}},
  "foreign_information": {{}},
  "tax_boxes": {{}},
  "form_specific_fields": {{}},
  "metadata": {{
    "source": "llm",
    "extraction_notes": []
  }}
}}

Document content:
{content}
"""

    @staticmethod
    def _regex_fallback(content: str) -> Dict[str, Any]:
        ein = re.search(r"\b\d{2}-\d{7}\b", content)
        tax_year = re.search(r"\b(20\d{2}|19\d{2})\b", content)
        doc_type = None
        upper = content.upper()
        for candidate in ["SCHEDULE K-1", "FORM 1099", "FORM W-2", "FORM 1040", "1065", "1120-S"]:
            if candidate in upper:
                doc_type = candidate.title()
                break
        return {
            "document_type": doc_type,
            "tax_year": tax_year.group(1) if tax_year else None,
            "filing_entity": None,
            "ein": ein.group(0) if ein else None,
            "taxpayer": {},
            "organization": {},
            "financial": {},
            "state_information": {},
            "foreign_information": {},
            "tax_boxes": {},
            "form_specific_fields": {},
            "metadata": {"source": "regex_fallback", "extraction_notes": ["LLM output was unavailable or invalid."]},
        }

    def extract_chunk(self, chunk: str) -> Dict[str, Any]:
        prompt = self.build_prompt(chunk)
        try:
            response = self.llm.invoke(prompt)
            parsed = JsonRepairService.parse(response)
            if isinstance(parsed, dict) and parsed:
                return parsed
        except Exception as exc:
            logger.error(f"Text extraction failed, using fallback: {exc}")
        return self._regex_fallback(chunk)

    def extract_from_text(self, document_text: str) -> Dict[str, Any]:
        chunks = DocumentChunker.split_text(document_text, chunk_size=3500) or [document_text]
        results: List[Dict[str, Any]] = [self.extract_chunk(chunk) for chunk in chunks if chunk.strip()]
        merged = ResultMerger.merge(results) if results else {}
        return merged or self._regex_fallback(document_text)

    def extract_image(self, image_path: str) -> Dict[str, Any]:
        prompt = self.build_prompt("This is a scanned tax document page image.")
        try:
            response = self.vision_llm.invoke_vision(image_path, prompt)
            parsed = JsonRepairService.parse(response)
            if isinstance(parsed, dict):
                return parsed
        except Exception as exc:
            logger.error(f"Vision extraction failed for {image_path}: {exc}")
        return {
            "document_type": None,
            "tax_year": None,
            "filing_entity": None,
            "ein": None,
            "taxpayer": {},
            "organization": {},
            "financial": {},
            "state_information": {},
            "foreign_information": {},
            "tax_boxes": {},
            "form_specific_fields": {},
            "metadata": {"source": "vision_fallback", "extraction_notes": ["Vision model failed for this page."]},
        }

    _easyocr_reader = None

    @classmethod
    def get_ocr_reader(cls):
        if cls._easyocr_reader is None:
            import easyocr
            # EasyOCR downloads models on demand.
            cls._easyocr_reader = easyocr.Reader(['en'])
        return cls._easyocr_reader

    def extract_from_images(self, image_paths: List[str]) -> Dict[str, Any]:
        logger.info("Extracting text from scanned images via EasyOCR")
        try:
            reader = self.get_ocr_reader()
            texts = []
            for path in image_paths:
                result = reader.readtext(path, detail=0)
                texts.append(" ".join(result))
            full_text = "\n\n--- Page Separation ---\n\n".join(texts)
            logger.info(f"OCR completed. Extracted {len(full_text)} characters.")
            if full_text.strip():
                return self.extract_from_text(full_text)
        except Exception as e:
            logger.error(f"OCR extraction failed: {e}")

        # Fallback to LLM vision if OCR fails
        logger.warning("Falling back to LLM Vision extraction")
        page_results = [self.extract_image(image_path) for image_path in image_paths]
        return ResultMerger.merge(page_results)


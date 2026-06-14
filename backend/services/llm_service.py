import base64
import json
import os
from pathlib import Path
from typing import Any, Dict, Optional

import requests

from services.config_loader import ConfigLoader
from services.logging_service import LoggingService

logger = LoggingService.get_logger("LLMService")


class LLMService:
    """Small provider adapter for Ollama, OpenAI-compatible Responses, and Gemini."""

    def __init__(
        self,
        provider: Optional[str] = None,
        model: Optional[str] = None,
        model_name: Optional[str] = None,
        vision: bool = False,
        **kwargs: Any,
    ) -> None:
        config = ConfigLoader.get_config("models.yaml") or {}
        self.provider = (provider or config.get("active_provider") or os.getenv("LLM_PROVIDER") or "ollama").lower()
        providers = config.get("providers", {})
        provider_config = providers.get(self.provider, {})
        model_key = "vision_model" if vision else "text_model"
        self.model = model or model_name or os.getenv("LLM_MODEL") or provider_config.get(model_key) or "qwen3.5:4b"
        self.base_url = provider_config.get("base_url", "http://127.0.0.1:11434").rstrip("/")
        self.timeout = int(config.get("timeout_seconds", 120))
        self.temperature = kwargs.get("temperature", config.get("temperature", 0))
        self.max_tokens = kwargs.get("max_tokens", config.get("max_tokens", 4096))

    @staticmethod
    def describe_runtime() -> Dict[str, Any]:
        config = ConfigLoader.get_config("models.yaml") or {}
        provider = (config.get("active_provider") or "ollama").lower()
        provider_config = (config.get("providers") or {}).get(provider, {})
        return {
            "active_provider": provider,
            "text_model": provider_config.get("text_model"),
            "vision_model": provider_config.get("vision_model"),
            "base_url": provider_config.get("base_url"),
            "cloud_keys": {
                "openai": bool(os.getenv("OPENAI_API_KEY")),
                "google": bool(os.getenv("GOOGLE_API_KEY")),
            },
        }

    def invoke(self, prompt: str) -> str:
        if self.provider == "openai":
            return self._invoke_openai(prompt)
        if self.provider == "google":
            return self._invoke_google(prompt)
        return self._invoke_ollama(prompt)

    def invoke_vision(self, image_path: str, prompt: str) -> str:
        path = Path(image_path)
        encoded = base64.b64encode(path.read_bytes()).decode("utf-8")
        mime_type = "image/jpeg" if path.suffix.lower() in {".jpg", ".jpeg"} else "image/png"
        if self.provider == "openai":
            return self._invoke_openai(prompt, image_base64=encoded, mime_type=mime_type)
        if self.provider == "google":
            return self._invoke_google(prompt, image_base64=encoded, mime_type=mime_type)
        return self._invoke_ollama(prompt, image_base64=encoded)

    def _invoke_ollama(self, prompt: str, image_base64: Optional[str] = None) -> str:
        message: Dict[str, Any] = {"role": "user", "content": prompt}
        if image_base64:
            message["images"] = [image_base64]
        response = requests.post(
            f"{self.base_url}/api/chat",
            json={
                "model": self.model,
                "messages": [message],
                "stream": False,
                "options": {
                    "temperature": self.temperature,
                    "num_predict": self.max_tokens,
                },
            },
            timeout=self.timeout,
        )
        if not response.ok:
            raise RuntimeError(f"Ollama {response.status_code}: {response.text[:1000]}")
        return response.json().get("message", {}).get("content", "")

    def _invoke_openai(
        self,
        prompt: str,
        image_base64: Optional[str] = None,
        mime_type: str = "image/png",
    ) -> str:
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise RuntimeError("OPENAI_API_KEY is required for the OpenAI provider")
        content: list[Dict[str, Any]] = [{"type": "input_text", "text": prompt}]
        if image_base64:
            content.append({"type": "input_image", "image_url": f"data:{mime_type};base64,{image_base64}"})
        response = requests.post(
            "https://api.openai.com/v1/responses",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={
                "model": self.model,
                "input": [{"role": "user", "content": content}],
                "temperature": self.temperature,
                "max_output_tokens": self.max_tokens,
            },
            timeout=self.timeout,
        )
        if not response.ok:
            raise RuntimeError(f"OpenAI {response.status_code}: {response.text[:1000]}")
        data = response.json()
        chunks: list[str] = []
        for item in data.get("output", []):
            for part in item.get("content", []):
                if part.get("type") in {"output_text", "text"}:
                    chunks.append(part.get("text", ""))
        return "\n".join(chunks)

    def _invoke_google(
        self,
        prompt: str,
        image_base64: Optional[str] = None,
        mime_type: str = "image/png",
    ) -> str:
        api_key = os.getenv("GOOGLE_API_KEY")
        if not api_key:
            raise RuntimeError("GOOGLE_API_KEY is required for the Google provider")
        parts: list[Dict[str, Any]] = [{"text": prompt}]
        if image_base64:
            parts.append({"inline_data": {"mime_type": mime_type, "data": image_base64}})
        response = requests.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent?key={api_key}",
            json={"contents": [{"parts": parts}], "generationConfig": {"temperature": self.temperature}},
            timeout=self.timeout,
        )
        if not response.ok:
            raise RuntimeError(f"Google {response.status_code}: {response.text[:1000]}")
        data = response.json()
        return "".join(
            part.get("text", "")
            for candidate in data.get("candidates", [])
            for part in candidate.get("content", {}).get("parts", [])
        )

    def chat(self, messages: Any) -> str:
        if isinstance(messages, str):
            return self.invoke(messages)
        if self.provider == "openai":
            return self._chat_openai(messages)
        if self.provider == "google":
            return self._chat_google(messages)
        return self._chat_ollama(messages)

    def _chat_ollama(self, messages: list[dict]) -> str:
        response = requests.post(
            f"{self.base_url}/api/chat",
            json={
                "model": self.model,
                "messages": messages,
                "stream": False,
                "options": {
                    "temperature": self.temperature,
                    "num_predict": min(self.max_tokens, 2048),
                },
            },
            timeout=self.timeout,
        )
        if not response.ok:
            raise RuntimeError(f"Ollama {response.status_code}: {response.text[:1000]}")
        return response.json().get("message", {}).get("content", "")

    def _chat_openai(self, messages: list[dict]) -> str:
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise RuntimeError("OPENAI_API_KEY is required for the OpenAI provider")
        response = requests.post(
            "https://api.openai.com/v1/chat/completions",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={
                "model": self.model,
                "messages": messages,
                "temperature": self.temperature,
                "max_tokens": min(self.max_tokens, 2048),
            },
            timeout=self.timeout,
        )
        if not response.ok:
            raise RuntimeError(f"OpenAI {response.status_code}: {response.text[:1000]}")
        return response.json().get("choices", [{}])[0].get("message", {}).get("content", "")

    def _chat_google(self, messages: list[dict]) -> str:
        api_key = os.getenv("GOOGLE_API_KEY")
        if not api_key:
            raise RuntimeError("GOOGLE_API_KEY is required for the Google provider")
        contents = []
        system_instruction = None
        for msg in messages:
            role = msg.get("role")
            content = msg.get("content")
            if role == "system":
                system_instruction = {"parts": [{"text": content}]}
            else:
                gemini_role = "user" if role == "user" else "model"
                contents.append({"role": gemini_role, "parts": [{"text": content}]})
        payload = {
            "contents": contents,
            "generationConfig": {
                "temperature": self.temperature,
                "maxOutputTokens": min(self.max_tokens, 2048)
            }
        }
        if system_instruction:
            payload["systemInstruction"] = system_instruction
        response = requests.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent?key={api_key}",
            json=payload,
            timeout=self.timeout,
        )
        if not response.ok:
            raise RuntimeError(f"Google {response.status_code}: {response.text[:1000]}")
        data = response.json()
        return "".join(
            part.get("text", "")
            for candidate in data.get("candidates", [])
            for part in candidate.get("content", {}).get("parts", [])
        )

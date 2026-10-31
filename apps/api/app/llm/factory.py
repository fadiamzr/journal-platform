"""
Provider factory: returns the LLM provider instance for the configured backend.

Usage:
    provider = get_provider(settings, http_client)

Raises LLMConfigError for unknown or unconfigured providers.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

import httpx

from app.llm.base import LLMConfigError

if TYPE_CHECKING:
    from app.core.config import Settings


def get_provider(settings: Settings, client: httpx.AsyncClient) -> object:
    """
    Instantiate and return the LLM provider selected by LLM_PROVIDER.

    Supported values: "gemini" (default), "ollama", "anthropic".
    Raises LLMConfigError for unknown values or missing configuration.
    """
    provider_name = (settings.LLM_PROVIDER or "gemini").lower().strip()

    if provider_name == "gemini":
        from app.llm.gemini import GeminiProvider

        return GeminiProvider(settings, client)

    if provider_name == "ollama":
        from app.llm.ollama import OllamaProvider

        return OllamaProvider(settings, client)

    if provider_name == "anthropic":
        from app.llm.anthropic import AnthropicProvider

        return AnthropicProvider(settings, client)

    raise LLMConfigError(
        f"Unknown LLM_PROVIDER value: {provider_name!r}. "
        "Supported: gemini, ollama, anthropic.",
        public_message="AI provider is not properly configured.",
    )

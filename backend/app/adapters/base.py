"""
Base provider adapter interface.

All provider adapters inherit from BaseProviderAdapter and implement the
required methods to translate between OpenAI format and their native format.
"""
from abc import ABC, abstractmethod
from typing import AsyncGenerator, Dict, Any, Optional, List


class BaseProviderAdapter(ABC):
    """Abstract base class for provider adapters."""

    provider_name: str = "base"

    @abstractmethod
    async def chat_completion(
        self,
        model: str,
        messages: List[Dict[str, Any]],
        temperature: float = 1.0,
        top_p: float = 1.0,
        max_tokens: Optional[int] = None,
        stop: Optional[Any] = None,
        stream: bool = False,
        tools: Optional[List[Dict]] = None,
        tool_choice: Optional[Any] = None,
        **kwargs,
    ) -> Dict[str, Any]:
        """Return a complete chat completion in OpenAI response format."""
        ...

    @abstractmethod
    async def chat_completion_stream(
        self,
        model: str,
        messages: List[Dict[str, Any]],
        temperature: float = 1.0,
        top_p: float = 1.0,
        max_tokens: Optional[int] = None,
        stop: Optional[Any] = None,
        tools: Optional[List[Dict]] = None,
        tool_choice: Optional[Any] = None,
        **kwargs,
    ) -> AsyncGenerator[str, None]:
        """Yield SSE-formatted chunks for streaming chat completions."""
        ...
        yield ""  # pragma: no cover

    @abstractmethod
    async def completion(
        self,
        model: str,
        prompt: str,
        temperature: float = 1.0,
        top_p: float = 1.0,
        max_tokens: Optional[int] = None,
        stop: Optional[Any] = None,
        stream: bool = False,
        **kwargs,
    ) -> Dict[str, Any]:
        """Return a text completion in OpenAI response format."""
        ...

    @abstractmethod
    async def embeddings(
        self,
        model: str,
        input_texts: List[str],
        **kwargs,
    ) -> Dict[str, Any]:
        """Return embeddings in OpenAI response format."""
        ...

    async def image_generation(
        self,
        model: str,
        prompt: str,
        n: int = 1,
        size: str = "1024x1024",
        quality: str = "standard",
        style: str = "natural",
        **kwargs,
    ) -> Dict[str, Any]:
        """Return image generation results. Override in image-capable adapters."""
        raise NotImplementedError(f"{self.provider_name} does not support image generation")

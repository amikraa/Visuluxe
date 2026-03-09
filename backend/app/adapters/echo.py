"""
Echo / stub provider adapter.

Returns deterministic responses for chat completions, text completions, and
embeddings. Useful for testing OpenAI SDK compatibility without requiring a
real LLM backend. In production, replace or extend with adapters for
Anthropic, OpenAI-passthrough, Ollama, vLLM, etc.
"""
import time
import uuid
import json
import logging
from typing import AsyncGenerator, Dict, Any, Optional, List

from app.adapters.base import BaseProviderAdapter

logger = logging.getLogger(__name__)


def _estimate_tokens(text: str) -> int:
    """Rough token count approximation (~4 chars per token)."""
    return max(1, len(text) // 4)


class EchoAdapter(BaseProviderAdapter):
    """
    A lightweight adapter that echoes back the user prompt.

    This serves two purposes:
    1. Validates that the entire OpenAI-compatible pipeline works end-to-end.
    2. Acts as a reference implementation for writing real provider adapters.
    """

    provider_name = "echo"

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
        last_user_msg = ""
        for msg in reversed(messages):
            if msg.get("role") == "user":
                content = msg.get("content", "")
                last_user_msg = content if isinstance(content, str) else str(content)
                break

        reply = f"Echo: {last_user_msg}"
        prompt_tokens = sum(_estimate_tokens(m.get("content", "") or "") for m in messages)
        completion_tokens = _estimate_tokens(reply)

        # Handle tool calls if tools are provided
        assistant_message: Dict[str, Any] = {
            "role": "assistant",
            "content": reply,
        }

        if tools and tool_choice != "none":
            # Demonstrate tool calling by echoing back the first tool
            first_tool = tools[0]
            func = first_tool.get("function", {})
            assistant_message["content"] = None
            assistant_message["tool_calls"] = [
                {
                    "id": f"call_{uuid.uuid4().hex[:24]}",
                    "type": "function",
                    "function": {
                        "name": func.get("name", "echo"),
                        "arguments": json.dumps({"input": last_user_msg}),
                    },
                }
            ]

        return {
            "id": f"chatcmpl-{uuid.uuid4().hex[:24]}",
            "object": "chat.completion",
            "created": int(time.time()),
            "model": model,
            "choices": [
                {
                    "index": 0,
                    "message": assistant_message,
                    "finish_reason": "tool_calls" if assistant_message.get("tool_calls") else "stop",
                    "logprobs": None,
                }
            ],
            "usage": {
                "prompt_tokens": prompt_tokens,
                "completion_tokens": completion_tokens,
                "total_tokens": prompt_tokens + completion_tokens,
            },
            "system_fingerprint": "fp_visuluxe_echo",
        }

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
        """Stream the echo response word-by-word as SSE chunks."""
        last_user_msg = ""
        for msg in reversed(messages):
            if msg.get("role") == "user":
                content = msg.get("content", "")
                last_user_msg = content if isinstance(content, str) else str(content)
                break

        reply = f"Echo: {last_user_msg}"
        stream_id = f"chatcmpl-{uuid.uuid4().hex[:24]}"
        created = int(time.time())

        # First chunk: role
        chunk = {
            "id": stream_id,
            "object": "chat.completion.chunk",
            "created": created,
            "model": model,
            "choices": [{"index": 0, "delta": {"role": "assistant", "content": ""}, "finish_reason": None}],
        }
        yield f"data: {json.dumps(chunk)}\n\n"

        # Content chunks: one per word
        words = reply.split(" ")
        for i, word in enumerate(words):
            token = word if i == 0 else f" {word}"
            chunk = {
                "id": stream_id,
                "object": "chat.completion.chunk",
                "created": created,
                "model": model,
                "choices": [{"index": 0, "delta": {"content": token}, "finish_reason": None}],
            }
            yield f"data: {json.dumps(chunk)}\n\n"

        # Final chunk: finish_reason
        chunk = {
            "id": stream_id,
            "object": "chat.completion.chunk",
            "created": created,
            "model": model,
            "choices": [{"index": 0, "delta": {}, "finish_reason": "stop"}],
        }
        yield f"data: {json.dumps(chunk)}\n\n"
        yield "data: [DONE]\n\n"

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
        reply = f"Echo: {prompt}"
        prompt_tokens = _estimate_tokens(prompt)
        completion_tokens = _estimate_tokens(reply)

        return {
            "id": f"cmpl-{uuid.uuid4().hex[:24]}",
            "object": "text_completion",
            "created": int(time.time()),
            "model": model,
            "choices": [
                {
                    "text": reply,
                    "index": 0,
                    "logprobs": None,
                    "finish_reason": "stop",
                }
            ],
            "usage": {
                "prompt_tokens": prompt_tokens,
                "completion_tokens": completion_tokens,
                "total_tokens": prompt_tokens + completion_tokens,
            },
        }

    async def embeddings(
        self,
        model: str,
        input_texts: List[str],
        **kwargs,
    ) -> Dict[str, Any]:
        """Return a deterministic 1536-dim embedding (all zeros + length signal)."""
        data = []
        total_tokens = 0
        for i, text in enumerate(input_texts):
            tokens = _estimate_tokens(text)
            total_tokens += tokens
            # Deterministic pseudo-embedding based on text length
            embedding = [0.0] * 1536
            embedding[0] = float(len(text)) / 1000.0
            embedding[1] = float(tokens) / 100.0
            data.append({
                "object": "embedding",
                "embedding": embedding,
                "index": i,
            })

        return {
            "object": "list",
            "data": data,
            "model": model,
            "usage": {
                "prompt_tokens": total_tokens,
                "total_tokens": total_tokens,
            },
        }

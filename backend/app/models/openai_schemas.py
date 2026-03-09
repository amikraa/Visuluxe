"""
OpenAI-compatible request and response schemas.

These Pydantic models mirror the OpenAI API specification so that standard
OpenAI SDKs (Python, Node, etc.) work without modification.
"""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any, Union, Literal
import time
import uuid


# ---------------------------------------------------------------------------
# Shared / Common
# ---------------------------------------------------------------------------

class OpenAIErrorDetail(BaseModel):
    """Standard OpenAI error envelope."""
    message: str
    type: str = "invalid_request_error"
    param: Optional[str] = None
    code: Optional[str] = None


class OpenAIErrorResponse(BaseModel):
    """Top-level error response matching OpenAI format."""
    error: OpenAIErrorDetail


class UsageInfo(BaseModel):
    """Token usage information returned by completions endpoints."""
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class ModelPermission(BaseModel):
    id: str = ""
    object: str = "model_permission"
    created: int = 0
    allow_create_engine: bool = False
    allow_sampling: bool = True
    allow_logprobs: bool = False
    allow_search_indices: bool = False
    allow_view: bool = True
    allow_fine_tuning: bool = False
    organization: str = "*"
    group: Optional[str] = None
    is_blocking: bool = False


class ModelObject(BaseModel):
    """Single model entry in the OpenAI /v1/models response."""
    id: str
    object: str = "model"
    created: int = 0
    owned_by: str = "visuluxe"
    permission: List[ModelPermission] = []
    root: str = ""
    parent: Optional[str] = None


class ModelListResponse(BaseModel):
    """GET /v1/models response."""
    object: str = "list"
    data: List[ModelObject]


# ---------------------------------------------------------------------------
# Chat Completions
# ---------------------------------------------------------------------------

class FunctionCall(BaseModel):
    name: str
    arguments: str


class ToolCall(BaseModel):
    id: str = Field(default_factory=lambda: f"call_{uuid.uuid4().hex[:24]}")
    type: str = "function"
    function: FunctionCall


class ChatMessage(BaseModel):
    role: Literal["system", "user", "assistant", "tool", "function"]
    content: Optional[Union[str, List[Any]]] = None
    name: Optional[str] = None
    tool_calls: Optional[List[ToolCall]] = None
    tool_call_id: Optional[str] = None
    function_call: Optional[FunctionCall] = None


class FunctionDefinition(BaseModel):
    name: str
    description: Optional[str] = None
    parameters: Optional[Dict[str, Any]] = None


class ToolDefinition(BaseModel):
    type: str = "function"
    function: FunctionDefinition


class ResponseFormat(BaseModel):
    type: str = "text"


class ChatCompletionRequest(BaseModel):
    """POST /v1/chat/completions request body."""
    model: str
    messages: List[ChatMessage]
    temperature: Optional[float] = Field(default=1.0, ge=0.0, le=2.0)
    top_p: Optional[float] = Field(default=1.0, ge=0.0, le=1.0)
    n: Optional[int] = Field(default=1, ge=1, le=10)
    stream: Optional[bool] = False
    stop: Optional[Union[str, List[str]]] = None
    max_tokens: Optional[int] = None
    presence_penalty: Optional[float] = Field(default=0.0, ge=-2.0, le=2.0)
    frequency_penalty: Optional[float] = Field(default=0.0, ge=-2.0, le=2.0)
    logit_bias: Optional[Dict[str, float]] = None
    user: Optional[str] = None
    tools: Optional[List[ToolDefinition]] = None
    tool_choice: Optional[Union[str, Dict[str, Any]]] = None
    response_format: Optional[ResponseFormat] = None
    seed: Optional[int] = None
    # Deprecated but still accepted
    functions: Optional[List[FunctionDefinition]] = None
    function_call: Optional[Union[str, Dict[str, str]]] = None


class ChatCompletionChoice(BaseModel):
    index: int = 0
    message: ChatMessage
    finish_reason: Optional[str] = "stop"
    logprobs: Optional[Any] = None


class ChatCompletionResponse(BaseModel):
    """Non-streaming chat completion response."""
    id: str = Field(default_factory=lambda: f"chatcmpl-{uuid.uuid4().hex[:24]}")
    object: str = "chat.completion"
    created: int = Field(default_factory=lambda: int(time.time()))
    model: str
    choices: List[ChatCompletionChoice]
    usage: UsageInfo = UsageInfo()
    system_fingerprint: Optional[str] = None


class ChatCompletionStreamDelta(BaseModel):
    role: Optional[str] = None
    content: Optional[str] = None
    tool_calls: Optional[List[ToolCall]] = None
    function_call: Optional[FunctionCall] = None


class ChatCompletionStreamChoice(BaseModel):
    index: int = 0
    delta: ChatCompletionStreamDelta
    finish_reason: Optional[str] = None
    logprobs: Optional[Any] = None


class ChatCompletionStreamResponse(BaseModel):
    """Single SSE chunk for streaming chat completions."""
    id: str = Field(default_factory=lambda: f"chatcmpl-{uuid.uuid4().hex[:24]}")
    object: str = "chat.completion.chunk"
    created: int = Field(default_factory=lambda: int(time.time()))
    model: str
    choices: List[ChatCompletionStreamChoice]
    system_fingerprint: Optional[str] = None


# ---------------------------------------------------------------------------
# Completions (legacy)
# ---------------------------------------------------------------------------

class CompletionRequest(BaseModel):
    """POST /v1/completions request body."""
    model: str
    prompt: Union[str, List[str]]
    max_tokens: Optional[int] = 16
    temperature: Optional[float] = Field(default=1.0, ge=0.0, le=2.0)
    top_p: Optional[float] = Field(default=1.0, ge=0.0, le=1.0)
    n: Optional[int] = Field(default=1, ge=1, le=10)
    stream: Optional[bool] = False
    logprobs: Optional[int] = None
    echo: Optional[bool] = False
    stop: Optional[Union[str, List[str]]] = None
    presence_penalty: Optional[float] = Field(default=0.0, ge=-2.0, le=2.0)
    frequency_penalty: Optional[float] = Field(default=0.0, ge=-2.0, le=2.0)
    best_of: Optional[int] = 1
    logit_bias: Optional[Dict[str, float]] = None
    user: Optional[str] = None
    seed: Optional[int] = None
    suffix: Optional[str] = None


class CompletionChoice(BaseModel):
    text: str
    index: int = 0
    logprobs: Optional[Any] = None
    finish_reason: Optional[str] = "stop"


class CompletionResponse(BaseModel):
    id: str = Field(default_factory=lambda: f"cmpl-{uuid.uuid4().hex[:24]}")
    object: str = "text_completion"
    created: int = Field(default_factory=lambda: int(time.time()))
    model: str
    choices: List[CompletionChoice]
    usage: UsageInfo = UsageInfo()
    system_fingerprint: Optional[str] = None


# ---------------------------------------------------------------------------
# Embeddings
# ---------------------------------------------------------------------------

class EmbeddingRequest(BaseModel):
    """POST /v1/embeddings request body."""
    input: Union[str, List[str]]
    model: str
    encoding_format: Optional[str] = "float"
    user: Optional[str] = None


class EmbeddingData(BaseModel):
    object: str = "embedding"
    embedding: List[float]
    index: int = 0


class EmbeddingResponse(BaseModel):
    object: str = "list"
    data: List[EmbeddingData]
    model: str
    usage: UsageInfo = UsageInfo()


# ---------------------------------------------------------------------------
# Images
# ---------------------------------------------------------------------------

class ImageGenerationRequest(BaseModel):
    """POST /v1/images/generations -- OpenAI-compatible request."""
    prompt: str = Field(..., min_length=1, max_length=4000)
    model: Optional[str] = Field(default="flux-dev")
    n: int = Field(default=1, ge=1, le=10)
    quality: Optional[Literal["standard", "hd"]] = "standard"
    response_format: Optional[Literal["url", "b64_json"]] = "url"
    size: Optional[str] = Field(default="1024x1024")
    style: Optional[Literal["natural", "vivid"]] = "natural"
    user: Optional[str] = None
    # Visuluxe extensions (ignored by OpenAI SDKs)
    negative_prompt: Optional[str] = None
    seed: Optional[int] = None


class ImageObject(BaseModel):
    url: Optional[str] = None
    b64_json: Optional[str] = None
    revised_prompt: Optional[str] = None


class ImageGenerationResponse(BaseModel):
    """OpenAI-compatible image generation response."""
    created: int = Field(default_factory=lambda: int(time.time()))
    data: List[ImageObject]


class ImageJobStatusResponse(BaseModel):
    """Extended response for async job polling (Visuluxe extension)."""
    job_id: str
    status: str
    created: int = Field(default_factory=lambda: int(time.time()))
    data: Optional[List[ImageObject]] = None
    error: Optional[str] = None

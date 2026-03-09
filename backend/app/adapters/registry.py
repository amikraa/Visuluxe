"""
Provider adapter registry.

Maps model identifiers to their corresponding adapter instances. When a
request arrives for a given model, the registry resolves which adapter
should handle it.
"""
import logging
from typing import Optional

from app.adapters.base import BaseProviderAdapter
from app.adapters.flux import FluxAdapter
from app.adapters.echo import EchoAdapter

logger = logging.getLogger(__name__)

# Singleton adapter instances (created on first use)
_flux_adapter: Optional[FluxAdapter] = None
_echo_adapter: Optional[EchoAdapter] = None


def _get_flux() -> FluxAdapter:
    global _flux_adapter
    if _flux_adapter is None:
        _flux_adapter = FluxAdapter()
    return _flux_adapter


def _get_echo() -> EchoAdapter:
    global _echo_adapter
    if _echo_adapter is None:
        _echo_adapter = EchoAdapter()
    return _echo_adapter


# Model-to-adapter mapping. Extend this dict when adding new providers.
_MODEL_ADAPTER_MAP = {
    # Image generation models -> Flux
    "flux-dev": _get_flux,
    "flux-1-dev": _get_flux,
    "dall-e-2": _get_flux,
    "dall-e-3": _get_flux,
    # Text / chat / embedding models -> Echo (replace with real adapters)
    "echo": _get_echo,
    "visuluxe-echo": _get_echo,
    "gpt-3.5-turbo": _get_echo,
    "gpt-4": _get_echo,
    "gpt-4o": _get_echo,
    "gpt-4o-mini": _get_echo,
    "text-embedding-ada-002": _get_echo,
    "text-embedding-3-small": _get_echo,
    "text-embedding-3-large": _get_echo,
}


def get_adapter(model: str) -> Optional[BaseProviderAdapter]:
    """
    Resolve a model identifier to its provider adapter.

    Falls back to Flux for any model containing 'flux' or 'dall-e' in the
    name.  Returns ``None`` for unknown models so that callers can raise
    ``ModelNotFoundError``.
    """
    factory = _MODEL_ADAPTER_MAP.get(model)
    if factory:
        return factory()

    # Fallback heuristics for known provider families
    model_lower = model.lower()
    if "flux" in model_lower or "dall-e" in model_lower:
        return _get_flux()

    # Unknown model -- let the caller decide how to handle it
    logger.warning(f"No adapter registered for model '{model}'")
    return None


def list_supported_models() -> list:
    """Return list of model IDs that have registered adapters."""
    return list(_MODEL_ADAPTER_MAP.keys())

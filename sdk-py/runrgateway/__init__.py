"""
4Runr Gateway SDK for Python

Official SDK for 4Runr Gateway - Secure API proxy with built-in authentication,
policy enforcement, and resilience.
"""

from .client import GatewayClient
from .errors import (
    GatewayError,
    GatewayAuthError,
    GatewayPolicyError,
    GatewayRateLimitError,
    GatewayUpstreamError,
    GatewayNetworkError,
    GatewayTokenError,
)
from .utils.correlation import generate_correlation_id, extract_correlation_id
from .utils.retry import with_retry, is_retryable_error
from .utils.idempotency import generate_idempotency_key

__version__ = "1.0.0"
__all__ = [
    "GatewayClient",
    "GatewayError",
    "GatewayAuthError",
    "GatewayPolicyError",
    "GatewayRateLimitError",
    "GatewayUpstreamError",
    "GatewayNetworkError",
    "GatewayTokenError",
    "generate_correlation_id",
    "extract_correlation_id",
    "with_retry",
    "is_retryable_error",
    "generate_idempotency_key",
]

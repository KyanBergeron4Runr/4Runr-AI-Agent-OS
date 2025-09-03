"""
Error classes for the 4Runr Gateway SDK.
"""

from typing import Optional


class GatewayError(Exception):
    """Base error class for all Gateway SDK errors."""

    def __init__(
        self, message: str, status_code: Optional[int] = None, code: Optional[str] = None
    ):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.code = code


class GatewayAuthError(GatewayError):
    """Authentication/authorization errors."""

    def __init__(self, message: str, status_code: Optional[int] = None):
        super().__init__(message, status_code, "AUTH_ERROR")


class GatewayPolicyError(GatewayError):
    """Policy enforcement errors."""

    def __init__(self, message: str, status_code: Optional[int] = None):
        super().__init__(message, status_code, "POLICY_ERROR")


class GatewayRateLimitError(GatewayError):
    """Rate limiting errors."""

    def __init__(
        self,
        message: str,
        retry_after: Optional[int] = None,
        status_code: Optional[int] = None,
    ):
        super().__init__(message, status_code, "RATE_LIMIT_ERROR")
        self.retry_after = retry_after


class GatewayUpstreamError(GatewayError):
    """Upstream service errors."""

    def __init__(self, message: str, status_code: Optional[int] = None):
        super().__init__(message, status_code, "UPSTREAM_ERROR")


class GatewayNetworkError(GatewayError):
    """Network/connection errors."""

    def __init__(self, message: str, original_error: Optional[Exception] = None):
        super().__init__(message, None, "NETWORK_ERROR")
        self.original_error = original_error


class GatewayTokenError(GatewayError):
    """Token-related errors."""

    def __init__(self, message: str, status_code: Optional[int] = None):
        super().__init__(message, status_code, "TOKEN_ERROR")


def create_error_from_response(
    status_code: int, error_message: str, retry_after: Optional[str] = None
) -> GatewayError:
    """Create appropriate error from HTTP response."""
    if status_code in (401, 403):
        return GatewayAuthError(error_message, status_code)
    elif status_code == 429:
        retry_after_seconds = int(retry_after) if retry_after else None
        return GatewayRateLimitError(error_message, retry_after_seconds, status_code)
    elif status_code == 400:
        if "policy" in error_message.lower() or "scope" in error_message.lower():
            return GatewayPolicyError(error_message, status_code)
        return GatewayError(error_message, status_code)
    elif status_code in (502, 503, 504):
        return GatewayUpstreamError(error_message, status_code)
    else:
        return GatewayError(error_message, status_code)

"""
Retry utilities with exponential backoff.
"""

import asyncio
import random
import time
from typing import Any, Callable, Optional, TypeVar

from ..errors import GatewayError, GatewayRateLimitError, GatewayUpstreamError

T = TypeVar('T')


class RetryOptions:
    """Configuration for retry behavior."""

    def __init__(
        self,
        max_retries: int = 3,
        base_delay: float = 1.0,
        max_delay: float = 10.0,
        jitter: bool = True,
    ):
        self.max_retries = max_retries
        self.base_delay = base_delay
        self.max_delay = max_delay
        self.jitter = jitter


def is_retryable_error(error: GatewayError) -> bool:
    """Check if an error is retryable."""
    # Rate limit errors are not retryable (wait for retry-after)
    if isinstance(error, GatewayRateLimitError):
        return False

    # Network errors are retryable
    if error.code == "NETWORK_ERROR":
        return True

    # Upstream errors (502, 503, 504) are retryable
    if isinstance(error, GatewayUpstreamError):
        return True

    # 5xx errors are retryable
    if error.status_code and error.status_code >= 500:
        return True

    return False


def calculate_delay(attempt: int, options: RetryOptions) -> float:
    """Calculate delay with exponential backoff and optional jitter."""
    delay = min(options.base_delay * (2 ** attempt), options.max_delay)

    if options.jitter:
        # Add ±25% jitter
        jitter = delay * 0.25 * (random.random() - 0.5)
        delay = max(0, delay + jitter)

    return delay


async def with_retry(
    fn: Callable[[], Any],
    options: Optional[RetryOptions] = None,
) -> T:
    """Retry a function with exponential backoff."""
    if options is None:
        options = RetryOptions()

    last_error: Exception

    for attempt in range(options.max_retries + 1):
        try:
            result = fn()
            if asyncio.iscoroutine(result):
                return await result
            return result
        except Exception as error:
            last_error = error

            # Don't retry on last attempt
            if attempt == options.max_retries:
                raise error

            # Check if error is retryable
            if isinstance(error, GatewayError) and not is_retryable_error(error):
                raise error

            # Calculate delay and wait
            delay = calculate_delay(attempt, options)
            await asyncio.sleep(delay)

    raise last_error

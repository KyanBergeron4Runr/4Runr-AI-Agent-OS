"""
Correlation ID utilities for request tracking.
"""

import time
import random
import string
from typing import Optional


def generate_correlation_id() -> str:
    """Generate a unique correlation ID for request tracking."""
    timestamp = int(time.time() * 1000)
    random_str = ''.join(random.choices(string.ascii_lowercase + string.digits, k=9))
    return f"req_{timestamp}_{random_str}"


def extract_correlation_id(headers: dict) -> Optional[str]:
    """Extract correlation ID from response headers."""
    return headers.get('X-Correlation-Id')

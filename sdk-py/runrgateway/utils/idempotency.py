"""
Idempotency utilities for non-idempotent operations.
"""

import hashlib
import json
import time
import uuid
from typing import Any, Dict


def generate_idempotency_key() -> str:
    """Generate a unique idempotency key."""
    timestamp = int(time.time() * 1000)
    unique_id = str(uuid.uuid4())
    return f"idemp_{timestamp}_{unique_id}"


def generate_idempotency_key_from_data(
    tool: str, action: str, params: Dict[str, Any]
) -> str:
    """Generate idempotency key from request data."""
    data_string = json.dumps({"tool": tool, "action": action, "params": params}, sort_keys=True)
    hash_obj = hashlib.sha256(data_string.encode())
    return f"idemp_{hash_obj.hexdigest()[:16]}"

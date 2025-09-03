"""
Main client for the 4Runr Gateway SDK.
"""

import asyncio
import json
import time
from datetime import datetime
from typing import Any, Dict, List, Optional, Union

import httpx
from pydantic import BaseModel

from .errors import (
    GatewayError,
    GatewayTokenError,
    create_error_from_response,
)
from .utils.correlation import generate_correlation_id
from .utils.retry import RetryOptions, with_retry


class TokenOptions(BaseModel):
    """Options for token generation."""

    tools: List[str]
    permissions: List[str]
    ttl_minutes: int


class ProxyResponse(BaseModel):
    """Response from proxy requests."""

    success: bool
    data: Any
    metadata: Dict[str, Any]


class JobResponse(BaseModel):
    """Response from job status requests."""

    status: str  # 'queued' | 'running' | 'done' | 'failed'
    result: Optional[Any] = None
    error: Optional[str] = None


class GatewayClient:
    """Main client for interacting with the 4Runr Gateway."""

    def __init__(
        self,
        base_url: str,
        agent_id: str,
        agent_private_key_pem: str,
        default_intent: Optional[str] = None,
        timeout_ms: int = 6000,
    ):
        self.base_url = base_url.rstrip("/")
        self.agent_id = agent_id
        self.agent_private_key_pem = agent_private_key_pem
        self.default_intent = default_intent
        self.timeout_ms = timeout_ms
        self.current_intent = default_intent or ""
        self._client = httpx.AsyncClient(
            timeout=timeout_ms / 1000,
            headers={
                "User-Agent": "runrgateway/1.0.0",
                "Content-Type": "application/json",
            },
        )

    def set_intent(self, intent: str) -> None:
        """Set the current intent for requests."""
        self.current_intent = intent

    async def get_token(self, opts: TokenOptions) -> str:
        """Get a new token from the Gateway."""
        expires_at = datetime.fromtimestamp(
            time.time() + opts.ttl_minutes * 60
        ).isoformat()

        response = await self._make_request(
            "/api/generate-token",
            method="POST",
            json={
                "agent_id": self.agent_id,
                "tools": opts.tools,
                "permissions": opts.permissions,
                "expires_at": expires_at,
            },
        )

        data = response.json()
        return data["agent_token"]

    async def proxy(
        self,
        tool: str,
        action: str,
        params: Dict[str, Any],
        agent_token: Optional[str] = None,
        proof_payload_override: Optional[Dict[str, Any]] = None,
    ) -> Any:
        """Make a proxied request through the Gateway."""
        # Auto-fetch token if not provided
        token = agent_token
        if not token:
            token = await self.get_token(
                TokenOptions(
                    tools=[tool],
                    permissions=["read", "write"],
                    ttl_minutes=10,
                )
            )

        # Check token age (reject if older than 24h)
        if token:
            token_age = self._get_token_age(token)
            if token_age > 24 * 60 * 60 * 1000:  # 24 hours
                raise GatewayTokenError("Token is too old (older than 24h)")

        body = {
            "agent_token": token,
            "tool": tool,
            "action": action,
            "params": params,
        }

        # Add intent if set
        if self.current_intent:
            body["intent"] = self.current_intent

        # Add proof payload override if provided
        if proof_payload_override:
            body["proof_payload"] = json.dumps(proof_payload_override)

        response = await self._make_request(
            "/api/proxy-request",
            method="POST",
            json=body,
        )

        data = ProxyResponse(**response.json())

        # Check for token rotation recommendation
        rotation_recommended = response.headers.get("X-Token-Rotation-Recommended")
        token_expires_at = response.headers.get("X-Token-Expires-At")

        if rotation_recommended == "true":
            print(f"Token rotation recommended! Expires: {token_expires_at}")

        return data.data

    async def proxy_async(
        self,
        tool: str,
        action: str,
        params: Dict[str, Any],
        agent_token: Optional[str] = None,
    ) -> Dict[str, str]:
        """Make an async proxy request."""
        # Auto-fetch token if not provided
        token = agent_token
        if not token:
            token = await self.get_token(
                TokenOptions(
                    tools=[tool],
                    permissions=["read", "write"],
                    ttl_minutes=10,
                )
            )

        body = {
            "agent_token": token,
            "tool": tool,
            "action": action,
            "params": params,
            "async": True,
        }

        # Add intent if set
        if self.current_intent:
            body["intent"] = self.current_intent

        response = await self._make_request(
            "/api/proxy-request",
            method="POST",
            json=body,
        )

        data = response.json()
        return {"job_id": data["job_id"]}

    async def get_job(self, job_id: str) -> JobResponse:
        """Get job status and result."""
        response = await self._make_request(f"/api/jobs/{job_id}", method="GET")
        return JobResponse(**response.json())

    async def _make_request(
        self,
        path: str,
        method: str = "GET",
        json: Optional[Dict[str, Any]] = None,
        **kwargs,
    ) -> httpx.Response:
        """Make an HTTP request with retry logic and error handling."""
        url = f"{self.base_url}{path}"
        correlation_id = generate_correlation_id()

        headers = {
            "X-Correlation-Id": correlation_id,
            **kwargs.get("headers", {}),
        }

        async def _request():
            try:
                response = await self._client.request(
                    method, url, json=json, headers=headers, **kwargs
                )

                if not response.is_success:
                    error_data = response.json() if response.content else {"error": "Unknown error"}
                    retry_after = response.headers.get("Retry-After")

                    raise create_error_from_response(
                        response.status_code,
                        error_data.get("error", f"HTTP {response.status_code}"),
                        retry_after,
                    )

                return response
            except httpx.RequestError as e:
                raise GatewayError(f"Network error: {str(e)}", code="NETWORK_ERROR")

        return await with_retry(_request)

    def _get_token_age(self, token: str) -> int:
        """Get token age in milliseconds."""
        try:
            # Extract timestamp from token (assuming it's in the format we expect)
            # This is a simplified implementation - in practice, you'd decode the JWT
            parts = token.split(".")
            if len(parts) >= 2:
                import base64

                payload = json.loads(base64.b64decode(parts[1] + "==").decode())
                if "iat" in payload:
                    return int(time.time() * 1000) - (payload["iat"] * 1000)
        except:
            # If we can't parse the token, assume it's recent
            pass
        return 0

    def _mask_params(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Mask sensitive parameters in logs."""
        masked = params.copy()
        sensitive_keys = ["password", "token", "key", "secret", "api_key"]

        for key in sensitive_keys:
            if key in masked:
                masked[key] = "***MASKED***"

        return masked

    async def close(self):
        """Close the HTTP client."""
        await self._client.aclose()

    async def __aenter__(self):
        """Async context manager entry."""
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        await self.close()

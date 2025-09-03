# runrgateway

Official SDK for 4Runr Gateway - Secure API proxy with built-in authentication, policy enforcement, and resilience.

## Features

- 🔐 **Secure Authentication** - Agent-native crypto with automatic token management
- 🛡️ **Policy Enforcement** - Built-in scopes, intents, and guards
- 🔄 **Automatic Retries** - Exponential backoff with jitter for resilient operations
- 🆔 **Correlation IDs** - Request tracking across services
- 🔑 **Token Rotation** - Automatic token refresh when recommended
- 📊 **Idempotency** - Built-in idempotency key generation
- 🐍 **Python 3.10+** - Modern Python with async/await support

## Installation

```bash
pip install runrgateway
```

## Quickstart

```python
import asyncio
import os
from runrgateway import GatewayClient

async def main():
    gw = GatewayClient(
        base_url=os.environ["GATEWAY_URL"],
        agent_id=os.environ["AGENT_ID"],
        agent_private_key_pem=os.environ["AGENT_PRIVATE_KEY"],
        default_intent="lead_discovery"
    )

    # Get a token for SerpAPI access
    token = await gw.get_token({
        "tools": ["serpapi"],
        "permissions": ["read"],
        "ttl_minutes": 15
    })

    # Search for leads
    results = await gw.proxy("serpapi", "search", {
        "q": "site:linkedin.com Montreal plumber",
        "engine": "google"
    }, token)

    print(results)

if __name__ == "__main__":
    asyncio.run(main())
```

## API Reference

### Constructor

```python
GatewayClient(
    base_url: str,              # https://gateway.internal
    agent_id: str,              # uuid
    agent_private_key_pem: str, # agent's private key
    default_intent: str = None, # optional
    timeout_ms: int = 6000      # default 6000
)
```

### Methods

#### `set_intent(intent: str) -> None`
Set the current intent for requests.

#### `get_token(opts: TokenOptions) -> str`
Get a new token from the Gateway.

```python
token = await gw.get_token({
    "tools": ["serpapi", "http_fetch"],
    "permissions": ["read", "write"],
    "ttl_minutes": 15
})
```

#### `proxy(tool, action, params, agent_token=None, proof_payload_override=None) -> Any`
Make a proxied request through the Gateway.

```python
# Auto-fetch token
results = await gw.proxy("serpapi", "search", {
    "q": "openai canada",
    "engine": "google"
})

# Use existing token
results = await gw.proxy("serpapi", "search", {
    "q": "openai canada",
    "engine": "google"
}, token)
```

#### `proxy_async(tool, action, params, agent_token=None) -> Dict[str, str]`
Make an async proxy request.

```python
job = await gw.proxy_async("gmail_send", "send", {
    "to": "user@example.com",
    "subject": "Test email",
    "body": "Hello world!"
})
job_id = job["job_id"]
```

#### `get_job(job_id: str) -> JobResponse`
Get job status and result.

```python
job = await gw.get_job(job_id)
print(job.status)  # 'queued' | 'running' | 'done' | 'failed'
```

## Error Handling

The SDK provides typed errors for different scenarios:

```python
from runrgateway import (
    GatewayAuthError,
    GatewayPolicyError,
    GatewayRateLimitError,
    GatewayUpstreamError
)

try:
    results = await gw.proxy("serpapi", "search", {"q": "test"})
except GatewayAuthError:
    print("Authentication failed")
except GatewayPolicyError:
    print("Policy violation")
except GatewayRateLimitError as e:
    print(f"Rate limited, retry after {e.retry_after} seconds")
except GatewayUpstreamError:
    print("Upstream service error")
```

## Built-in Features

### Automatic Retries
The SDK automatically retries failed requests with exponential backoff (idempotent operations only).

### Token Rotation
When the Gateway recommends token rotation via `X-Token-Rotation-Recommended` header, the SDK will automatically fetch a new token and retry the request.

### Correlation IDs
Every request includes a unique correlation ID for tracking across services.

### Idempotency
For non-idempotent operations, the SDK can generate idempotency keys:

```python
from runrgateway import generate_idempotency_key

idempotency_key = generate_idempotency_key()
```

## Security Notes

- The SDK never stores secrets; only uses the agent private key provided by env/secret store
- Parameters are masked in logs client-side
- Tokens older than 24h are rejected to force rotation habits
- All requests include correlation IDs for audit trails

## Examples

### Lead Scraper
```python
async def scrape_leads():
    gw = GatewayClient(
        base_url=os.environ["GATEWAY_URL"],
        agent_id=os.environ["AGENT_ID"],
        agent_private_key_pem=os.environ["AGENT_PRIVATE_KEY"]
    )

    # Search for leads
    results = await gw.proxy("serpapi", "search", {
        "q": 'site:linkedin.com "software engineer" "San Francisco"',
        "engine": "google",
        "num": 10
    })

    print(f"Found {len(results)} leads")
```

### Data Enricher
```python
async def enrich_data():
    # Fetch website content
    content = await gw.proxy("http_fetch", "get", {
        "url": "https://example.com"
    })

    # Summarize with OpenAI
    summary = await gw.proxy("openai", "chat", {
        "messages": [
            {"role": "user", "content": f"Summarize this content: {content}"}
        ]
    })

    print(summary)
```

### Email Engager
```python
async def send_email():
    # Send email (with idempotency)
    idempotency_key = generate_idempotency_key()

    await gw.proxy("gmail_send", "send", {
        "to": "prospect@company.com",
        "subject": "Partnership opportunity",
        "body": "Hi there, I think we could work together...",
        "idempotency_key": idempotency_key
    })
```

## Async Context Manager

The client supports async context management for automatic cleanup:

```python
async with GatewayClient(
    base_url=os.environ["GATEWAY_URL"],
    agent_id=os.environ["AGENT_ID"],
    agent_private_key_pem=os.environ["AGENT_PRIVATE_KEY"]
) as gw:
    results = await gw.proxy("serpapi", "search", {"q": "test"})
    print(results)
```

## Development

### Local Development
```bash
pip install -e ".[dev]"
pytest
black runrgateway/
isort runrgateway/
mypy runrgateway/
```

### Mock Mode
For unit tests, you can use mock mode:

```python
gw = GatewayClient(
    base_url="mock://localhost",
    agent_id="test-agent",
    agent_private_key_pem="test-key"
)
```

## License

MIT

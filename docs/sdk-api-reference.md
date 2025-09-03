# SDK API Reference

This document provides the complete API reference for the 4Runr Gateway SDKs.

## JavaScript/TypeScript SDK

### Installation

```bash
npm install @4runr/gateway
```

### GatewayClient

The main client class for interacting with the Gateway.

#### Constructor

```typescript
new GatewayClient({
  baseUrl: string,              // https://gateway.internal
  agentId: string,              // uuid
  agentPrivateKeyPem: string,   // agent's private key
  defaultIntent?: string,       // optional
  timeoutMs?: number           // default 6000
})
```

#### Methods

##### `setIntent(intent: string): void`

Set the current intent for requests.

```typescript
gw.setIntent('lead_discovery')
```

##### `getToken(opts: TokenOptions): Promise<string>`

Get a new token from the Gateway.

```typescript
interface TokenOptions {
  tools: string[]
  permissions: string[]
  ttlMinutes: number
}

const token = await gw.getToken({
  tools: ['serpapi', 'http_fetch'],
  permissions: ['read', 'write'],
  ttlMinutes: 15
})
```

##### `proxy<T>(tool, action, params, agentToken?, proofPayloadOverride?): Promise<T>`

Make a proxied request through the Gateway.

```typescript
// Auto-fetch token
const results = await gw.proxy('serpapi', 'search', {
  q: 'openai canada',
  engine: 'google'
})

// Use existing token
const results = await gw.proxy('serpapi', 'search', {
  q: 'openai canada',
  engine: 'google'
}, token)
```

##### `proxyAsync(tool, action, params, agentToken?): Promise<{ jobId: string }>`

Make an async proxy request.

```typescript
const { jobId } = await gw.proxyAsync('gmail_send', 'send', {
  to: 'user@example.com',
  subject: 'Test email',
  body: 'Hello world!'
})
```

##### `getJob(jobId: string): Promise<JobResponse>`

Get job status and result.

```typescript
interface JobResponse {
  status: 'queued' | 'running' | 'done' | 'failed'
  result?: any
  error?: string
}

const job = await gw.getJob(jobId)
console.log(job.status) // 'queued' | 'running' | 'done' | 'failed'
```

### Error Classes

The SDK provides typed errors for different scenarios:

```typescript
import {
  GatewayError,
  GatewayAuthError,
  GatewayPolicyError,
  GatewayRateLimitError,
  GatewayUpstreamError,
  GatewayNetworkError,
  GatewayTokenError
} from '@4runr/gateway'

try {
  const results = await gw.proxy('serpapi', 'search', { q: 'test' })
} catch (error) {
  if (error instanceof GatewayAuthError) {
    console.log('Authentication failed')
  } else if (error instanceof GatewayPolicyError) {
    console.log('Policy violation')
  } else if (error instanceof GatewayRateLimitError) {
    console.log(`Rate limited, retry after ${error.retryAfter} seconds`)
  } else if (error instanceof GatewayUpstreamError) {
    console.log('Upstream service error')
  }
}
```

### Utility Functions

#### Correlation IDs

```typescript
import { generateCorrelationId, extractCorrelationId } from '@4runr/gateway'

const correlationId = generateCorrelationId()
const extractedId = extractCorrelationId(response.headers)
```

#### Retry Logic

```typescript
import { withRetry, isRetryableError } from '@4runr/gateway'

const result = await withRetry(async () => {
  return await someOperation()
})
```

#### Idempotency

```typescript
import { generateIdempotencyKey } from '@4runr/gateway'

const idempotencyKey = generateIdempotencyKey()
```

## Python SDK

### Installation

```bash
pip install runrgateway
```

### GatewayClient

The main client class for interacting with the Gateway.

#### Constructor

```python
GatewayClient(
    base_url: str,              # https://gateway.internal
    agent_id: str,              # uuid
    agent_private_key_pem: str, # agent's private key
    default_intent: str = None, # optional
    timeout_ms: int = 6000      # default 6000
)
```

#### Methods

##### `set_intent(intent: str) -> None`

Set the current intent for requests.

```python
gw.set_intent("lead_discovery")
```

##### `get_token(opts: TokenOptions) -> str`

Get a new token from the Gateway.

```python
token = await gw.get_token({
    "tools": ["serpapi", "http_fetch"],
    "permissions": ["read", "write"],
    "ttl_minutes": 15
})
```

##### `proxy(tool, action, params, agent_token=None, proof_payload_override=None) -> Any`

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

##### `proxy_async(tool, action, params, agent_token=None) -> Dict[str, str]`

Make an async proxy request.

```python
job = await gw.proxy_async("gmail_send", "send", {
    "to": "user@example.com",
    "subject": "Test email",
    "body": "Hello world!"
})
job_id = job["job_id"]
```

##### `get_job(job_id: str) -> JobResponse`

Get job status and result.

```python
job = await gw.get_job(job_id)
print(job.status)  # 'queued' | 'running' | 'done' | 'failed'
```

### Error Classes

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

### Utility Functions

#### Correlation IDs

```python
from runrgateway import generate_correlation_id, extract_correlation_id

correlation_id = generate_correlation_id()
extracted_id = extract_correlation_id(response.headers)
```

#### Retry Logic

```python
from runrgateway import with_retry, is_retryable_error

result = await with_retry(lambda: some_operation())
```

#### Idempotency

```python
from runrgateway import generate_idempotency_key

idempotency_key = generate_idempotency_key()
```

### Async Context Manager

The Python client supports async context management for automatic cleanup:

```python
async with GatewayClient(
    base_url=os.environ["GATEWAY_URL"],
    agent_id=os.environ["AGENT_ID"],
    agent_private_key_pem=os.environ["AGENT_PRIVATE_KEY"]
) as gw:
    results = await gw.proxy("serpapi", "search", {"q": "test"})
    print(results)
```

## Common Patterns

### Token Management

```typescript
// JavaScript/TypeScript
const token = await gw.getToken({
  tools: ['serpapi'],
  permissions: ['read'],
  ttlMinutes: 15
})

// Reuse token for multiple requests
const results1 = await gw.proxy('serpapi', 'search', { q: 'query1' }, token)
const results2 = await gw.proxy('serpapi', 'search', { q: 'query2' }, token)
```

```python
# Python
token = await gw.get_token({
    "tools": ["serpapi"],
    "permissions": ["read"],
    "ttl_minutes": 15
})

# Reuse token for multiple requests
results1 = await gw.proxy("serpapi", "search", {"q": "query1"}, token)
results2 = await gw.proxy("serpapi", "search", {"q": "query2"}, token)
```

### Error Handling

```typescript
// JavaScript/TypeScript
try {
  const results = await gw.proxy('serpapi', 'search', { q: 'test' })
} catch (error) {
  if (error instanceof GatewayRateLimitError) {
    // Wait and retry
    await sleep(error.retryAfter * 1000)
    const results = await gw.proxy('serpapi', 'search', { q: 'test' })
  }
}
```

```python
# Python
try:
    results = await gw.proxy("serpapi", "search", {"q": "test"})
except GatewayRateLimitError as e:
    # Wait and retry
    await asyncio.sleep(e.retry_after)
    results = await gw.proxy("serpapi", "search", {"q": "test"})
```

### Idempotent Operations

```typescript
// JavaScript/TypeScript
import { generateIdempotencyKey } from '@4runr/gateway'

const idempotencyKey = generateIdempotencyKey()

await gw.proxy('gmail_send', 'send', {
  to: 'user@example.com',
  subject: 'Test',
  body: 'Hello',
  idempotencyKey
})
```

```python
# Python
from runrgateway import generate_idempotency_key

idempotency_key = generate_idempotency_key()

await gw.proxy("gmail_send", "send", {
    "to": "user@example.com",
    "subject": "Test",
    "body": "Hello",
    "idempotency_key": idempotency_key
})
```

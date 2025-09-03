# @4runr/gateway

Official SDK for 4Runr Gateway - Secure API proxy with built-in authentication, policy enforcement, and resilience.

## Features

- 🔐 **Secure Authentication** - Agent-native crypto with automatic token management
- 🛡️ **Policy Enforcement** - Built-in scopes, intents, and guards
- 🔄 **Automatic Retries** - Exponential backoff with jitter for resilient operations
- 🆔 **Correlation IDs** - Request tracking across services
- 🔑 **Token Rotation** - Automatic token refresh when recommended
- 📊 **Idempotency** - Built-in idempotency key generation
- 🚀 **TypeScript Support** - Full type safety and IntelliSense

## Installation

```bash
npm install @4runr/gateway
```

## Quickstart

```typescript
import { GatewayClient } from '@4runr/gateway'

const gw = new GatewayClient({
  baseUrl: process.env.GATEWAY_URL!,
  agentId: process.env.AGENT_ID!,
  agentPrivateKeyPem: process.env.AGENT_PRIVATE_KEY!,
  defaultIntent: 'lead_discovery'
})

// Get a token for SerpAPI access
const token = await gw.getToken({ 
  tools: ['serpapi'], 
  permissions: ['read'], 
  ttlMinutes: 15 
})

// Search for leads
const results = await gw.proxy('serpapi', 'search', { 
  q: 'site:linkedin.com Montreal plumber', 
  engine: 'google' 
}, token)

console.log(results)
```

## API Reference

### Constructor

```typescript
new GatewayClient({
  baseUrl: string,              // https://gateway.internal
  agentId: string,              // uuid
  agentPrivateKeyPem: string,   // agent's private key
  defaultIntent?: string,       // optional
  timeoutMs?: number           // default 6000
})
```

### Methods

#### `setIntent(intent: string): void`
Set the current intent for requests.

#### `getToken(opts: TokenOptions): Promise<string>`
Get a new token from the Gateway.

```typescript
const token = await gw.getToken({
  tools: ['serpapi', 'http_fetch'],
  permissions: ['read', 'write'],
  ttlMinutes: 15
})
```

#### `proxy<T>(tool, action, params, agentToken?, proofPayloadOverride?): Promise<T>`
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

#### `proxyAsync(tool, action, params, agentToken?): Promise<{ jobId: string }>`
Make an async proxy request.

```typescript
const { jobId } = await gw.proxyAsync('gmail_send', 'send', {
  to: 'user@example.com',
  subject: 'Test email',
  body: 'Hello world!'
})
```

#### `getJob(jobId: string): Promise<JobResponse>`
Get job status and result.

```typescript
const job = await gw.getJob(jobId)
console.log(job.status) // 'queued' | 'running' | 'done' | 'failed'
```

## Error Handling

The SDK provides typed errors for different scenarios:

```typescript
import { 
  GatewayAuthError, 
  GatewayPolicyError, 
  GatewayRateLimitError,
  GatewayUpstreamError 
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

## Built-in Features

### Automatic Retries
The SDK automatically retries failed requests with exponential backoff (idempotent operations only).

### Token Rotation
When the Gateway recommends token rotation via `X-Token-Rotation-Recommended` header, the SDK will automatically fetch a new token and retry the request.

### Correlation IDs
Every request includes a unique correlation ID for tracking across services.

### Idempotency
For non-idempotent operations, the SDK can generate idempotency keys:

```typescript
import { generateIdempotencyKey } from '@4runr/gateway'

const idempotencyKey = generateIdempotencyKey()
```

## Security Notes

- The SDK never stores secrets; only uses the agent private key provided by env/secret store
- Parameters are masked in logs client-side
- Tokens older than 24h are rejected to force rotation habits
- All requests include correlation IDs for audit trails

## Examples

### Lead Scraper
```typescript
const gw = new GatewayClient({
  baseUrl: process.env.GATEWAY_URL!,
  agentId: process.env.AGENT_ID!,
  agentPrivateKeyPem: process.env.AGENT_PRIVATE_KEY!
})

// Search for leads
const results = await gw.proxy('serpapi', 'search', {
  q: 'site:linkedin.com "software engineer" "San Francisco"',
  engine: 'google',
  num: 10
})

console.log(`Found ${results.length} leads`)
```

### Data Enricher
```typescript
// Fetch website content
const content = await gw.proxy('http_fetch', 'get', {
  url: 'https://example.com'
})

// Summarize with OpenAI
const summary = await gw.proxy('openai', 'chat', {
  messages: [
    { role: 'user', content: `Summarize this content: ${content}` }
  ]
})

console.log(summary)
```

### Email Engager
```typescript
// Send email (with idempotency)
const idempotencyKey = generateIdempotencyKey()

await gw.proxy('gmail_send', 'send', {
  to: 'prospect@company.com',
  subject: 'Partnership opportunity',
  body: 'Hi there, I think we could work together...',
  idempotencyKey
})
```

## Development

### Local Development
```bash
npm install
npm run dev    # Watch mode
npm run build  # Build for production
npm test       # Run tests
```

### Mock Mode
For unit tests, you can use mock mode:

```typescript
const gw = new GatewayClient({
  baseUrl: 'mock://localhost',
  agentId: 'test-agent',
  agentPrivateKeyPem: 'test-key'
})
```

## License

MIT

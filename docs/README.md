# 4Runr Gateway Documentation

Welcome to the 4Runr Gateway documentation. This guide will help you understand the architecture, security model, and how to integrate with the Gateway.

## Table of Contents

1. [What is 4Runr Gateway?](./what-is-gateway.md)
2. [Architecture](./architecture.md)
3. [Security Model](./security-model.md)
4. [Policy Reference](./policy-reference.md)
5. [Tool Adapters](./tool-adapters.md)
6. [SDK API Reference](./sdk-api-reference.md)
7. [Migration Guide](./migration-guide.md)
8. [Runbooks](./runbooks.md)
9. [FAQ](./faq.md)

## Quick Start

### JavaScript/TypeScript

```bash
npm install @4runr/gateway
```

```typescript
import { GatewayClient } from '@4runr/gateway'

const gw = new GatewayClient({
  baseUrl: process.env.GATEWAY_URL!,
  agentId: process.env.AGENT_ID!,
  agentPrivateKeyPem: process.env.AGENT_PRIVATE_KEY!
})

const results = await gw.proxy('serpapi', 'search', {
  q: 'site:linkedin.com Montreal plumber',
  engine: 'google'
})
```

### Python

```bash
pip install runrgateway
```

```python
from runrgateway import GatewayClient

gw = GatewayClient(
    base_url=os.environ["GATEWAY_URL"],
    agent_id=os.environ["AGENT_ID"],
    agent_private_key_pem=os.environ["AGENT_PRIVATE_KEY"]
)

results = await gw.proxy("serpapi", "search", {
    "q": "openai canada",
    "engine": "google"
})
```

## Examples

Check out our example applications:

- [Lead Scraper](../examples/scraper-js/) - JavaScript example
- [Data Enricher](../examples/enricher-js/) - JavaScript example  
- [Email Engager](../examples/engager-py/) - Python example

## Getting Help

- [FAQ](./faq.md) - Common questions and answers
- [Runbooks](./runbooks.md) - Operational procedures
- [GitHub Issues](https://github.com/4runr/gateway/issues) - Bug reports and feature requests

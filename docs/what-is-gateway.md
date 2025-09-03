# What is 4Runr Gateway?

4Runr Gateway is a secure API proxy that provides a unified interface for accessing external services with built-in authentication, policy enforcement, and resilience features.

## Overview

The Gateway acts as a secure intermediary between your applications and external APIs, providing:

- **🔐 Secure Authentication** - Agent-native crypto with automatic token management
- **🛡️ Policy Enforcement** - Fine-grained access control with scopes, intents, and guards
- **🔄 Resilience** - Circuit breakers, retries, caching, and graceful degradation
- **📊 Observability** - Comprehensive metrics, logging, and correlation IDs
- **🔑 Token Management** - Automatic token rotation and provenance tracking

## Key Benefits

### For Developers

- **One Integration** - Single SDK to access multiple external services
- **Type Safety** - Full TypeScript support with IntelliSense
- **Automatic Retries** - Built-in exponential backoff for resilient operations
- **Error Handling** - Typed errors for different failure scenarios

### For Operations

- **Centralized Control** - Manage all external API access from one place
- **Security Audit** - Complete audit trail with correlation IDs
- **Rate Limiting** - Per-agent and per-tool rate limiting
- **Monitoring** - Prometheus metrics and structured logging

### For Security

- **Zero Trust** - Agent-native authentication with cryptographic proofs
- **Policy as Code** - Declarative policies for access control
- **Token Provenance** - Cryptographic proof of token authenticity
- **Secret Management** - No secrets stored in applications

## How It Works

```
┌─────────────┐    ┌──────────────┐    ┌─────────────┐
│   Your App  │───▶│  4Runr       │───▶│  External   │
│             │    │  Gateway     │    │  APIs       │
└─────────────┘    └──────────────┘    └─────────────┘
                        │
                        ▼
                   ┌──────────────┐
                   │  Policy      │
                   │  Engine      │
                   └──────────────┘
```

1. **Authentication** - Your app authenticates using agent credentials
2. **Token Generation** - Gateway issues short-lived tokens for specific tools
3. **Request Proxy** - Gateway proxies requests to external APIs
4. **Policy Enforcement** - Policies are evaluated for each request
5. **Response Processing** - Responses are filtered and transformed as needed

## Supported Tools

The Gateway currently supports these external services:

- **SerpAPI** - Web search and scraping
- **OpenAI** - AI/ML services
- **Gmail** - Email sending and management
- **HTTP Fetch** - Generic HTTP requests

## Getting Started

1. **Install SDK** - Choose your preferred language:
   ```bash
   # JavaScript/TypeScript
   npm install @4runr/gateway
   
   # Python
   pip install runrgateway
   ```

2. **Create Agent** - Register your application as an agent
3. **Configure Policy** - Define access policies for your use case
4. **Start Building** - Use the SDK to access external services

## Example Use Cases

- **Lead Generation** - Scrape LinkedIn profiles and send outreach emails
- **Content Enrichment** - Fetch website content and summarize with AI
- **Data Processing** - Collect data from multiple sources and process
- **Customer Engagement** - Send personalized emails and track responses

## Architecture Principles

- **Security First** - Zero trust architecture with cryptographic proofs
- **Developer Experience** - Simple SDK with strong typing and error handling
- **Operational Excellence** - Comprehensive monitoring and resilience
- **Policy as Code** - Declarative policies for access control
- **Performance** - Low latency with caching and connection pooling

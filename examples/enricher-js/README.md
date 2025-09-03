# Data Enricher Example

This example demonstrates how to use the 4Runr Gateway SDK to fetch website content and enrich it with AI summaries.

## Features Demonstrated

- ✅ Multi-tool workflows (http_fetch + openai)
- ✅ Response redaction/truncation from Policy Engine
- ✅ Policy engine integration
- ✅ Correlation ID tracking
- ✅ Error handling for different HTTP status codes
- ✅ Off-hours policy testing

## Setup

1. Install dependencies:
```bash
npm install
```

2. Copy environment file:
```bash
cp env.example .env
```

3. Update `.env` with your Gateway credentials:
```bash
GATEWAY_URL=http://localhost:3000
AGENT_ID=your-agent-id-here
AGENT_PRIVATE_KEY=your-agent-private-key-here
```

## Running

```bash
npm start
```

## Expected Output

```
🔍 Starting data enricher...
📋 Getting token for http_fetch and openai...
✅ Token obtained

🌐 Fetching: Test website (200 OK)
   URL: https://httpstat.us/200
✅ Content fetched (1234ms)
   Status: 200
   Content length: 45 chars
   Preview: 200 OK

🤖 Summarizing with OpenAI...
✅ Summary generated (567ms)
   Summary: This is a test response indicating a successful HTTP 200 status code.

🌐 Fetching: Test website (404 Not Found)
   URL: https://httpstat.us/404
❌ Fetch failed: HTTP 404 Not Found
   Status: 404

⏰ Testing off-hours policy...
✅ Off-hours policy not enforced (or request allowed)
```

## What This Demonstrates

1. **Multi-tool Workflows**: Using both http_fetch and openai tools in sequence
2. **Content Fetching**: Fetching website content with proper error handling
3. **AI Summarization**: Using OpenAI to summarize fetched content
4. **Policy Engine**: Response redaction and content truncation
5. **Error Handling**: Graceful handling of different HTTP status codes
6. **Off-hours Policy**: Testing time-based policy enforcement

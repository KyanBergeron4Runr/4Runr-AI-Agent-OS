# Lead Scraper Example

This example demonstrates how to use the 4Runr Gateway SDK to scrape leads from search engines.

## Features Demonstrated

- ✅ Basic SDK usage and token management
- ✅ Policy enforcement (scope denial)
- ✅ Correlation ID tracking
- ✅ Error handling
- ✅ Multiple search queries

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
🔍 Starting lead scraper...
📋 Getting token for SerpAPI...
✅ Token obtained

🔎 Searching: Software engineers in San Francisco
✅ Found 5 results (1234ms)
  1. John Doe - Software Engineer at Tech Corp
     https://linkedin.com/in/johndoe
  2. Jane Smith - Senior Software Engineer
     https://linkedin.com/in/janesmith

🔎 Searching: Product managers in New York
✅ Found 5 results (987ms)
  1. Bob Johnson - Product Manager
     https://linkedin.com/in/bobjohnson

🚫 Testing scope denial...
✅ Scope denial working correctly
   Error: Policy violation: tool 'gmail_send' not allowed
```

## What This Demonstrates

1. **Token Management**: Automatic token generation with proper scopes
2. **Search Operations**: Multiple SerpAPI searches with different queries
3. **Policy Enforcement**: Attempting to use unauthorized tools (gmail_send) is blocked
4. **Performance**: Response times are tracked and displayed
5. **Error Handling**: Graceful handling of policy violations

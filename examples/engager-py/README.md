# Email Engager Example (Python)

This example demonstrates how to use the 4Runr Gateway Python SDK to send emails with idempotency.

## Features Demonstrated

- ✅ Email sending with idempotency keys
- ✅ Token management
- ✅ Policy enforcement
- ✅ Correlation ID tracking
- ✅ Error handling
- ✅ Gmail profile access
- ✅ Async context manager usage

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
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
python main.py
```

## Expected Output

```
📧 Starting email engager...
📋 Getting token for gmail_send...
✅ Token obtained

📤 Sending: Partnership email
   To: test1@example.com
   Subject: Partnership Opportunity
   Idempotency Key: idemp_1234567890_abc123def456
✅ Email sent successfully (1234ms)
   Message ID: 18c1234567890abc

📤 Sending: Demo request email
   To: test2@example.com
   Subject: Product Demo Request
   Idempotency Key: idemp_1234567891_def456ghi789
✅ Email sent successfully (987ms)
   Message ID: 18c1234567890def

🔄 Testing idempotency...
   Attempt 1:
   ✅ Email sent (567ms)
   Message ID: 18c1234567890ghi
   Attempt 2:
   ✅ Email sent (123ms)
   Message ID: 18c1234567890ghi

👤 Testing Gmail profile access...
✅ Profile accessed successfully
   Email: user@gmail.com
   Name: John Doe
```

## What This Demonstrates

1. **Email Sending**: Sending emails through Gmail with proper authentication
2. **Idempotency**: Using idempotency keys to prevent duplicate emails
3. **Token Management**: Automatic token generation for Gmail access
4. **Async Context Manager**: Proper resource cleanup with async context manager
5. **Profile Access**: Accessing Gmail profile information
6. **Error Handling**: Graceful handling of email sending failures
7. **Performance Tracking**: Response time measurement for each operation

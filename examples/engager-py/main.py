#!/usr/bin/env python3

"""
Email Engager Example

Demonstrates:
- Email sending with idempotency
- Token management
- Policy enforcement
- Correlation ID tracking
- Error handling
"""

import asyncio
import os
from datetime import datetime

from dotenv import load_dotenv
from runrgateway import GatewayClient, generate_idempotency_key

load_dotenv()

async def send_emails():
    """Send test emails using the Gateway SDK."""
    
    async with GatewayClient(
        base_url=os.getenv("GATEWAY_URL", "http://localhost:3000"),
        agent_id=os.getenv("AGENT_ID", "test-agent"),
        agent_private_key_pem=os.getenv("AGENT_PRIVATE_KEY", "test-key"),
        default_intent="email_engagement"
    ) as gw:
        
        print("📧 Starting email engager...")
        
        try:
            # Get a token for Gmail access
            print("📋 Getting token for gmail_send...")
            token = await gw.get_token({
                "tools": ["gmail_send"],
                "permissions": ["write"],
                "ttl_minutes": 15
            })
            print("✅ Token obtained")

            # Test emails
            test_emails = [
                {
                    "to": "test1@example.com",
                    "subject": "Partnership Opportunity",
                    "body": "Hi there, I think we could work together on some exciting projects...",
                    "description": "Partnership email"
                },
                {
                    "to": "test2@example.com", 
                    "subject": "Product Demo Request",
                    "body": "Hello! I'd love to schedule a demo of your product...",
                    "description": "Demo request email"
                }
            ]

            for email in test_emails:
                print(f"\n📤 Sending: {email['description']}")
                print(f"   To: {email['to']}")
                print(f"   Subject: {email['subject']}")
                
                # Generate idempotency key
                idempotency_key = generate_idempotency_key()
                print(f"   Idempotency Key: {idempotency_key}")
                
                try:
                    start_time = datetime.now()
                    
                    result = await gw.proxy("gmail_send", "send", {
                        "to": email["to"],
                        "subject": email["subject"],
                        "body": email["body"],
                        "idempotency_key": idempotency_key
                    }, token)
                    
                    duration = (datetime.now() - start_time).total_seconds() * 1000
                    print(f"✅ Email sent successfully ({duration:.0f}ms)")
                    print(f"   Message ID: {result.get('message_id', 'N/A')}")
                    
                except Exception as e:
                    print(f"❌ Email failed: {str(e)}")

            # Test idempotency by sending the same email twice
            print("\n🔄 Testing idempotency...")
            idempotency_key = generate_idempotency_key()
            
            for i in range(2):
                print(f"   Attempt {i + 1}:")
                try:
                    start_time = datetime.now()
                    
                    result = await gw.proxy("gmail_send", "send", {
                        "to": "idempotency-test@example.com",
                        "subject": "Idempotency Test",
                        "body": "This email should only be sent once due to idempotency.",
                        "idempotency_key": idempotency_key
                    }, token)
                    
                    duration = (datetime.now() - start_time).total_seconds() * 1000
                    print(f"   ✅ Email sent ({duration:.0f}ms)")
                    print(f"   Message ID: {result.get('message_id', 'N/A')}")
                    
                except Exception as e:
                    print(f"   ❌ Email failed: {str(e)}")

            # Test Gmail profile access
            print("\n👤 Testing Gmail profile access...")
            try:
                profile = await gw.proxy("gmail_send", "profile", {}, token)
                print("✅ Profile accessed successfully")
                print(f"   Email: {profile.get('email', 'N/A')}")
                print(f"   Name: {profile.get('name', 'N/A')}")
                
            except Exception as e:
                print(f"❌ Profile access failed: {str(e)}")

        except Exception as error:
            print(f"❌ Error: {str(error)}")
            return 1

    return 0

if __name__ == "__main__":
    exit_code = asyncio.run(send_emails())
    exit(exit_code)

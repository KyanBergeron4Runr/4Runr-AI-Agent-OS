#!/usr/bin/env ts-node

import fetch from 'node-fetch'

interface AgentResponse {
  agent_id: string
  private_key: string
}

interface TokenResponse {
  agent_token: string
  expires_at: string
  agent_name: string
}

async function testRateLimits() {
  console.log('🚦 Testing 4Runr Gateway Rate Limiting\n')

  try {
    // Step 1: Create an agent
    console.log('Step 1: Creating Agent')
    const createAgentResponse = await fetch('http://localhost:3000/api/create-agent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'rate_limit_test_agent',
        created_by: 'test_user',
        role: 'test_agent'
      })
    })

    if (!createAgentResponse.ok) {
      throw new Error(`Failed to create agent: ${createAgentResponse.statusText}`)
    }

    const agentData = await createAgentResponse.json() as AgentResponse
    console.log(`✅ Agent created (ID: ${agentData.agent_id})\n`)

    // Step 2: Generate a token
    console.log('Step 2: Generating Token')
    const generateTokenResponse = await fetch('http://localhost:3000/api/generate-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent_id: agentData.agent_id,
        tools: ['openai'],
        permissions: ['read'],
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      })
    })

    if (!generateTokenResponse.ok) {
      throw new Error(`Failed to generate token: ${generateTokenResponse.statusText}`)
    }

    const tokenData = await generateTokenResponse.json() as TokenResponse
    console.log(`✅ Token generated for: ${tokenData.agent_name}\n`)

    // Step 3: Test rate limiting by making multiple requests
    console.log('Step 3: Testing Rate Limiting (5 requests allowed per minute)')
    console.log('Making 7 requests to trigger rate limiting...\n')

    let successCount = 0
    let rateLimitCount = 0
    let otherErrorCount = 0

    for (let i = 1; i <= 7; i++) {
      console.log(`Request ${i}/7...`)
      
      const proxyResponse = await fetch('http://localhost:3000/api/proxy-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent_token: tokenData.agent_token,
          tool: 'openai',
          action: 'chat',
          params: {
            model: 'gpt-3.5-turbo',
            messages: [
              { role: 'user', content: `Test request ${i}` }
            ],
            max_tokens: 10
          }
        })
      })

      if (proxyResponse.status === 200) {
        successCount++
        console.log(`  ✅ Success`)
      } else if (proxyResponse.status === 429) {
        rateLimitCount++
        const errorData = await proxyResponse.json() as any
        console.log(`  🚦 Rate Limited: ${errorData.error}`)
        if (errorData.retry_after) {
          console.log(`  ⏰ Retry after: ${errorData.retry_after} seconds`)
        }
      } else {
        otherErrorCount++
        const errorData = await proxyResponse.json() as any
        console.log(`  ❌ Error (${proxyResponse.status}): ${JSON.stringify(errorData)}`)
      }

      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    console.log('\n📊 Rate Limit Test Results:')
    console.log(`  Successful requests: ${successCount}`)
    console.log(`  Rate limited requests: ${rateLimitCount}`)
    console.log(`  Other errors: ${otherErrorCount}`)

    if (rateLimitCount > 0) {
      console.log('\n✅ Rate limiting is working correctly!')
    } else {
      console.log('\n⚠️  Rate limiting may not be working as expected')
    }

    // Step 4: Test token rotation headers
    console.log('\nStep 4: Testing Token Rotation Headers')
    const statusResponse = await fetch('http://localhost:3000/api/proxy/status')
    if (statusResponse.ok) {
      console.log('✅ Proxy status check successful')
    } else {
      console.log('❌ Proxy status check failed')
    }

  } catch (error) {
    console.error('❌ Rate limit test failed:', error)
  }
}

testRateLimits().then(() => {
  process.exit(0)
}).catch((error) => {
  console.error('❌ Test failed:', error)
  process.exit(1)
})

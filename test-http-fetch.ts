#!/usr/bin/env ts-node

import fetch from 'node-fetch'

interface AgentResponse {
  agent_id: string
  private_key: string
}

async function testHttpFetch() {
  console.log('🌐 Testing HTTP Fetch Tool\n')

  const gatewayUrl = 'http://localhost:3000'

  try {
    // Create an agent
    const createAgentResponse = await fetch(`${gatewayUrl}/api/create-agent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'http_test_agent',
        created_by: 'test_user',
        role: 'tester'
      })
    })

    const agentData = await createAgentResponse.json() as AgentResponse
    console.log(`✅ Agent created: ${agentData.agent_id}`)

    // Generate token
    const tokenResponse = await fetch(`${gatewayUrl}/api/generate-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent_id: agentData.agent_id,
        tools: ['http_fetch'],
        permissions: ['read'],
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString()
      })
    })

    const tokenData = await tokenResponse.json() as any
    console.log(`✅ Token generated`)

    // Test HTTP GET
    const proxyResponse = await fetch(`${gatewayUrl}/api/proxy-request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent_token: tokenData.agent_token,
        tool: 'http_fetch',
        action: 'get',
        params: {
          url: 'https://example.com'
        }
      })
    })

    if (proxyResponse.ok) {
      const result = await proxyResponse.json() as any
      console.log('✅ HTTP fetch successful')
      console.log(`   Status: ${result.data?.status}`)
      console.log(`   Content-Type: ${result.data?.headers?.['content-type']}`)
    } else {
      const error = await proxyResponse.json()
      console.log(`❌ HTTP fetch failed: ${JSON.stringify(error)}`)
    }

  } catch (error) {
    console.error('❌ Test failed:', error)
  }
}

testHttpFetch().then(() => {
  process.exit(0)
}).catch((error) => {
  console.error('❌ Test failed:', error)
  process.exit(1)
})

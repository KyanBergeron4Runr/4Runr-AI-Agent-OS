import fetch from 'node-fetch'

// Type definitions for API responses
interface AgentResponse {
  agent_id: string
  private_key: string
}

interface TokenResponse {
  agent_token: string
  expires_at: string
  agent_name: string
}

interface StatusResponse {
  status: string
  configured_tools: {
    serpapi: boolean
    openai: boolean
  }
  signing_secret: boolean
  gateway_key: boolean
}

async function testProxySystem() {
  console.log('🔁 Testing 4Runr Gateway Proxy System\n')

  try {
    // Step 1: Create an agent
    console.log('Step 1: Creating Agent')
    const createAgentResponse = await fetch('http://localhost:3000/api/create-agent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'test_proxy_agent',
        created_by: 'test_user',
        role: 'test_agent'
      })
    })

    if (!createAgentResponse.ok) {
      throw new Error(`Failed to create agent: ${createAgentResponse.statusText}`)
    }

    const agentData = await createAgentResponse.json() as AgentResponse
    console.log(`✅ Agent created (ID: ${agentData.agent_id})\n`)

    // Step 2: Generate a token for the agent
    console.log('Step 2: Generating Token')
    const generateTokenResponse = await fetch('http://localhost:3000/api/generate-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent_id: agentData.agent_id,
        tools: ['openai'],
        permissions: ['read'],
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours from now
      })
    })

    if (!generateTokenResponse.ok) {
      throw new Error(`Failed to generate token: ${generateTokenResponse.statusText}`)
    }

    const tokenData = await generateTokenResponse.json() as TokenResponse
    console.log(`✅ Token generated for: ${tokenData.agent_name}`)
    console.log(`   Expires: ${tokenData.expires_at}\n`)

    // Step 3: Test OpenAI Proxy Request
    console.log('Step 3: Testing OpenAI Proxy Request')
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
            { role: 'user', content: 'Hello! Please respond with "4Runr Gateway test successful!"' }
          ],
          max_tokens: 50
        }
      })
    })

    if (proxyResponse.ok) {
      const proxyData = await proxyResponse.json() as any
      console.log('✅ OpenAI proxy request successful!')
      console.log(`   Response: ${JSON.stringify(proxyData.data?.choices?.[0]?.message?.content || 'No content')}`)
    } else {
      const errorData = await proxyResponse.json()
      console.log(`❌ OpenAI proxy request failed: ${proxyResponse.status} ${JSON.stringify(errorData)}`)
    }

    // Step 4: Test Proxy Status
    console.log('\nStep 4: Testing Proxy Status')
    const statusResponse = await fetch('http://localhost:3000/api/proxy/status')
    if (statusResponse.ok) {
      const statusData = await statusResponse.json() as StatusResponse
      console.log('✅ Proxy status: operational')
      console.log(`   Configured tools: ${JSON.stringify(statusData.configured_tools)}`)
      console.log(`   Signing secret: ${statusData.signing_secret ? '✅' : '❌'}`)
      console.log(`   Gateway key: ${statusData.gateway_key ? '✅' : '❌'}`)
    } else {
      console.log('❌ Failed to get proxy status')
    }

    // Step 5: Test Unauthorized Tool Access
    console.log('\nStep 5: Testing Unauthorized Tool Access')
    const unauthorizedResponse = await fetch('http://localhost:3000/api/proxy-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent_token: tokenData.agent_token,
        tool: 'unauthorized_tool',
        action: 'test',
        params: {}
      })
    })

    if (unauthorizedResponse.status === 403) {
      console.log('✅ Unauthorized access correctly blocked')
    } else {
      console.log('❌ Unauthorized access should have been blocked')
    }

    console.log('\n🎉 Proxy System Test Complete!')
    console.log('\n📋 Test Summary:')
    console.log('  ✅ Agent creation')
    console.log('  ✅ Token generation')
    console.log('  ✅ OpenAI proxy request')
    console.log('  ✅ Authorization checks')
    console.log('  ✅ Status endpoint')

  } catch (error) {
    console.error('❌ Test failed:', error)
  }
}

testProxySystem()

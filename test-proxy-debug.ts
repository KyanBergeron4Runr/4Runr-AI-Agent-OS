const GATEWAY_URL = 'http://localhost:3000'

async function testProxyDebug() {
  try {
    console.log('🔍 Testing proxy request debug...')
    
    // Step 1: Create an agent
    console.log('1. Creating agent...')
    const agentResponse = await fetch(`${GATEWAY_URL}/api/create-agent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'debug_agent',
        role: 'scraper',
        created_by: 'debug'
      })
    })
    const agentData = await agentResponse.json() as any
    console.log('Agent created:', agentData.agent_id)

    // Step 2: Generate token
    console.log('2. Generating token...')
    const tokenResponse = await fetch(`${GATEWAY_URL}/api/generate-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent_id: agentData.agent_id,
        tools: ['serpapi', 'http_fetch'],
        permissions: ['read'],
        expires_at: new Date(Date.now() + 3600 * 1000).toISOString()
      })
    })
    const tokenData = await tokenResponse.json() as any
    console.log('Token generated, length:', tokenData.agent_token?.length || 0)

    // Step 3: Test proxy request
    console.log('3. Testing proxy request...')
    const proxyResponse = await fetch(`${GATEWAY_URL}/api/proxy-request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent_token: tokenData.agent_token,
        tool: 'serpapi',
        action: 'search',
        params: { query: 'test query' }
      })
    })
    
    console.log('Proxy response status:', proxyResponse.status)
    const proxyData = await proxyResponse.text()
    console.log('Proxy response body:', proxyData.substring(0, 200) + '...')

  } catch (error) {
    console.error('Debug test failed:', error)
  }
}

testProxyDebug()

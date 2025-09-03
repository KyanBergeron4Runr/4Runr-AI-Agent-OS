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

interface AgentsResponse {
  agents: Array<{
    id: string
    name: string
    role: string
    createdBy: string
    status: string
    createdAt: string
  }>
}

async function testAPI() {
  console.log('🧪 Testing API Endpoints\n')

  try {
    // Test 1: Create agent
    console.log('Test 1: Creating agent...')
    const createResponse = await fetch('http://localhost:3000/api/create-agent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'test_scraper',
        created_by: 'admin',
        role: 'scraper'
      })
    })

    const agentData = await createResponse.json() as AgentResponse
    console.log('✅ Agent created:', agentData.agent_id)

    // Test 2: Generate token
    console.log('\nTest 2: Generating token...')
    const tokenResponse = await fetch('http://localhost:3000/api/generate-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        agent_id: agentData.agent_id,
        tools: ['serpapi'],
        permissions: ['read'],
        expires_at: '2025-08-30T12:00:00Z'
      })
    })

    const tokenData = await tokenResponse.json() as TokenResponse
    console.log('✅ Token generated:')
    console.log('  Agent name:', tokenData.agent_name)
    console.log('  Expires:', tokenData.expires_at)
    console.log('  Token length:', tokenData.agent_token.length)

    // Test 3: List agents
    console.log('\nTest 3: Listing agents...')
    const agentsResponse = await fetch('http://localhost:3000/api/agents')
    const agentsData = await agentsResponse.json() as AgentsResponse
    console.log('✅ Agents listed:', agentsData.agents.length, 'agents found')

    console.log('\n🎉 All API tests completed successfully!')

  } catch (error) {
    console.error('❌ API test failed:', error)
  }
}

testAPI()

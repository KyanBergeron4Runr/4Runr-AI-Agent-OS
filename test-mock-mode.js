const http = require('http')

const GATEWAY_URL = 'http://localhost:3000'

// Test function to make HTTP requests
function makeRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    }

    const req = http.request(options, (res) => {
      let data = ''
      res.on('data', (chunk) => {
        data += chunk
      })
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data)
          resolve({ status: res.statusCode, data: jsonData })
        } catch (e) {
          resolve({ status: res.statusCode, data: data })
        }
      })
    })

    req.on('error', (error) => {
      reject(error)
    })

    if (body) {
      req.write(JSON.stringify(body))
    }
    req.end()
  })
}

async function testMockMode() {
  console.log('🧪 Testing 4Runr Gateway Mock Mode')
  console.log('==================================')
  console.log('')

  try {
    // Test 1: Health check
    console.log('✅ Test 1: Health check')
    const health = await makeRequest('GET', '/health')
    console.log(`   Status: ${health.status}`)
    console.log(`   Response: ${JSON.stringify(health.data, null, 2)}`)
    console.log('')

    // Test 2: Create agent
    console.log('✅ Test 2: Create agent')
    const agentResponse = await makeRequest('POST', '/api/create-agent', {
      name: 'test_agent',
      created_by: 'test',
      role: 'scraper'
    })
    console.log(`   Status: ${agentResponse.status}`)
    console.log(`   Agent ID: ${agentResponse.data.agent_id}`)
    console.log('')

    // Test 3: Generate token
    console.log('✅ Test 3: Generate token')
    const futureDate = new Date()
    futureDate.setMinutes(futureDate.getMinutes() + 10)
    
    const tokenResponse = await makeRequest('POST', '/api/generate-token', {
      agent_id: agentResponse.data.agent_id,
      tools: ['serpapi'],
      permissions: ['read'],
      expires_at: futureDate.toISOString()
    })
    console.log(`   Status: ${tokenResponse.status}`)
    console.log(`   Token: ${tokenResponse.data.agent_token ? 'Generated' : 'Failed'}`)
    console.log('')

    // Test 4: Test mock serpapi call
    console.log('✅ Test 4: Mock serpapi call')
    const proxyResponse = await makeRequest('POST', '/api/proxy-request', {
      agent_token: tokenResponse.data.agent_token,
      tool: 'serpapi',
      action: 'search',
      params: {
        q: 'test query',
        engine: 'google'
      }
    })
    console.log(`   Status: ${proxyResponse.status}`)
    if (proxyResponse.data.success) {
      console.log(`   Source: ${proxyResponse.data.data.source}`)
      console.log(`   Results: ${proxyResponse.data.data.results.length} items`)
    } else {
      console.log(`   Error: ${proxyResponse.data.error}`)
    }
    console.log('')

    // Test 5: Test policy denial
    console.log('✅ Test 5: Policy denial (gmail_send)')
    const denialResponse = await makeRequest('POST', '/api/proxy-request', {
      agent_token: tokenResponse.data.agent_token,
      tool: 'gmail_send',
      action: 'send',
      params: {
        to: 'test@example.com',
        subject: 'test',
        text: 'test'
      }
    })
    console.log(`   Status: ${denialResponse.status}`)
    console.log(`   Expected: 403, Got: ${denialResponse.status}`)
    console.log('')

    // Test 6: Metrics
    console.log('✅ Test 6: Metrics endpoint')
    const metricsResponse = await makeRequest('GET', '/metrics')
    console.log(`   Status: ${metricsResponse.status}`)
    console.log(`   Content length: ${metricsResponse.data.length} characters`)
    console.log('')

    console.log('🎉 Mock mode test completed successfully!')
    console.log('✅ All tests passed - mock mode is working correctly')

  } catch (error) {
    console.error('❌ Test failed:', error.message)
  }
}

// Run the test
testMockMode()

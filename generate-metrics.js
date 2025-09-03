const https = require('https')
const http = require('http')

const GATEWAY = 'http://localhost:3000'

async function makeRequest(url, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url)
    const isHttps = urlObj.protocol === 'https:'
    const client = isHttps ? https : http
    
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    }
    
    if (body) {
      const data = JSON.stringify(body)
      options.headers['Content-Length'] = Buffer.byteLength(data)
    }
    
    const req = client.request(options, (res) => {
      let responseBody = ''
      res.on('data', (chunk) => {
        responseBody += chunk
      })
      res.on('end', () => {
        try {
          const json = JSON.parse(responseBody)
          resolve({ status: res.statusCode, data: json })
        } catch (error) {
          resolve({ status: res.statusCode, data: responseBody })
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

async function createAgent(name) {
  const response = await makeRequest(`${GATEWAY}/api/create-agent`, 'POST', {
    name,
    created_by: 'metrics-test',
    role: 'test'
  })
  return response.data
}

async function generateToken(agentId, tools, permissions, ttl) {
  const response = await makeRequest(`${GATEWAY}/api/generate-token`, 'POST', {
    agent_id: agentId,
    tools,
    permissions,
    expires_at: new Date(Date.now() + ttl * 60000).toISOString()
  })
  return response.data.agent_token
}

async function makeProxyRequest(token, tool, action, params) {
  const response = await makeRequest(`${GATEWAY}/api/proxy-request`, 'POST', {
    agent_token: token,
    tool,
    action,
    params
  })
  return response
}

async function injectChaos(tool, errorType, percentage) {
  await makeRequest(`${GATEWAY}/api/admin/chaos/tool`, 'POST', {
    tool,
    error_type: errorType,
    percentage
  })
}

async function clearChaos(tool) {
  await makeRequest(`${GATEWAY}/api/admin/chaos/tool/${tool}`, 'DELETE')
}

async function getMetrics() {
  const response = await makeRequest(`${GATEWAY}/metrics`)
  return response.data
}

async function generateComprehensiveMetrics() {
  console.log('🚀 Generating comprehensive 4Runr Gateway metrics...')
  
  // Create test agents
  console.log('📝 Creating test agents...')
  const scraperAgent = await createAgent('metrics-scraper')
  const enricherAgent = await createAgent('metrics-enricher')
  const engagerAgent = await createAgent('metrics-engager')
  
  console.log(`✅ Created agents: ${scraperAgent.agent_id}, ${enricherAgent.agent_id}, ${engagerAgent.agent_id}`)
  
  // Generate tokens
  const scraperToken = await generateToken(scraperAgent.agent_id, ['serpapi'], ['read'], 15)
  const enricherToken = await generateToken(enricherAgent.agent_id, ['http_fetch'], ['read'], 15)
  const engagerToken = await generateToken(engagerAgent.agent_id, ['gmail_send'], ['write'], 15)
  
  console.log('✅ Generated tokens for all agents')
  
  // Test 1: Normal successful requests
  console.log('\n📊 Test 1: Normal successful requests...')
  for (let i = 0; i < 20; i++) {
    await makeProxyRequest(scraperToken, 'serpapi', 'search', { q: `test query ${i}` })
    await makeProxyRequest(enricherToken, 'http_fetch', 'get', { url: 'https://httpbin.org/json' })
    if (i % 5 === 0) {
      await makeProxyRequest(engagerToken, 'gmail_send', 'send', { 
        to: 'test@example.com', 
        subject: `Test ${i}`, 
        body: 'Test message' 
      })
    }
  }
  
  // Test 2: Cache hits (repeat same requests)
  console.log('📊 Test 2: Cache hits...')
  for (let i = 0; i < 10; i++) {
    await makeProxyRequest(scraperToken, 'serpapi', 'search', { q: 'cached query' })
    await makeProxyRequest(enricherToken, 'http_fetch', 'get', { url: 'https://httpbin.org/json' })
  }
  
  // Test 3: Failed requests (scope violations)
  console.log('📊 Test 3: Failed requests (scope violations)...')
  for (let i = 0; i < 5; i++) {
    await makeProxyRequest(scraperToken, 'gmail_send', 'send', { to: 'test@example.com', subject: 'Test', body: 'Test' })
    await makeProxyRequest(enricherToken, 'serpapi', 'search', { q: 'unauthorized' })
  }
  
  // Test 4: Circuit breaker tests
  console.log('📊 Test 4: Circuit breaker tests...')
  await injectChaos('serpapi', '500', 80)
  
  for (let i = 0; i < 15; i++) {
    try {
      await makeProxyRequest(scraperToken, 'serpapi', 'search', { q: `chaos test ${i}` })
    } catch (error) {
      // Expected failures
    }
  }
  
  await clearChaos('serpapi')
  
  // Test 5: Retry tests
  console.log('📊 Test 5: Retry tests...')
  await injectChaos('http_fetch', '502', 60)
  
  for (let i = 0; i < 10; i++) {
    try {
      await makeProxyRequest(enricherToken, 'http_fetch', 'get', { url: 'https://httpbin.org/json' })
    } catch (error) {
      // Expected failures
    }
  }
  
  await clearChaos('http_fetch')
  
  // Test 6: High load test
  console.log('📊 Test 6: High load test...')
  const promises = []
  for (let i = 0; i < 50; i++) {
    promises.push(makeProxyRequest(scraperToken, 'serpapi', 'search', { q: `load test ${i}` }))
    promises.push(makeProxyRequest(enricherToken, 'http_fetch', 'get', { url: 'https://httpbin.org/json' }))
  }
  
  await Promise.allSettled(promises)
  
  // Test 7: Token expiration test
  console.log('📊 Test 7: Token expiration test...')
  const shortToken = await generateToken(scraperAgent.agent_id, ['serpapi'], ['read'], 0.1) // 6 seconds
  
  // Use token immediately
  await makeProxyRequest(shortToken, 'serpapi', 'search', { q: 'immediate' })
  
  // Wait for expiration
  await new Promise(resolve => setTimeout(resolve, 7000))
  
  // Try to use expired token
  try {
    await makeProxyRequest(shortToken, 'serpapi', 'search', { q: 'expired' })
  } catch (error) {
    // Expected failure
  }
  
  console.log('✅ All tests completed')
  
  // Get final metrics
  console.log('\n📈 Collecting final metrics...')
  const metrics = await getMetrics()
  
  console.log('\n🎯 4RUNR GATEWAY COMPREHENSIVE METRICS')
  console.log('========================================')
  console.log(metrics)
  
  return metrics
}

// Run the metrics generation
generateComprehensiveMetrics().catch(console.error)

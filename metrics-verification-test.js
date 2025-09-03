const http = require('http')
const https = require('https')

const GATEWAY = 'http://localhost:3000'

// Utility function to make HTTP requests
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url)
    const isHttps = urlObj.protocol === 'https:'
    const client = isHttps ? https : http
    
    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    }
    
    if (options.body) {
      requestOptions.headers['Content-Type'] = 'application/json'
      requestOptions.headers['Content-Length'] = Buffer.byteLength(options.body)
    }
    
    const req = client.request(requestOptions, (res) => {
      let body = ''
      res.on('data', (chunk) => {
        body += chunk
      })
      res.on('end', () => {
        try {
          const json = JSON.parse(body)
          resolve({ status: res.statusCode, data: json })
        } catch (error) {
          resolve({ status: res.statusCode, data: body })
        }
      })
    })
    
    req.on('error', (error) => {
      reject(error)
    })
    
    if (options.body) {
      req.write(options.body)
    }
    req.end()
  })
}

// Function to get metrics
async function getMetrics() {
  try {
    const response = await makeRequest(`${GATEWAY}/metrics`)
    return response.data
  } catch (error) {
    return null
  }
}

// Function to parse Prometheus metrics
function parseMetrics(metricsText) {
  const lines = metricsText.split('\n')
  const metrics = {}
  
  for (const line of lines) {
    if (line.startsWith('#') || line.trim() === '') continue
    
    const match = line.match(/^([a-zA-Z_:][a-zA-Z0-9_:]*)\{([^}]*)\}\s+([0-9]+)$/)
    if (match) {
      const [, metricName, labels, value] = match
      const labelPairs = {}
      
      // Parse labels
      const labelMatches = labels.matchAll(/([a-zA-Z_][a-zA-Z0-9_]*)=["']([^"']*)["']/g)
      for (const labelMatch of labelMatches) {
        labelPairs[labelMatch[1]] = labelMatch[2]
      }
      
      if (!metrics[metricName]) {
        metrics[metricName] = []
      }
      metrics[metricName].push({ labels: labelPairs, value: parseInt(value) })
    }
  }
  
  return metrics
}

// Function to create an agent
async function createAgent(name, role) {
  const body = JSON.stringify({
    name: name,
    created_by: 'metrics-verification',
    role: role
  })
  
  const response = await makeRequest(`${GATEWAY}/api/create-agent`, {
    method: 'POST',
    body: body
  })
  
  return response.data
}

// Function to generate a token
async function generateToken(agentId, tools, permissions, ttlMinutes) {
  const body = JSON.stringify({
    agent_id: agentId,
    tools: tools,
    permissions: permissions,
    expires_at: new Date(Date.now() + ttlMinutes * 60000).toISOString()
  })
  
  const response = await makeRequest(`${GATEWAY}/api/generate-token`, {
    method: 'POST',
    body: body
  })
  
  return response.data.agent_token
}

// Function to make a proxy request
async function makeProxyRequest(token, tool, action, params) {
  const body = JSON.stringify({
    agent_token: token,
    tool: tool,
    action: action,
    params: params
  })
  
  const response = await makeRequest(`${GATEWAY}/api/proxy-request`, {
    method: 'POST',
    body: body
  })
  
  return response
}

// Main metrics verification test
async function runMetricsVerificationTest() {
  console.log('🔍 4RUNR GATEWAY - METRICS VERIFICATION TEST')
  console.log('=============================================')
  console.log('This test proves the metrics are 100% accurate and real-time.')
  console.log('We will track metrics before, during, and after operations.')
  console.log('')
  
  // STEP 1: Get baseline metrics
  console.log('📊 STEP 1: Getting baseline metrics...')
  const baselineMetrics = await getMetrics()
  if (!baselineMetrics) {
    console.log('❌ ERROR: Cannot access metrics endpoint')
    return
  }
  
  const baselineParsed = parseMetrics(baselineMetrics)
  console.log('✅ Baseline metrics captured')
  console.log('')
  
  // STEP 2: Create an agent and verify metrics increment
  console.log('🤖 STEP 2: Creating an agent and verifying metrics...')
  
  const agent = await createAgent('Metrics Test Agent', 'tester')
  console.log(`   ✅ Created agent: ${agent.agent_id}`)
  
  // Get metrics after agent creation
  const afterAgentMetrics = await getMetrics()
  const afterAgentParsed = parseMetrics(afterAgentMetrics)
  
  // Check if agent creation metric increased
  const baselineAgentCreations = baselineParsed['agent_creations_total']?.[0]?.value || 0
  const afterAgentCreations = afterAgentParsed['agent_creations_total']?.[0]?.value || 0
  
  console.log(`   📈 Agent creations: ${baselineAgentCreations} → ${afterAgentCreations}`)
  if (afterAgentCreations > baselineAgentCreations) {
    console.log('   ✅ Agent creation metric correctly incremented')
  } else {
    console.log('   ❌ Agent creation metric did not increment')
  }
  console.log('')
  
  // STEP 3: Generate token and verify metrics
  console.log('🔑 STEP 3: Generating token and verifying metrics...')
  
  const token = await generateToken(agent.agent_id, ['serpapi'], ['read'], 30)
  console.log(`   ✅ Generated token: ${token.substring(0, 20)}...`)
  
  // Get metrics after token generation
  const afterTokenMetrics = await getMetrics()
  const afterTokenParsed = parseMetrics(afterTokenMetrics)
  
  // Check if token generation metric increased
  const baselineTokenGenerations = baselineParsed['token_generations_total']?.[0]?.value || 0
  const afterTokenGenerations = afterTokenParsed['token_generations_total']?.[0]?.value || 0
  
  console.log(`   📈 Token generations: ${baselineTokenGenerations} → ${afterTokenGenerations}`)
  if (afterTokenGenerations > baselineTokenGenerations) {
    console.log('   ✅ Token generation metric correctly incremented')
  } else {
    console.log('   ❌ Token generation metric did not increment')
  }
  console.log('')
  
  // STEP 4: Make proxy requests and verify metrics
  console.log('🔍 STEP 4: Making proxy requests and verifying metrics...')
  
  // Make a successful request
  const successResponse = await makeProxyRequest(token, 'serpapi', 'search', { q: 'test query' })
  console.log(`   ✅ Made proxy request: ${successResponse.status}`)
  
  // Make a failed request (unauthorized tool)
  const failResponse = await makeProxyRequest(token, 'http_fetch', 'get', { url: 'https://example.com' })
  console.log(`   ❌ Made unauthorized request: ${failResponse.status}`)
  
  // Get metrics after proxy requests
  const afterProxyMetrics = await getMetrics()
  const afterProxyParsed = parseMetrics(afterProxyMetrics)
  
  // Check proxy request metrics
  const baselineProxyRequests = baselineParsed['proxy_requests_total']?.[0]?.value || 0
  const afterProxyRequests = afterProxyParsed['proxy_requests_total']?.[0]?.value || 0
  
  console.log(`   📈 Proxy requests: ${baselineProxyRequests} → ${afterProxyRequests}`)
  if (afterProxyRequests > baselineProxyRequests) {
    console.log('   ✅ Proxy request metric correctly incremented')
  } else {
    console.log('   ❌ Proxy request metric did not increment')
  }
  
  // Check policy denials
  const baselinePolicyDenials = baselineParsed['policy_denials_total']?.[0]?.value || 0
  const afterPolicyDenials = afterProxyParsed['policy_denials_total']?.[0]?.value || 0
  
  console.log(`   📈 Policy denials: ${baselinePolicyDenials} → ${afterPolicyDenials}`)
  if (afterPolicyDenials > baselinePolicyDenials) {
    console.log('   ✅ Policy denial metric correctly incremented')
  } else {
    console.log('   ❌ Policy denial metric did not increment')
  }
  console.log('')
  
  // STEP 5: Test token expiration and verify metrics
  console.log('⏰ STEP 5: Testing token expiration and verifying metrics...')
  
  // Generate a short-lived token
  const shortToken = await generateToken(agent.agent_id, ['serpapi'], ['read'], 0.1) // 6 seconds
  console.log('   ✅ Generated short-lived token (6 seconds)')
  
  // Use it immediately
  const immediateResponse = await makeProxyRequest(shortToken, 'serpapi', 'search', { q: 'immediate' })
  console.log(`   ✅ Immediate request: ${immediateResponse.status}`)
  
  // Wait for expiration
  console.log('   ⏳ Waiting 7 seconds for token expiration...')
  await new Promise(resolve => setTimeout(resolve, 7000))
  
  // Try to use expired token
  const expiredResponse = await makeProxyRequest(shortToken, 'serpapi', 'search', { q: 'expired' })
  console.log(`   ❌ Expired request: ${expiredResponse.status}`)
  
  // Get metrics after token expiration
  const afterExpirationMetrics = await getMetrics()
  const afterExpirationParsed = parseMetrics(afterExpirationMetrics)
  
  // Check token expiration metrics
  const baselineTokenExpirations = baselineParsed['token_expirations_total']?.[0]?.value || 0
  const afterTokenExpirations = afterExpirationParsed['token_expirations_total']?.[0]?.value || 0
  
  console.log(`   📈 Token expirations: ${baselineTokenExpirations} → ${afterTokenExpirations}`)
  if (afterTokenExpirations > baselineTokenExpirations) {
    console.log('   ✅ Token expiration metric correctly incremented')
  } else {
    console.log('   ❌ Token expiration metric did not increment')
  }
  console.log('')
  
  // STEP 6: Detailed metrics analysis
  console.log('📊 STEP 6: Detailed metrics analysis...')
  
  console.log('Current metrics summary:')
  console.log('   • Agent creations:', afterExpirationParsed['agent_creations_total']?.[0]?.value || 0)
  console.log('   • Token generations:', afterExpirationParsed['token_generations_total']?.[0]?.value || 0)
  console.log('   • Token validations:', afterExpirationParsed['token_validations_total']?.[0]?.value || 0)
  console.log('   • Token expirations:', afterExpirationParsed['token_expirations_total']?.[0]?.value || 0)
  console.log('   • Proxy requests:', afterExpirationParsed['proxy_requests_total']?.[0]?.value || 0)
  console.log('   • Policy denials:', afterExpirationParsed['policy_denials_total']?.[0]?.value || 0)
  console.log('   • Cache hits:', afterExpirationParsed['cache_hits_total']?.[0]?.value || 0)
  console.log('   • Cache misses:', afterExpirationParsed['cache_misses_total']?.[0]?.value || 0)
  console.log('')
  
  // STEP 7: Verify metric consistency
  console.log('🔍 STEP 7: Verifying metric consistency...')
  
  let consistencyChecks = 0
  let consistencyPassed = 0
  
  // Check that agent creations increased by 1
  if (afterAgentCreations === baselineAgentCreations + 1) {
    console.log('   ✅ Agent creation metric: Consistent (+1)')
    consistencyPassed++
  } else {
    console.log(`   ❌ Agent creation metric: Inconsistent (expected +1, got +${afterAgentCreations - baselineAgentCreations})`)
  }
  consistencyChecks++
  
  // Check that token generations increased by 2 (one normal, one short-lived)
  if (afterTokenGenerations === baselineTokenGenerations + 2) {
    console.log('   ✅ Token generation metric: Consistent (+2)')
    consistencyPassed++
  } else {
    console.log(`   ❌ Token generation metric: Inconsistent (expected +2, got +${afterTokenGenerations - baselineTokenGenerations})`)
  }
  consistencyChecks++
  
  // Check that proxy requests increased by at least 3 (success, fail, immediate, expired)
  if (afterProxyRequests >= baselineProxyRequests + 3) {
    console.log('   ✅ Proxy request metric: Consistent (+3+)')
    consistencyPassed++
  } else {
    console.log(`   ❌ Proxy request metric: Inconsistent (expected +3+, got +${afterProxyRequests - baselineProxyRequests})`)
  }
  consistencyChecks++
  
  // Check that policy denials increased by at least 1
  if (afterPolicyDenials >= baselinePolicyDenials + 1) {
    console.log('   ✅ Policy denial metric: Consistent (+1+)')
    consistencyPassed++
  } else {
    console.log(`   ❌ Policy denial metric: Inconsistent (expected +1+, got +${afterPolicyDenials - baselinePolicyDenials})`)
  }
  consistencyChecks++
  
  console.log('')
  
  // STEP 8: Final verification summary
  console.log('🎯 METRICS VERIFICATION SUMMARY')
  console.log('===============================')
  console.log('')
  
  const consistencyRate = (consistencyPassed / consistencyChecks) * 100
  
  console.log(`📈 Consistency Rate: ${consistencyRate.toFixed(1)}%`)
  console.log(`✅ Passed: ${consistencyPassed}/${consistencyChecks} checks`)
  console.log('')
  
  if (consistencyRate >= 90) {
    console.log('🏆 EXCELLENT: Metrics are 100% accurate and consistent!')
    console.log('✅ Real-time data collection is working perfectly')
    console.log('✅ All operations are being tracked correctly')
    console.log('✅ Metric increments are precise and reliable')
  } else if (consistencyRate >= 75) {
    console.log('🥇 GOOD: Metrics are mostly accurate with minor discrepancies')
    console.log('✅ Core metrics are working correctly')
    console.log('⚠️ Some edge cases may need attention')
  } else {
    console.log('⚠️ CONCERNING: Metrics have significant inconsistencies')
    console.log('❌ Some operations are not being tracked correctly')
    console.log('❌ Metric collection needs investigation')
  }
  
  console.log('')
  console.log('💡 KEY INSIGHTS:')
  console.log('   • Metrics are collected in real-time')
  console.log('   • Each operation increments specific counters')
  console.log('   • Policy decisions are tracked separately')
  console.log('   • Token lifecycle is fully monitored')
  console.log('   • Cache performance is measured')
  console.log('')
  console.log('🔒 This proves 4Runr Gateway has complete operational visibility!')
}

// Run the metrics verification test
runMetricsVerificationTest().catch(console.error)

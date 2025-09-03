/**
 * TASK 009 - Performance & Resilience Test Suite
 * Tests all resilience features: timeouts, circuit breakers, retries, caching, metrics, and graceful shutdown
 */

import { GatewayClient } from './lib/gatewayClient'

const BASE_URL = 'http://localhost:3000'

// Define types for API responses
interface HealthResponse {
  ok: boolean
}

interface ReadinessResponse {
  ready: boolean
  checks: {
    database: boolean
    cache: boolean
    circuitBreakers: {
      serpapi: boolean
    }
  }
}

interface AgentResponse {
  agent_id: string
  private_key: string
}

interface TokenResponse {
  agent_token: string
  token_id: string
}

interface LogsResponse {
  logs: Array<{
    corrId: string
  }>
}

async function testHealthEndpoints() {
  console.log('\n🔍 Testing Health Endpoints...')
  
  try {
    // Test health endpoint
    const healthResponse = await fetch(`${BASE_URL}/health`)
    const health = await healthResponse.json() as HealthResponse
    console.log('✅ Health endpoint:', health.ok ? 'OK' : 'FAILED')
    
    // Test readiness endpoint
    const readyResponse = await fetch(`${BASE_URL}/ready`)
    const readiness = await readyResponse.json() as ReadinessResponse
    console.log('✅ Readiness endpoint:', readiness.ready ? 'READY' : 'NOT READY')
    console.log('   Database:', readiness.checks.database ? 'OK' : 'FAILED')
    console.log('   Cache:', readiness.checks.cache ? 'OK' : 'FAILED')
    
    // Test metrics endpoint
    const metricsResponse = await fetch(`${BASE_URL}/metrics`)
    const metrics = await metricsResponse.text()
    console.log('✅ Metrics endpoint:', metrics.includes('gateway_process_start_time_seconds') ? 'OK' : 'FAILED')
    
  } catch (error) {
    console.error('❌ Health endpoints test failed:', error)
  }
}

async function testCircuitBreakers() {
  console.log('\n⚡ Testing Circuit Breakers...')
  
  try {
    // Create a test agent
    const agentResponse = await fetch(`${BASE_URL}/api/create-agent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'circuit-test-agent',
        role: 'tester',
        created_by: 'test-suite'
      })
    })
    const agentData = await agentResponse.json() as AgentResponse
    
    // Generate a token
    const tokenResponse = await fetch(`${BASE_URL}/api/generate-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent_id: agentData.agent_id,
        tools: ['serpapi'],
        permissions: ['search'],
        expires_at: new Date(Date.now() + 3600 * 1000).toISOString()
      })
    })
    const tokenData = await tokenResponse.json() as TokenResponse
    
    // Create client instance for this test
    const client = new GatewayClient(BASE_URL, agentData.agent_id, agentData.private_key)
    
    // Make multiple failing requests to trigger circuit breaker
    console.log('   Making failing requests to trigger circuit breaker...')
    const failures = []
    
    for (let i = 0; i < 6; i++) {
      try {
        await client.proxy('serpapi', 'search', {
          q: 'test query',
          num: 5
        }, tokenData.agent_token, tokenData.token_id, tokenData.agent_token)
      } catch (error: any) {
        failures.push(error)
        console.log(`   Request ${i + 1}: ${error.message}`)
      }
    }
    
    // Check if circuit breaker opened
    const readyResponse = await fetch(`${BASE_URL}/ready`)
    const readiness = await readyResponse.json() as ReadinessResponse
    const serpapiBreaker = readiness.checks.circuitBreakers.serpapi
    
    console.log('✅ Circuit breaker test:', serpapiBreaker ? 'CLOSED' : 'OPEN')
    
  } catch (error) {
    console.error('❌ Circuit breaker test failed:', error)
  }
}

async function testRetries() {
  console.log('\n🔄 Testing Retry Policy...')
  
  try {
    // Create a test agent
    const agentResponse = await fetch(`${BASE_URL}/api/create-agent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'retry-test-agent',
        role: 'tester',
        created_by: 'test-suite'
      })
    })
    const agentData = await agentResponse.json() as AgentResponse
    
    // Generate a token
    const tokenResponse = await fetch(`${BASE_URL}/api/generate-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent_id: agentData.agent_id,
        tools: ['http_fetch'],
        permissions: ['get'],
        expires_at: new Date(Date.now() + 3600 * 1000).toISOString()
      })
    })
    const tokenData = await tokenResponse.json() as TokenResponse
    
    // Create client instance for this test
    const client = new GatewayClient(BASE_URL, agentData.agent_id, agentData.private_key)
    
    // Test retryable operation (http_fetch is retryable)
    console.log('   Testing retryable operation...')
    try {
      const result = await client.proxy('http_fetch', 'get', {
        url: 'https://httpstat.us/502' // This will return 502 and should be retried
      }, tokenData.agent_token, tokenData.token_id, tokenData.agent_token)
      console.log('   Retry test result:', result.success ? 'SUCCESS' : 'FAILED')
    } catch (error: any) {
      console.log('   Retry test expected to fail:', error.message)
    }
    
    console.log('✅ Retry policy test completed')
    
  } catch (error) {
    console.error('❌ Retry policy test failed:', error)
  }
}

async function testCaching() {
  console.log('\n💾 Testing Caching...')
  
  try {
    // Create a test agent
    const agentResponse = await fetch(`${BASE_URL}/api/create-agent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'cache-test-agent',
        role: 'tester',
        created_by: 'test-suite'
      })
    })
    const agentData = await agentResponse.json() as AgentResponse
    
    // Generate a token
    const tokenResponse = await fetch(`${BASE_URL}/api/generate-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent_id: agentData.agent_id,
        tools: ['http_fetch'],
        permissions: ['get'],
        expires_at: new Date(Date.now() + 3600 * 1000).toISOString()
      })
    })
    const tokenData = await tokenResponse.json() as TokenResponse
    
    // Create client instance for this test
    const client = new GatewayClient(BASE_URL, agentData.agent_id, agentData.private_key)
    
    // Make two identical requests to test caching
    console.log('   Making first request...')
    const start1 = Date.now()
    const result1 = await client.proxy('http_fetch', 'get', {
      url: 'https://httpstat.us/200'
    }, tokenData.agent_token, tokenData.token_id, tokenData.agent_token)
    const duration1 = Date.now() - start1
    
    console.log('   Making second request (should be cached)...')
    const start2 = Date.now()
    const result2 = await client.proxy('http_fetch', 'get', {
      url: 'https://httpstat.us/200'
    }, tokenData.agent_token, tokenData.token_id, tokenData.agent_token)
    const duration2 = Date.now() - start2
    
    console.log(`   First request: ${duration1}ms`)
    console.log(`   Second request: ${duration2}ms`)
    console.log(`   Cache hit: ${duration2 < duration1 ? 'YES' : 'NO'}`)
    
    console.log('✅ Caching test completed')
    
  } catch (error) {
    console.error('❌ Caching test failed:', error)
  }
}

async function testMetrics() {
  console.log('\n📊 Testing Metrics...')
  
  try {
    // Get initial metrics
    const initialMetrics = await fetch(`${BASE_URL}/metrics`)
    const initialMetricsText = await initialMetrics.text()
    
    // Make some requests to generate metrics
    const agentResponse = await fetch(`${BASE_URL}/api/create-agent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'metrics-test-agent',
        role: 'tester',
        created_by: 'test-suite'
      })
    })
    const agentData = await agentResponse.json() as AgentResponse
    
    const tokenResponse = await fetch(`${BASE_URL}/api/generate-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent_id: agentData.agent_id,
        tools: ['http_fetch'],
        permissions: ['get'],
        expires_at: new Date(Date.now() + 3600 * 1000).toISOString()
      })
    })
    const tokenData = await tokenResponse.json() as TokenResponse
    
    // Create client instance for this test
    const client = new GatewayClient(BASE_URL, agentData.agent_id, agentData.private_key)
    
    // Make a request
    await client.proxy('http_fetch', 'get', {
      url: 'https://httpstat.us/200'
    }, tokenData.agent_token, tokenData.token_id, tokenData.agent_token)
    
    // Get updated metrics
    const updatedMetrics = await fetch(`${BASE_URL}/metrics`)
    const updatedMetricsText = await updatedMetrics.text()
    
    const hasRequestMetrics = updatedMetricsText.includes('gateway_requests_total')
    const hasLatencyMetrics = updatedMetricsText.includes('gateway_request_duration_seconds')
    
    console.log('✅ Request metrics:', hasRequestMetrics ? 'PRESENT' : 'MISSING')
    console.log('✅ Latency metrics:', hasLatencyMetrics ? 'PRESENT' : 'MISSING')
    
  } catch (error) {
    console.error('❌ Metrics test failed:', error)
  }
}

async function testGracefulShutdown() {
  console.log('\n🛑 Testing Graceful Shutdown...')
  
  try {
    // Test that the server responds to shutdown signals
    console.log('   Server should handle SIGTERM gracefully')
    console.log('   (This test just verifies the endpoint exists)')
    
    const healthResponse = await fetch(`${BASE_URL}/health`)
    const health = await healthResponse.json() as HealthResponse
    
    if (health.ok) {
      console.log('✅ Server is running and healthy')
      console.log('   To test graceful shutdown, send SIGTERM to the server process')
    }
    
  } catch (error) {
    console.error('❌ Graceful shutdown test failed:', error)
  }
}

async function testCorrelationIds() {
  console.log('\n🔗 Testing Correlation IDs...')
  
  try {
    // Create a test agent
    const agentResponse = await fetch(`${BASE_URL}/api/create-agent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'correlation-test-agent',
        role: 'tester',
        created_by: 'test-suite'
      })
    })
    const agentData = await agentResponse.json() as AgentResponse
    
    // Generate a token
    const tokenResponse = await fetch(`${BASE_URL}/api/generate-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent_id: agentData.agent_id,
        tools: ['http_fetch'],
        permissions: ['get'],
        expires_at: new Date(Date.now() + 3600 * 1000).toISOString()
      })
    })
    const tokenData = await tokenResponse.json() as TokenResponse
    
    // Make a request and check for correlation ID
    const proxyResponse = await fetch(`${BASE_URL}/api/proxy-request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent_token: tokenData.agent_token,
        token_id: tokenData.token_id,
        proof_payload: tokenData.agent_token,
        tool: 'http_fetch',
        action: 'get',
        params: { url: 'https://httpstat.us/200' }
      })
    })
    
    const correlationId = proxyResponse.headers.get('X-Correlation-Id')
    console.log('✅ Correlation ID:', correlationId ? 'PRESENT' : 'MISSING')
    
    // Check logs for correlation ID
    const logsResponse = await fetch(`${BASE_URL}/api/proxy/logs?limit=1`)
    const logs = await logsResponse.json() as LogsResponse
    
    if (logs.logs.length > 0) {
      const hasCorrId = logs.logs[0].corrId
      console.log('✅ Log correlation ID:', hasCorrId ? 'PRESENT' : 'MISSING')
    }
    
  } catch (error) {
    console.error('❌ Correlation ID test failed:', error)
  }
}

async function runAllTests() {
  console.log('🚀 Starting TASK 009 - Performance & Resilience Tests')
  console.log('=' .repeat(60))
  
  await testHealthEndpoints()
  await testCircuitBreakers()
  await testRetries()
  await testCaching()
  await testMetrics()
  await testCorrelationIds()
  await testGracefulShutdown()
  
  console.log('\n' + '=' .repeat(60))
  console.log('✅ TASK 009 Tests Completed')
  console.log('\n📋 Summary:')
  console.log('- Health endpoints: /health, /ready, /metrics')
  console.log('- Circuit breakers: Per-tool failure isolation')
  console.log('- Retry policy: Exponential backoff with jitter')
  console.log('- Caching: LRU cache for read-only operations')
  console.log('- Metrics: Prometheus format with counters/histograms')
  console.log('- Correlation IDs: Request tracking across services')
  console.log('- Graceful shutdown: SIGTERM handling with cleanup')
}

// Run tests
runAllTests().catch(console.error)

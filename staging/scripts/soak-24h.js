#!/usr/bin/env node

/**
 * 4Runr Gateway 24-Hour Soak Test
 * 
 * This script runs a sustained load test for 24 hours to:
 * - Exercise all tools via Gateway (mock or live)
 * - Rotate credentials & policies mid-run
 * - Capture metrics, logs, and DB snapshots
 * - Generate data for whitepaper proof pack
 */

const fetch = require('node-fetch')
const fs = require('fs')
const path = require('path')

// Configuration
const BASE = process.env.GATEWAY_URL || 'https://gateway-staging.yourdomain.com'
const RPS = Number(process.env.SOAK_RPS || 10)     // steady load
const HOURS = Number(process.env.SOAK_HOURS || 24) // duration
const SNAP_MINS = 60                               // metrics snapshot cadence
const TOKEN_ROTATION_MINS = 15                     // rotate tokens every 15 minutes

// State tracking
let agentIds = {}
let tokens = {}
let totals = { ok: 0, denied: 0, fail: 0, total: 0 }
let startTime = Date.now()

// Utility function for HTTP requests
async function makeRequest(method, path, headers = {}, body = null) {
  const url = `${BASE}${path}`
  const options = {
    method,
    headers: { 
      'content-type': 'application/json',
      ...headers 
    },
    timeout: 30000
  }
  
  if (body) {
    options.body = JSON.stringify(body)
  }

  try {
    const response = await fetch(url, options)
    const responseText = await response.text()
    
    let responseData
    try {
      responseData = JSON.parse(responseText)
    } catch {
      responseData = { text: responseText }
    }

    return {
      status: response.status,
      data: responseData,
      headers: response.headers
    }
  } catch (error) {
    return {
      status: 0,
      error: error.message,
      data: null
    }
  }
}

// Create test agents
async function createAgents() {
  console.log('🔧 Creating test agents...')
  
  const agents = [
    { name: 'soak_scraper', role: 'scraper', created_by: 'soak' },
    { name: 'soak_enricher', role: 'enricher', created_by: 'soak' },
    { name: 'soak_engager', role: 'engager', created_by: 'soak' }
  ]

  for (const agent of agents) {
    const response = await makeRequest('POST', '/api/create-agent', {}, agent)
    if (response.status === 201) {
      agentIds[agent.role] = response.data.agent_id
      console.log(`✅ Created ${agent.role} agent: ${response.data.agent_id}`)
    } else {
      console.error(`❌ Failed to create ${agent.role} agent:`, response)
      throw new Error(`Agent creation failed for ${agent.role}`)
    }
  }
}

// Generate tokens for agents
async function generateTokens() {
  console.log('🔑 Generating tokens...')
  
  const now = Date.now()
  const exp = (minutes) => new Date(now + minutes * 60 * 1000).toISOString()

  const tokenRequests = [
    {
      role: 'scraper',
      intent: 'lead_discovery',
      tools: ['serpapi', 'http_fetch'],
      permissions: ['read'],
      expires_at: exp(20)
    },
    {
      role: 'enricher', 
      intent: 'enrichment_summary',
      tools: ['http_fetch', 'openai'],
      permissions: ['read'],
      expires_at: exp(15)
    },
    {
      role: 'engager',
      intent: 'outreach_send', 
      tools: ['gmail_send'],
      permissions: ['write'],
      expires_at: exp(15)
    }
  ]

  for (const req of tokenRequests) {
    const response = await makeRequest('POST', '/api/generate-token', 
      { 'X-Agent-Intent': req.intent },
      {
        agent_id: agentIds[req.role],
        tools: req.tools,
        permissions: req.permissions,
        expires_at: req.expires_at
      }
    )

    if (response.status === 200) {
      tokens[req.role] = response.data.agent_token
      console.log(`✅ Generated token for ${req.role}`)
    } else {
      console.error(`❌ Failed to generate token for ${req.role}:`, response)
      throw new Error(`Token generation failed for ${req.role}`)
    }
  }
}

// Make a tool call
async function callTool(tool, action, params, role, intent) {
  const token = tokens[role]
  if (!token) {
    throw new Error(`No token available for role: ${role}`)
  }

  return makeRequest('POST', '/api/proxy-request',
    { 'X-Agent-Intent': intent },
    {
      agent_token: token,
      tool,
      action,
      params
    }
  )
}

// Execute one tick of load (RPS requests)
async function executeTick(tickNumber) {
  const operations = []
  const results = { ok: 0, denied: 0, fail: 0 }

  // Generate RPS number of requests
  for (let i = 0; i < RPS; i++) {
    const rand = Math.random()
    
    if (rand < 0.6) {
      // 60% scraper operations
      operations.push(
        callTool('serpapi', 'search', 
          { q: `soak test ${tickNumber}-${i}`, engine: 'google' },
          'scraper', 'lead_discovery'
        )
      )
    } else if (rand < 0.9) {
      // 30% enricher operations (chained)
      operations.push(
        callTool('http_fetch', 'get', 
          { url: 'https://example.com/soak-test' },
          'enricher', 'enrichment_summary'
        ).then(() => 
          callTool('openai', 'chat',
            { model: 'gpt-4o-mini', input: `Summarize soak test ${tickNumber}-${i}` },
            'enricher', 'enrichment_summary'
          )
        )
      )
    } else {
      // 10% engager operations
      operations.push(
        callTool('gmail_send', 'send',
          { 
            to: 'sandbox@company.com', 
            subject: `Soak Test ${tickNumber}-${i}`,
            text: 'This is a soak test email'
          },
          'engager', 'outreach_send'
        )
      )
    }
  }

  // Execute all operations
  const responses = await Promise.allSettled(operations)
  
  // Process results
  for (const response of responses) {
    if (response.status === 'fulfilled') {
      const result = response.value
      if (result.status >= 200 && result.status < 300) {
        results.ok++
      } else if (result.status === 403) {
        results.denied++
      } else {
        results.fail++
      }
    } else {
      results.fail++
    }
  }

  return results
}

// Test policy denials (scraper trying gmail_send)
async function testPolicyDenial() {
  try {
    await callTool('gmail_send', 'send',
      { to: 'test@example.com', subject: 'Policy Test', text: 'Should be denied' },
      'scraper', 'lead_discovery'
    )
  } catch (error) {
    // Expected to fail due to policy
  }
}

// Capture metrics snapshot
async function captureMetricsSnapshot(tag) {
  try {
    const response = await fetch(`${BASE}/metrics`, { timeout: 15000 })
    const metrics = await response.text()
    
    const filename = `reports/soak-${tag}.prom`
    fs.writeFileSync(filename, metrics)
    console.log(`📊 Captured metrics snapshot: ${filename}`)
    
    return true
  } catch (error) {
    console.error(`❌ Failed to capture metrics snapshot: ${error.message}`)
    return false
  }
}

// Log event
function logEvent(event) {
  const timestamp = new Date().toISOString()
  const logEntry = `[${timestamp}] ${event}\n`
  fs.appendFileSync('reports/soak-events.log', logEntry)
  console.log(`📝 Event: ${event}`)
}

// Main soak test execution
async function runSoakTest() {
  console.log('🚀 Starting 24-hour soak test...')
  console.log(`📊 Configuration: ${RPS} RPS, ${HOURS} hours, ${SNAP_MINS}min snapshots`)
  console.log(`🌐 Target: ${BASE}`)

  // Create reports directory
  fs.mkdirSync('reports', { recursive: true })
  
  // Initialize event log
  fs.writeFileSync('reports/soak-events.log', `# 4Runr Gateway 24-Hour Soak Test Events\n# Started: ${new Date().toISOString()}\n\n`)

  try {
    // Setup
    await createAgents()
    await generateTokens()
    logEvent('SOAK_TEST_STARTED')

    const endTime = Date.now() + (HOURS * 3600 * 1000)
    let tickNumber = 0

    console.log('🔄 Starting load generation...')

    while (Date.now() < endTime) {
      tickNumber++
      const elapsed = Math.floor((Date.now() - startTime) / 1000)

      // Rotate tokens every TOKEN_ROTATION_MINS
      if (tickNumber % (TOKEN_ROTATION_MINS * 60) === 0) {
        console.log('🔄 Rotating tokens...')
        await generateTokens()
        logEvent('TOKENS_ROTATED')
      }

      // Test policy denial every minute
      if (tickNumber % 60 === 0) {
        await testPolicyDenial()
      }

      // Execute load
      const results = await executeTick(tickNumber)
      
      // Update totals
      totals.ok += results.ok
      totals.denied += results.denied
      totals.fail += results.fail
      totals.total += RPS

      // Log progress every 10 minutes
      if (tickNumber % 600 === 0) {
        const successRate = ((totals.ok / totals.total) * 100).toFixed(2)
        console.log(`⏱️  ${elapsed}s elapsed - Success: ${successRate}% (${totals.ok}/${totals.total})`)
      }

      // Capture metrics snapshot
      if (tickNumber % (SNAP_MINS * 60) === 0) {
        const hour = Math.floor(elapsed / 3600)
        await captureMetricsSnapshot(`h${hour}`)
      }

      // Wait 1 second for next tick
      await new Promise(resolve => setTimeout(resolve, 1000))
    }

    // Final metrics snapshot
    await captureMetricsSnapshot('final')
    
    // Generate summary
    const summary = {
      totals,
      configuration: {
        rps: RPS,
        hours: HOURS,
        base_url: BASE,
        token_rotation_mins: TOKEN_ROTATION_MINS
      },
      success_rate: ((totals.ok / totals.total) * 100).toFixed(2),
      denial_rate: ((totals.denied / totals.total) * 100).toFixed(2),
      failure_rate: ((totals.fail / totals.total) * 100).toFixed(2),
      completed_at: new Date().toISOString(),
      duration_seconds: Math.floor((Date.now() - startTime) / 1000)
    }

    fs.writeFileSync('reports/soak-summary.json', JSON.stringify(summary, null, 2))
    
    logEvent('SOAK_TEST_COMPLETED')
    
    console.log('✅ Soak test completed successfully!')
    console.log(`📊 Final Results:`)
    console.log(`   Success Rate: ${summary.success_rate}%`)
    console.log(`   Denial Rate: ${summary.denial_rate}%`)
    console.log(`   Failure Rate: ${summary.failure_rate}%`)
    console.log(`   Total Requests: ${totals.total}`)
    console.log(`📁 Reports saved to: reports/`)

  } catch (error) {
    console.error('❌ Soak test failed:', error)
    logEvent(`SOAK_TEST_FAILED: ${error.message}`)
    process.exit(1)
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Received SIGINT, shutting down gracefully...')
  logEvent('SOAK_TEST_INTERRUPTED')
  process.exit(0)
})

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM, shutting down gracefully...')
  logEvent('SOAK_TEST_TERMINATED')
  process.exit(0)
})

// Run the soak test
runSoakTest().catch(error => {
  console.error('❌ Fatal error:', error)
  process.exit(1)
})

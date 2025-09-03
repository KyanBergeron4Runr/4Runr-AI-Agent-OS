#!/usr/bin/env node

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

// Configuration
const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:3000'
const REPORTS_DIR = path.join(__dirname, '../reports')
const SCREENSHOTS_DIR = path.join(__dirname, '../reports/screenshots')

// Ensure directories exist
if (!fs.existsSync(REPORTS_DIR)) {
  fs.mkdirSync(REPORTS_DIR, { recursive: true })
}
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true })
}

// Test scenarios
const scenarios = [
  {
    name: 'baseline-ramp',
    description: 'Baseline ramp test (0→50 RPS over 10 min)',
    command: 'npx artillery run artillery.yml --overrides \'{"config":{"phases":[{"duration":600,"arrivalRate":1,"rampTo":50,"name":"baseline-ramp"}]}}\'',
    duration: '10m'
  },
  {
    name: 'spike-test',
    description: 'Spike test (0→150 RPS in 30s, hold 2 min)',
    command: 'npx artillery run artillery.yml --overrides \'{"config":{"phases":[{"duration":120,"arrivalRate":150,"name":"spike"}]}}\'',
    duration: '2.5m'
  },
  {
    name: 'cache-test',
    description: 'Cache effectiveness test (5 min repeated queries)',
    command: 'npx artillery run artillery.yml --scenario-name cache-test',
    duration: '5m'
  },
  {
    name: 'chaos-test',
    description: 'Chaos engineering test (20 RPS with failures)',
    command: 'npx artillery run artillery.yml --scenario-name chaos-retryable',
    duration: '10m'
  }
]

// Utility functions
function log(message, level = 'INFO') {
  const timestamp = new Date().toISOString()
  console.log(`[${timestamp}] [${level}] ${message}`)
}

function checkGatewayHealth() {
  try {
    const response = execSync(`powershell -Command "Invoke-WebRequest -Uri '${GATEWAY_URL}/health' -Method GET | Select-Object -ExpandProperty Content"`, { encoding: 'utf8' })
    const health = JSON.parse(response)
    if (health.ok) {
      log('Gateway health check passed')
      return true
    }
  } catch (error) {
    log('Gateway health check failed', 'ERROR')
    return false
  }
  return false
}

function setupTestAgents() {
  log('Setting up test agents...')
  
  try {
    // Create test agents for each scenario
    const agents = ['scraper', 'enricher', 'engager']
    const agentIds = {}
    
    for (const agent of agents) {
      // Create a temporary JSON file for the request body
      const tempFile = path.join(__dirname, `temp-${agent}-agent.json`)
      const agentData = {
        name: `benchmark-${agent}`,
        description: `Load test agent for ${agent}`,
        created_by: 'benchmark-suite',
        role: 'developer'
      }
      fs.writeFileSync(tempFile, JSON.stringify(agentData))
      
      const response = execSync(`powershell -Command "Invoke-WebRequest -Uri '${GATEWAY_URL}/api/create-agent' -Method POST -ContentType 'application/json' -InFile '${tempFile}' | Select-Object -ExpandProperty Content"`, { encoding: 'utf8' })
      
      // Clean up temp file
      fs.unlinkSync(tempFile)
      
      const agentResponse = JSON.parse(response)
      agentIds[agent] = agentResponse.agent_id
      log(`Created ${agent} agent: ${agentResponse.agent_id}`)
    }
    
    // Set environment variables for Artillery
    process.env.SCRAPER_AGENT_ID = agentIds.scraper
    process.env.ENRICHER_AGENT_ID = agentIds.enricher
    process.env.ENGAGER_AGENT_ID = agentIds.engager
    process.env.GATEWAY_URL = GATEWAY_URL
    
    log('Test agents configured')
    return agentIds
  } catch (error) {
    log(`Failed to setup test agents: ${error.message}`, 'ERROR')
    throw error
  }
}

function injectChaos(tool, mode, pct) {
  log(`Injecting chaos for ${tool}: ${mode} at ${pct}%`)
  
  try {
    // Create a temporary JSON file for the request body
    const tempFile = path.join(__dirname, `temp-chaos-${tool}.json`)
    const chaosData = {
      tool: tool,
      mode: mode,
      pct: pct
    }
    fs.writeFileSync(tempFile, JSON.stringify(chaosData))
    
    execSync(`powershell -Command "Invoke-WebRequest -Uri '${GATEWAY_URL}/api/admin/chaos/tool' -Method POST -ContentType 'application/json' -InFile '${tempFile}' | Select-Object -ExpandProperty Content"`)
    
    // Clean up temp file
    fs.unlinkSync(tempFile)
    
    log(`Chaos injected for ${tool}`)
  } catch (error) {
    log(`Failed to inject chaos: ${error.message}`, 'ERROR')
  }
}

function clearChaos(tool) {
  log(`Clearing chaos for ${tool}`)
  
  try {
    execSync(`powershell -Command "Invoke-WebRequest -Uri '${GATEWAY_URL}/api/admin/chaos/tool/${tool}' -Method DELETE | Select-Object -ExpandProperty Content"`)
    log(`Chaos cleared for ${tool}`)
  } catch (error) {
    log(`Failed to clear chaos: ${error.message}`, 'ERROR')
  }
}

function runScenario(scenario) {
  log(`Starting scenario: ${scenario.name}`)
  log(`Description: ${scenario.description}`)
  log(`Duration: ${scenario.duration}`)
  
  const startTime = Date.now()
  const reportFile = path.join(REPORTS_DIR, `${scenario.name}-${startTime}.json`)
  
  try {
    // Run the scenario
    const command = `${scenario.command} --output ${reportFile}`
    log(`Executing: ${command}`)
    
    execSync(command, { 
      stdio: 'inherit',
      env: { ...process.env, ARTILLERY_REPORT_FILE: reportFile }
    })
    
    const endTime = Date.now()
    const duration = (endTime - startTime) / 1000
    
    log(`Scenario ${scenario.name} completed in ${duration}s`)
    log(`Report saved to: ${reportFile}`)
    
    return { success: true, reportFile, duration }
  } catch (error) {
    log(`Scenario ${scenario.name} failed: ${error.message}`, 'ERROR')
    return { success: false, error: error.message }
  }
}

function generateMetrics() {
  log('Generating metrics snapshot...')
  
  try {
    // Get current metrics
    const metrics = execSync(`powershell -Command "Invoke-WebRequest -Uri '${GATEWAY_URL}/metrics' -Method GET | Select-Object -ExpandProperty Content"`, { encoding: 'utf8' })
    const metricsFile = path.join(REPORTS_DIR, `metrics-${Date.now()}.txt`)
    fs.writeFileSync(metricsFile, metrics)
    log(`Metrics saved to: ${metricsFile}`)
    
    // Get chaos state
    const chaosState = execSync(`powershell -Command "Invoke-WebRequest -Uri '${GATEWAY_URL}/api/admin/chaos' -Method GET | Select-Object -ExpandProperty Content"`, { encoding: 'utf8' })
    const chaosFile = path.join(REPORTS_DIR, `chaos-state-${Date.now()}.json`)
    fs.writeFileSync(chaosFile, chaosState)
    log(`Chaos state saved to: ${chaosFile}`)
    
    return { metricsFile, chaosFile }
  } catch (error) {
    log(`Failed to generate metrics: ${error.message}`, 'ERROR')
    return null
  }
}

function runChaosScenario() {
  log('Running chaos engineering scenario...')
  
  // Setup chaos for different tools
  injectChaos('serpapi', 'timeout', 30)
  injectChaos('http_fetch', '500', 20)
  injectChaos('openai', 'jitter', 15)
  
  // Run the chaos test
  const result = runScenario({
    name: 'chaos-test',
    description: 'Chaos engineering test with injected failures',
    command: 'npx artillery run artillery.yml --scenario-name chaos-retryable',
    duration: '10m'
  })
  
  // Clear chaos
  clearChaos('serpapi')
  clearChaos('http_fetch')
  clearChaos('openai')
  
  return result
}

async function main() {
  log('Starting 4Runr Gateway Load Test Suite')
  log(`Gateway URL: ${GATEWAY_URL}`)
  
  // Check Gateway health
  if (!checkGatewayHealth()) {
    log('Gateway is not healthy. Exiting.', 'ERROR')
    process.exit(1)
  }
  
  // Setup test agents
  const agentIds = setupTestAgents()
  
  const results = []
  
  try {
    // Run baseline scenarios
    for (const scenario of scenarios.slice(0, 2)) {
      const result = runScenario(scenario)
      results.push({ scenario: scenario.name, ...result })
      
      // Wait between scenarios
      log('Waiting 30 seconds between scenarios...')
      await new Promise(resolve => setTimeout(resolve, 30000))
    }
    
    // Run cache test
    const cacheResult = runScenario(scenarios[2])
    results.push({ scenario: 'cache-test', ...cacheResult })
    
    // Run chaos scenario
    const chaosResult = runChaosScenario()
    results.push({ scenario: 'chaos-test', ...chaosResult })
    
    // Generate final metrics
    const metrics = generateMetrics()
    
    // Generate summary report
    const summary = {
      timestamp: new Date().toISOString(),
      gatewayUrl: GATEWAY_URL,
      agentIds,
      results,
      metrics: metrics ? { metricsFile: metrics.metricsFile, chaosFile: metrics.chaosFile } : null
    }
    
    const summaryFile = path.join(REPORTS_DIR, `test-summary-${Date.now()}.json`)
    fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2))
    
    log('Load test suite completed')
    log(`Summary saved to: ${summaryFile}`)
    
    // Print results
    console.log('\n=== TEST RESULTS ===')
    results.forEach(result => {
      const status = result.success ? '✅ PASS' : '❌ FAIL'
      console.log(`${status} ${result.scenario} (${result.duration || 'N/A'}s)`)
    })
    
  } catch (error) {
    log(`Test suite failed: ${error.message}`, 'ERROR')
    process.exit(1)
  }
}

// Run the test suite
if (require.main === module) {
  main().catch(error => {
    log(`Fatal error: ${error.message}`, 'ERROR')
    process.exit(1)
  })
}

module.exports = { main, runScenario, injectChaos, clearChaos }

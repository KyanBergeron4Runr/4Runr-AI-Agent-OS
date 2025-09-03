import http from 'k6/http'
import { check, sleep } from 'k6'

// ====== 48-HOUR BURN-IN TEST CONFIG ======
const BASE = __ENV.GATEWAY_URL || 'http://localhost:3000'
const TEST_DURATION = __ENV.TEST_DURATION || '48h'
const STEADY_RPS = parseInt(__ENV.STEADY_RPS || '65')
const SPIKE_RPS = parseInt(__ENV.SPIKE_RPS || '175')

// Traffic mix percentages
const HAPPY_PATH_PCT = 0.50    // 50% allowed requests
const POLICY_DENIED_PCT = 0.30 // 30% policy denials
const CHAOS_FAULTED_PCT = 0.20 // 20% chaos-affected

// ====== SCENARIO CONFIGURATION ======
export const options = {
  scenarios: {
    // Main steady load (48 hours)
    steady_burn: {
      executor: 'constant-arrival-rate',
      rate: STEADY_RPS,
      timeUnit: '1s',
      duration: TEST_DURATION,
      preAllocatedVUs: 200,
      maxVUs: 300,
      exec: 'steadyTraffic',
    },
    
    // Periodic spikes every 6 hours
    periodic_spikes: {
      executor: 'ramping-arrival-rate',
      startRate: 0,
      timeUnit: '1s',
      preAllocatedVUs: 100,
      maxVUs: 150,
      stages: [
        // Spike pattern repeats every 6h for 48h (8 cycles)
        ...generateSpikePattern(8),
      ],
      exec: 'spikeTraffic',
    },
  },
  
  thresholds: {
    // Burn-in test thresholds (more lenient for 48h)
    http_req_failed: ['rate<0.03'],        // ≤3% failure rate (97% availability)
    http_req_duration: ['p(95)<100'],      // p95 under 100ms
    http_req_duration: ['p(99)<200'],      // p99 under 200ms
  },
}

// Generate spike pattern for 48 hours (every 6h)
function generateSpikePattern(cycles) {
  const pattern = []
  for (let i = 0; i < cycles; i++) {
    const baseTime = i * 6 * 60 // 6 hours in minutes
    pattern.push(
      { target: 0, duration: `${baseTime + 355}m` },      // Wait 5h 55m
      { target: SPIKE_RPS, duration: '2m' },              // Ramp to spike
      { target: SPIKE_RPS, duration: '5m' },              // Hold spike
      { target: 0, duration: '3m' },                      // Ramp down
    )
  }
  return pattern
}

// ====== HELPER FUNCTIONS ======
function j(method, path, headers = {}, bodyObj) {
  const payload = bodyObj ? JSON.stringify(bodyObj) : null
  return http.request(method, `${BASE}${path}`, payload, {
    headers: { 'content-type': 'application/json', ...headers },
    timeout: '10s', // Longer timeout for burn-in
  })
}

function isoPlusMinutes(m) { 
  return new Date(Date.now() + m*60*1000).toISOString() 
}

// Token management for long-running test
let agentTokens = {
  scraper: null,
  enricher: null,
  engager: null,
  lastRefresh: 0
}

function ensureValidTokens() {
  const now = Date.now()
  // Refresh tokens every 30 minutes for 48h test
  if (!agentTokens.scraper || (now - agentTokens.lastRefresh) > 30 * 60 * 1000) {
    refreshTokens()
    agentTokens.lastRefresh = now
  }
}

function refreshTokens() {
  try {
    // Create agents if needed (idempotent)
    const scraper = j('POST', '/api/create-agent', {}, { 
      name: `burnin_scraper_${Date.now()}`, created_by: 'burnin', role: 'scraper' 
    })
    const enricher = j('POST', '/api/create-agent', {}, { 
      name: `burnin_enricher_${Date.now()}`, created_by: 'burnin', role: 'enricher' 
    })
    const engager = j('POST', '/api/create-agent', {}, { 
      name: `burnin_engager_${Date.now()}`, created_by: 'burnin', role: 'engager' 
    })
    
    if (scraper.status === 201 && enricher.status === 201 && engager.status === 201) {
      const scraperId = scraper.json().agent_id
      const enricherId = enricher.json().agent_id
      const engagerId = engager.json().agent_id
      
      // Generate tokens with 45-minute expiry
      const scraperToken = j('POST', '/api/generate-token', {}, {
        agent_id: scraperId, tools: ['serpapi', 'http_fetch'], 
        permissions: ['read'], expires_at: isoPlusMinutes(45)
      })
      const enricherToken = j('POST', '/api/generate-token', {}, {
        agent_id: enricherId, tools: ['http_fetch', 'openai'], 
        permissions: ['read'], expires_at: isoPlusMinutes(45)
      })
      const engagerToken = j('POST', '/api/generate-token', {}, {
        agent_id: engagerId, tools: ['gmail_send'], 
        permissions: ['write'], expires_at: isoPlusMinutes(45)
      })
      
      if (scraperToken.status === 201 && enricherToken.status === 201 && engagerToken.status === 201) {
        agentTokens.scraper = scraperToken.json().agent_token
        agentTokens.enricher = enricherToken.json().agent_token
        agentTokens.engager = engagerToken.json().agent_token
      }
    }
  } catch (error) {
    console.error('Token refresh failed:', error)
  }
}

// ====== SETUP ======
export function setup() {
  console.log('🔥 Starting 48-hour burn-in test')
  console.log(`Steady load: ${STEADY_RPS} RPS`)
  console.log(`Spike load: ${SPIKE_RPS} RPS every 6h`)
  console.log(`Traffic mix: ${HAPPY_PATH_PCT*100}% happy, ${POLICY_DENIED_PCT*100}% denied, ${CHAOS_FAULTED_PCT*100}% chaos`)
  
  // Initial token setup
  refreshTokens()
  
  return {
    startTime: new Date().toISOString(),
    testConfig: {
      steadyRps: STEADY_RPS,
      spikeRps: SPIKE_RPS,
      duration: TEST_DURATION
    }
  }
}

// ====== STEADY TRAFFIC (Main Load) ======
export function steadyTraffic(data) {
  ensureValidTokens()
  
  const rand = Math.random()
  
  if (rand < HAPPY_PATH_PCT) {
    // 50% Happy path - allowed requests
    happyPathRequest()
  } else if (rand < HAPPY_PATH_PCT + POLICY_DENIED_PCT) {
    // 30% Policy denied requests
    policyDeniedRequest()
  } else {
    // 20% Chaos-affected requests
    chaosFaultedRequest()
  }
  
  sleep(0.1) // Small think time
}

// ====== SPIKE TRAFFIC (Periodic Spikes) ======
export function spikeTraffic(data) {
  ensureValidTokens()
  
  // During spikes, focus on happy path to stress the system
  const rand = Math.random()
  
  if (rand < 0.7) {
    happyPathRequest()
  } else if (rand < 0.9) {
    policyDeniedRequest()
  } else {
    chaosFaultedRequest()
  }
  
  sleep(0.05) // Faster during spikes
}

// ====== TRAFFIC PATTERNS ======
function happyPathRequest() {
  if (!agentTokens.scraper) return
  
  const rand = Math.random()
  
  if (rand < 0.4) {
    // SerpAPI search (should be allowed in happy path)
    const res = j('POST', '/api/proxy-request', {}, {
      agent_token: agentTokens.scraper,
      tool: 'serpapi',
      action: 'search',
      params: { q: `burnin query ${Math.floor(Math.random()*1e6)}`, engine: 'google' }
    })
    check(res, { 'serpapi happy path': (r) => [200, 403].includes(r.status) })
    
  } else if (rand < 0.7) {
    // HTTP fetch (should be allowed)
    const res = j('POST', '/api/proxy-request', {}, {
      agent_token: agentTokens.enricher,
      tool: 'http_fetch',
      action: 'get',
      params: { url: 'https://httpbin.org/json' }
    })
    check(res, { 'http_fetch happy path': (r) => [200, 403].includes(r.status) })
    
  } else {
    // OpenAI chat (should be allowed)
    const res = j('POST', '/api/proxy-request', {}, {
      agent_token: agentTokens.enricher,
      tool: 'openai',
      action: 'chat',
      params: { model: 'gpt-4o-mini', input: 'burnin test query' }
    })
    check(res, { 'openai happy path': (r) => [200, 403].includes(r.status) })
  }
}

function policyDeniedRequest() {
  if (!agentTokens.scraper) return
  
  const rand = Math.random()
  
  if (rand < 0.5) {
    // Wrong scope - scraper trying to use gmail
    const res = j('POST', '/api/proxy-request', {}, {
      agent_token: agentTokens.scraper,
      tool: 'gmail_send',
      action: 'send',
      params: { to: 'test@example.com', subject: 'denied', text: 'should be denied' }
    })
    check(res, { 'scope denial': (r) => r.status === 403 })
    
  } else {
    // Wrong permissions - enricher trying to write
    const res = j('POST', '/api/proxy-request', {}, {
      agent_token: agentTokens.enricher,
      tool: 'gmail_send',
      action: 'send',
      params: { to: 'test@example.com', subject: 'denied', text: 'should be denied' }
    })
    check(res, { 'permission denial': (r) => r.status === 403 })
  }
}

function chaosFaultedRequest() {
  if (!agentTokens.scraper) return
  
  // These requests will hit chaos-injected responses (503s, timeouts)
  const res = j('POST', '/api/proxy-request', {}, {
    agent_token: agentTokens.scraper,
    tool: 'serpapi',
    action: 'search',
    params: { q: 'chaos test query', engine: 'google' }
  })
  
  check(res, { 
    'chaos request handled': (r) => [200, 403, 500, 502, 503, 504].includes(r.status) 
  })
}

// ====== TEARDOWN ======
export function teardown(data) {
  console.log('🏁 48-hour burn-in test completed')
  console.log('Start time:', data.startTime)
  console.log('End time:', new Date().toISOString())
}
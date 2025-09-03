import http from 'k6/http'
import { check, sleep } from 'k6'

// ====== CONFIG ======
const BASE = __ENV.GATEWAY_URL || 'http://localhost:3000'
const INTENT_SCRAPER = __ENV.INTENT_SCRAPER || 'lead_discovery'
const INTENT_ENRICH  = __ENV.INTENT_ENRICH  || 'enrichment_summary'
const INTENT_ENGAGE  = __ENV.INTENT_ENGAGE  || 'outreach_send'

// Chaos: turn on in Gateway via env `FF_CHAOS=on` (and restart container).
// This script just drives traffic; chaos behavior is inside your Gateway mocks.

// ====== SCENARIO ======
export const options = {
  scenarios: {
    // 45 minutes total: ramp → sustain → spike → chaos wave → recover → down
    ultra: {
      executor: 'ramping-arrival-rate',
      startRate: 0,
      timeUnit: '1s',
      preAllocatedVUs: 400,   // generous VU pool to avoid VU starvation
      maxVUs: 800,
      stages: [
        { target: 150, duration: '15m' }, // ramp
        { target: 150, duration: '20m' }, // sustain
        { target: 300, duration: '5m'  }, // spike
        { target: 200, duration: '3m'  }, // high after spike (good breaker test)
        { target: 80,  duration: '1m'  }, // recover
        { target: 0,   duration: '1m'  }, // ramp down
      ],
      exec: 'traffic',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.20'],
    // allow some failures if chaos is ON
    http_req_duration: ['p(95)<60'],    // p95 under 60ms in mock mode
  },
}

// ====== HELPERS ======
function j(method, path, headers = {}, bodyObj) {
  const payload = bodyObj ? JSON.stringify(bodyObj) : null
  return http.request(method, `${BASE}${path}`, payload, {
    headers: { 'content-type': 'application/json', ...headers },
    timeout: '8s',
  })
}

function isoPlusMinutes(m) { return new Date(Date.now() + m*60*1000).toISOString() }

// Each VU keeps its own tokens + expiries so we exercise rotation per VU.
function mintAgent(role, name) {
  const res = j('POST', '/api/create-agent', {}, { name, created_by: 'k6-ultra', role })
  check(res, { 'create-agent 201': (r) => r.status === 201 })
  return res.json().agent_id
}

function mintToken(agentId, tools, perms, intent, minutes) {
  const res = j('POST', '/api/generate-token',
    { 'X-Agent-Intent': intent },
    { agent_id: agentId, tools, permissions: perms, expires_at: isoPlusMinutes(minutes) })
  check(res, { 'token 201': (r) => r.status === 201 })
  const json = res.json()
  return { token: json.agent_token, expAt: Date.now() + (minutes*60*1000) - 15_000 } // 15s safety margin
}

function ensureFreshToken(state, kind, mintFn) {
  if (!state[kind] || Date.now() >= state[kind].expAt) state[kind] = mintFn()
  return state[kind].token
}

// ====== SETUP ======
export function setup() {
  // create 3 agents once for all VUs
  const aScr = mintAgent('scraper',  'ultra_scraper')
  const aEnr = mintAgent('enricher', 'ultra_enricher')
  const aEng = mintAgent('engager',  'ultra_engager')
  
  return { aScr, aEnr, aEng }
}

// Global VU state for token management
let vuTokens = null

// ====== TRAFFIC (executed per-arrival) ======
export function traffic(data) {
  // Per-VU state (k6 keeps globals per VU instance)
  if (!vuTokens) {
    vuTokens = {
      scr: mintToken(data.aScr, ['serpapi','http_fetch'], ['read'],  INTENT_SCRAPER,  12),
      enr: mintToken(data.aEnr, ['http_fetch','openai'],  ['read'],  INTENT_ENRICH,   10),
      eng: mintToken(data.aEng, ['gmail_send'],           ['write'], INTENT_ENGAGE,   10),
    }
  }
  
  const getScrTok = () => ensureFreshToken(vuTokens, 'scr',
    () => mintToken(data.aScr, ['serpapi','http_fetch'], ['read'], INTENT_SCRAPER, 12))
  const getEnrTok = () => ensureFreshToken(vuTokens, 'enr',
    () => mintToken(data.aEnr, ['http_fetch','openai'],  ['read'], INTENT_ENRICH,  10))
  const getEngTok = () => ensureFreshToken(vuTokens, 'eng',
    () => mintToken(data.aEng, ['gmail_send'],           ['write'],INTENT_ENGAGE,  10))
  
  // Mix: 60% search, 30% enrich (http+openai), 10% gmail; + denial probes; + cache probes
  const r = Math.random()
  if (r < 0.60) {
    const t = getScrTok()
    const res = j('POST', '/api/proxy-request', {}, {
      agent_token: t, tool: 'serpapi', action: 'search',
      params: { q: `ultra ${Math.floor(Math.random()*1e9)}`, engine: 'google' }
    })
    check(res, { 'serpapi 2xx': (r) => r.status >=200 && r.status < 300 })
    
    // 20% do a duplicate key query to drive cache hits
    if (Math.random() < 0.20) {
      const res2 = j('POST', '/api/proxy-request', {}, {
        agent_token: t, tool: 'serpapi', action: 'search',
        params: { q: 'ultra-cache-probe', engine: 'google' }
      })
      check(res2, { 'serpapi cache probe 2xx': (r) => r.status >=200 && r.status < 300 })
    }
  } else if (r < 0.90) {
    const t = getEnrTok()
    const h = j('POST', '/api/proxy-request', { 'X-Agent-Intent': INTENT_ENRICH }, {
      agent_token: t, tool: 'http_fetch', action: 'get', params: { url: 'https://example.com' }
    })
    check(h, { 'http_fetch ok/allowed': (r) => [200,403,429,502,504].includes(r.status) })
    
    const o = j('POST', '/api/proxy-request', { 'X-Agent-Intent': INTENT_ENRICH }, {
      agent_token: t, tool: 'openai', action: 'chat',
      params: { model: 'gpt-4o-mini', input: 'summarize hello' }
    })
    check(o, { 'openai 2xx': (r) => r.status >=200 && r.status < 300 })
  } else {
    const t = getEngTok()
    const g = j('POST', '/api/proxy-request', {}, {
      agent_token: t, tool: 'gmail_send', action: 'send',
      params: { to: 'sandbox@company.com', subject: 'ultra hello', text: 'hello' }
    })
    check(g, { 'gmail 2xx': (r) => r.status >=200 && r.status < 300 })
  }
  
  // Denial probe ~ every 25th hit to prove policy logs move
  if (Math.floor(Math.random()*25) === 0) {
    const t = getScrTok()
    const d = j('POST', '/api/proxy-request', {}, {
      agent_token: t, tool: 'gmail_send', action: 'send',
      params: { to: 'x@y.com', subject: 'no', text: 'no' }
    })
    check(d, { 'denial is 403': (r) => r.status === 403 })
  }
  
  // tiny think time; we're arrival‑rate controlled anyway
  sleep(0.01)
}

// ====== TEARDOWN ======
export function teardown() {
  // nothing required; you'll scrape /metrics outside the run
}
import http from 'k6/http'
import { check, sleep } from 'k6'

const BASE = __ENV.GATEWAY_URL || 'http://localhost:3000'
const intentScraper = __ENV.INTENT_SCRAPER || 'lead_discovery'
const intentEnrich  = __ENV.INTENT_ENRICH  || 'enrichment_summary'
const intentEngage  = __ENV.INTENT_ENGAGE  || 'outreach_send'

// lightweight API helper
function j(method, path, headers = {}, body) {
  const res = http.request(method, `${BASE}${path}`, body ? JSON.stringify(body) : null, {
    headers: { 'content-type': 'application/json', ...headers },
    timeout: '6s',
  })
  return res
}

export const options = {
  scenarios: {
    quick_test: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      preAllocatedVUs: 10,
      timeUnit: '1s',
      stages: [
        { target: 5, duration: '30s' },   // ramp to 5 rps
        { target: 5, duration: '60s' },   // hold
        { target: 0, duration: '30s' },   // ramp down
      ],
      exec: 'traffic',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.50'], // allow higher failure rate for testing
  },
}

let TOK_SCRAPER = __ENV.TOK_SCRAPER
let TOK_ENRICH  = __ENV.TOK_ENRICH
let TOK_ENGAGER = __ENV.TOK_ENGAGER

export function setup() {
  console.log('Setting up agents and tokens...')
  
  // If tokens aren't provided, create agents and mint tokens once.
  if (!TOK_SCRAPER || !TOK_ENRICH || !TOK_ENGAGER) {
    const a1 = j('POST', '/api/create-agent', {}, { name: 'k6_scraper', created_by: 'k6', role: 'scraper' })
    console.log('Scraper agent response:', a1.status, a1.body.substring(0, 100))
    
    const a2 = j('POST', '/api/create-agent', {}, { name: 'k6_enricher', created_by: 'k6', role: 'enricher' })
    console.log('Enricher agent response:', a2.status, a2.body.substring(0, 100))
    
    const a3 = j('POST', '/api/create-agent', {}, { name: 'k6_engager',  created_by: 'k6', role: 'engager'  })
    console.log('Engager agent response:', a3.status, a3.body.substring(0, 100))
    
    if (a1.status !== 201 || a2.status !== 201 || a3.status !== 201) {
      console.error('Failed to create agents')
      return {}
    }
    
    const id1 = a1.json().agent_id, id2 = a2.json().agent_id, id3 = a3.json().agent_id
    const exp = (m)=> new Date(Date.now()+m*60*1000).toISOString()
    
    const t1 = j('POST', '/api/generate-token', { 'X-Agent-Intent': intentScraper }, { agent_id:id1, tools:['serpapi','http_fetch'], permissions:['read'],  expires_at: exp(20)})
    console.log('Scraper token response:', t1.status, t1.body.substring(0, 100))
    
    const t2 = j('POST', '/api/generate-token', { 'X-Agent-Intent': intentEnrich  }, { agent_id:id2, tools:['http_fetch','openai'],  permissions:['read'],  expires_at: exp(15)})
    console.log('Enricher token response:', t2.status, t2.body.substring(0, 100))
    
    const t3 = j('POST', '/api/generate-token', { 'X-Agent-Intent': intentEngage  }, { agent_id:id3, tools:['gmail_send'],           permissions:['write'], expires_at: exp(15)})
    console.log('Engager token response:', t3.status, t3.body.substring(0, 100))
    
    if (t1.status !== 201 || t2.status !== 201 || t3.status !== 201) {
      console.error('Failed to generate tokens')
      return {}
    }
    
    TOK_SCRAPER = t1.json().agent_token
    TOK_ENRICH  = t2.json().agent_token
    TOK_ENGAGER = t3.json().agent_token
  }
  
  console.log('Setup complete')
  return { TOK_SCRAPER, TOK_ENRICH, TOK_ENGAGER }
}

export function traffic(data) {
  if (!data.TOK_SCRAPER || !data.TOK_ENRICH || !data.TOK_ENGAGER) {
    console.error('Missing tokens, skipping request')
    return
  }
  
  // Simple test - just try scraper requests
  const res = j('POST', '/api/proxy-request', {}, {
    agent_token: data.TOK_SCRAPER,
    tool: 'serpapi',
    action: 'search',
    params: { q: `k6 test ${Math.floor(Math.random()*1000)}`, engine: 'google' },
  })
  
  check(res, { 
    'serpapi request completed': (r) => r.status !== 0,
    'serpapi 2xx or expected error': (r) => r.status >= 200 && r.status < 500
  })
  
  sleep(0.1)
}

export function teardown(data) {
  console.log('Test completed')
}
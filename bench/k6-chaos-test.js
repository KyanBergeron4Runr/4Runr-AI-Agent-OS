import http from 'k6/http'
import { check, sleep } from 'k6'

const BASE = __ENV.GATEWAY_URL || 'http://localhost:3000'

// lightweight API helper
function j(method, path, headers = {}, body) {
  const res = http.request(method, `${BASE}${path}`, body ? JSON.stringify(body) : null, {
    headers: { 'content-type': 'application/json', ...headers },
    timeout: '10s',
  })
  return res
}

export const options = {
  scenarios: {
    chaos_test: {
      executor: 'ramping-arrival-rate',
      startRate: 5,
      preAllocatedVUs: 20,
      timeUnit: '1s',
      stages: [
        { target: 20, duration: '2m' },   // ramp to 20 rps
        { target: 20, duration: '3m' },   // hold to see breaker behavior
        { target: 0, duration: '1m' },    // ramp down
      ],
      exec: 'traffic',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.90'], // expect high failure rate in chaos mode
  },
}

let TOK_SCRAPER, TOK_ENRICH, TOK_ENGAGER

export function setup() {
  console.log('Setting up chaos test agents...')
  
  const a1 = j('POST', '/api/create-agent', {}, { name: 'chaos_scraper', created_by: 'chaos', role: 'scraper' })
  const a2 = j('POST', '/api/create-agent', {}, { name: 'chaos_enricher', created_by: 'chaos', role: 'enricher' })
  const a3 = j('POST', '/api/create-agent', {}, { name: 'chaos_engager',  created_by: 'chaos', role: 'engager'  })
  
  if (a1.status !== 201 || a2.status !== 201 || a3.status !== 201) {
    console.error('Failed to create chaos agents')
    return {}
  }
  
  const id1 = a1.json().agent_id, id2 = a2.json().agent_id, id3 = a3.json().agent_id
  const exp = (m)=> new Date(Date.now()+m*60*1000).toISOString()
  
  const t1 = j('POST', '/api/generate-token', {}, { agent_id:id1, tools:['serpapi','http_fetch'], permissions:['read'],  expires_at: exp(10)})
  const t2 = j('POST', '/api/generate-token', {}, { agent_id:id2, tools:['http_fetch','openai'],  permissions:['read'],  expires_at: exp(10)})
  const t3 = j('POST', '/api/generate-token', {}, { agent_id:id3, tools:['gmail_send'],           permissions:['write'], expires_at: exp(10)})
  
  if (t1.status !== 201 || t2.status !== 201 || t3.status !== 201) {
    console.error('Failed to generate chaos tokens')
    return {}
  }
  
  TOK_SCRAPER = t1.json().agent_token
  TOK_ENRICH  = t2.json().agent_token
  TOK_ENGAGER = t3.json().agent_token
  
  console.log('Chaos test setup complete - FF_CHAOS should be ON')
  return { TOK_SCRAPER, TOK_ENRICH, TOK_ENGAGER }
}

export function traffic(data) {
  if (!data.TOK_SCRAPER || !data.TOK_ENRICH || !data.TOK_ENGAGER) {
    return
  }
  
  const r = Math.random()
  
  if (r < 0.5) {
    // Test serpapi with chaos
    const res = j('POST', '/api/proxy-request', {}, {
      agent_token: data.TOK_SCRAPER,
      tool: 'serpapi',
      action: 'search',
      params: { q: `chaos test ${Math.floor(Math.random()*1000)}`, engine: 'google' },
    })
    
    check(res, { 
      'serpapi chaos response': (r) => r.status !== 0,
      'serpapi chaos handled': (r) => [200, 403, 429, 500, 502, 503, 504].includes(r.status)
    })
  } else {
    // Test http_fetch with chaos
    const res = j('POST', '/api/proxy-request', {}, {
      agent_token: data.TOK_ENRICH,
      tool: 'http_fetch',
      action: 'get',
      params: { url: 'https://httpbin.org/delay/1' },
    })
    
    check(res, { 
      'http_fetch chaos response': (r) => r.status !== 0,
      'http_fetch chaos handled': (r) => [200, 403, 429, 500, 502, 503, 504].includes(r.status)
    })
  }
  
  sleep(0.1)
}

export function teardown(data) {
  console.log('Chaos test completed - check for circuit breaker and retry metrics')
}
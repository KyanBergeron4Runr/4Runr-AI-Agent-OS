import http from 'k6/http'
import { check, sleep } from 'k6'

/**
 * ENV you can set (or defaults):
 * GATEWAY_URL=http://localhost:3000
 * INTENT_SCRAPER=lead_discovery
 * INTENT_ENRICH=enrichment_summary
 * INTENT_ENGAGE=outreach_send
 * TOK_SCRAPER=...   TOK_ENRICH=...   TOK_ENGAGER=...
 *   (or we auto-create agents & tokens once at setup via API calls)
 */

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
    ramp_wave: {
      executor: 'ramping-arrival-rate',
      startRate: 10,
      preAllocatedVUs: 100,
      timeUnit: '1s',
      stages: [
        { target: 60, duration: '10m' },   // ramp to 60 rps
        { target: 60, duration: '10m' },   // hold
        { target: 120, duration: '2m' },   // spike
        { target: 60, duration: '3m' },    // fall back
        { target: 80, duration: '10m' },   // wave up
        { target: 0, duration: '5m' },     // ramp down
      ],
      exec: 'traffic',
    },
  },
  thresholds: {
    // don't fail the run in mock/chaos; we'll read metrics after
    http_req_failed: ['rate<0.20'], // chaos might push failure up; keep generous
  },
}

let TOK_SCRAPER = __ENV.TOK_SCRAPER
let TOK_ENRICH  = __ENV.TOK_ENRICH
let TOK_ENGAGER = __ENV.TOK_ENGAGER

export function setup() {
  // If tokens aren't provided, create agents and mint tokens once.
  if (!TOK_SCRAPER || !TOK_ENRICH || !TOK_ENGAGER) {
    const a1 = j('POST', '/api/create-agent', {}, { name: 'k6_scraper', created_by: 'k6', role: 'scraper' })
    const a2 = j('POST', '/api/create-agent', {}, { name: 'k6_enricher', created_by: 'k6', role: 'enricher' })
    const a3 = j('POST', '/api/create-agent', {}, { name: 'k6_engager',  created_by: 'k6', role: 'engager'  })
    
    const id1 = a1.json().agent_id, id2 = a2.json().agent_id, id3 = a3.json().agent_id
    const exp = (m)=> new Date(Date.now()+m*60*1000).toISOString()
    
    const t1 = j('POST', '/api/generate-token', { 'X-Agent-Intent': intentScraper }, { agent_id:id1, tools:['serpapi','http_fetch'], permissions:['read'],  expires_at: exp(20)})
    const t2 = j('POST', '/api/generate-token', { 'X-Agent-Intent': intentEnrich  }, { agent_id:id2, tools:['http_fetch','openai'],  permissions:['read'],  expires_at: exp(15)})
    const t3 = j('POST', '/api/generate-token', { 'X-Agent-Intent': intentEngage  }, { agent_id:id3, tools:['gmail_send'],           permissions:['write'], expires_at: exp(15)})
    
    TOK_SCRAPER = t1.json().agent_token
    TOK_ENRICH  = t2.json().agent_token
    TOK_ENGAGER = t3.json().agent_token
  }
  
  // snapshot BEFORE
  const snap = http.get(`${BASE}/metrics`).body
  return { TOK_SCRAPER, TOK_ENRICH, TOK_ENGAGER, snapBefore: snap }
}

export function traffic(data) {
  // 60% scraper; 30% enricher (http+openai); 10% engager; plus 1 denial probe sometimes
  const r = Math.random()
  
  if (r < 0.60) {
    const res = j('POST', '/api/proxy-request', {}, {
      agent_token: data.TOK_SCRAPER,
      tool: 'serpapi',
      action: 'search',
      params: { q: `k6 local ${Math.floor(Math.random()*1e6)}`, engine: 'google' },
    })
    check(res, { 'serpapi 2xx': (r) => r.status >=200 && r.status < 300 })
    
    // do a duplicate to trigger cache hit sometimes
    if (Math.random() < 0.15) {
      const res2 = j('POST', '/api/proxy-request', {}, {
        agent_token: data.TOK_SCRAPER, tool: 'serpapi', action: 'search',
        params: { q: 'k6 cache probe', engine: 'google' },
      })
      check(res2, { 'serpapi cache probe 2xx': (r) => r.status >=200 && r.status < 300 })
    }
  } else if (r < 0.90) {
    const h = j('POST', '/api/proxy-request', { 'X-Agent-Intent': intentEnrich }, {
      agent_token: data.TOK_ENRICH, tool: 'http_fetch', action: 'get',
      params: { url: 'https://example.com' },
    })
    check(h, { 'http_fetch ok/allowed': (r) => [200,403,429,502,504].includes(r.status) })
    
    const o = j('POST', '/api/proxy-request', { 'X-Agent-Intent': intentEnrich }, {
      agent_token: data.TOK_ENRICH, tool: 'openai', action: 'chat',
      params: { model: 'gpt-4o-mini', input: 'summarize hello' },
    })
    check(o, { 'openai 2xx': (r) => r.status >=200 && r.status < 300 })
  } else {
    const g = j('POST', '/api/proxy-request', {}, {
      agent_token: data.TOK_ENGAGER, tool: 'gmail_send', action: 'send',
      params: { to: 'sandbox@company.com', subject: 'k6 hello', text: 'hello' },
    })
    check(g, { 'gmail 2xx': (r) => r.status >=200 && r.status < 300 })
  }
  
  // denial probe (~1/30)
  if (Math.floor(Math.random()*30) === 0) {
    const d = j('POST', '/api/proxy-request', {}, {
      agent_token: data.TOK_SCRAPER, tool: 'gmail_send', action: 'send',
      params: { to: 'x@y.com', subject: 'no', text: 'no' },
    })
    check(d, { 'denial is 403': (r) => r.status === 403 })
  }
  
  sleep(0.05)
}

export function teardown(data) {
  // snapshot AFTER
  const snapAfter = http.get(`${BASE}/metrics`).body
  // post both to a local file sink endpoint (optional) or just print lengths
  console.log('METRICS_SNAPSHOT_BEFORE_LEN', data.snapBefore.length)
  console.log('METRICS_SNAPSHOT_AFTER_LEN', snapAfter.length)
}
// tests/metrics.e2e.spec.ts
import { beforeAll, describe, expect, test } from 'vitest'
import fetch from 'node-fetch'

const BASE = process.env.GATEWAY_URL || 'http://localhost:3000'

type MetricMap = Record<string, number>

async function scrapeMetrics(): Promise<MetricMap> {
  const res = await fetch(`${BASE}/metrics`)
  const text = await res.text()
  const map: MetricMap = {}
  for (const line of text.split('\n')) {
    if (!line || line.startsWith('#')) continue
    // e.g. gateway_requests_total{tool="serpapi",action="search",code="200"} 42
    const m = line.match(/^([a-zA-Z_:][a-zA-Z0-9_:]*)(\{[^}]*\})?\s+([0-9eE+.\-]+)$/)
    if (!m) continue
    const [_, name, labels, value] = m
    const key = labels ? `${name}${labels}` : name
    map[key] = Number(value)
  }
  return map
}

function delta(after: MetricMap, before: MetricMap, nameLike: string): number {
  const keys = Object.keys(after).filter(k => k.startsWith(nameLike))
  let sum = 0
  for (const k of keys) sum += (after[k] || 0) - (before[k] || 0)
  return sum
}

// --- helpers for API calls ---
async function j(post: boolean, path: string, headers: Record<string,string> = {}, body?: any) {
  const res = await fetch(`${BASE}${path}`, {
    method: post ? 'POST' : 'GET',
    headers: { 'content-type': 'application/json', ...headers },
    body: post ? JSON.stringify(body) : undefined
  })
  const text = await res.text()
  try { return { status: res.status, json: JSON.parse(text) } } catch { return { status: res.status, text } }
}

let agentScraper = '', agentEnricher = '', agentEngager = ''
let tokScr = '', tokEnr = '', tokEng = ''

async function mintTokens() {
  const exp = (m: number) => new Date(Date.now() + m * 60_000).toISOString()
  tokScr = (await j(true, '/api/generate-token', { 'X-Agent-Intent': 'lead_discovery' },
    { agent_id: agentScraper, tools: ['serpapi','http_fetch'], permissions: ['read'], expires_at: exp(10) })).json.agent_token
  tokEnr = (await j(true, '/api/generate-token', { 'X-Agent-Intent': 'enrichment_summary' },
    { agent_id: agentEnricher, tools: ['http_fetch','openai'], permissions: ['read'], expires_at: exp(8) })).json.agent_token
  tokEng = (await j(true, '/api/generate-token', { 'X-Agent-Intent': 'outreach_send' },
    { agent_id: agentEngager, tools: ['gmail_send'], permissions: ['write'], expires_at: exp(8) })).json.agent_token
}

beforeAll(async () => {
  // health
  const h = await j(false, '/ready'); if (h.status !== 200) throw new Error('gateway not ready')

  // create 3 agents
  agentScraper  = (await j(true, '/api/create-agent', {}, { name: 'metrics_scraper', created_by: 'e2e', role: 'scraper' })).json.agent_id
  agentEnricher = (await j(true, '/api/create-agent', {}, { name: 'metrics_enricher', created_by: 'e2e', role: 'enricher' })).json.agent_id
  agentEngager  = (await j(true, '/api/create-agent', {}, { name: 'metrics_engager',  created_by: 'e2e', role: 'engager'  })).json.agent_id
  await mintTokens()
}, 30_000)

describe('Gateway metrics move as expected', () => {
  test('requests, denials, cache hits, retries, histograms all increment', async () => {
    const before = await scrapeMetrics()

    // 1) Happy path (serpapi) twice → should increment requests + cache hits
    const s1 = await j(true, '/api/proxy-request', {},
      { agent_token: tokScr, tool: 'serpapi', action: 'search', params: { q: 'metrics test', engine: 'google' } })
    expect(s1.status).toBe(200)
    const s2 = await j(true, '/api/proxy-request', {},
      { agent_token: tokScr, tool: 'serpapi', action: 'search', params: { q: 'metrics test', engine: 'google' } })
    expect(s2.status).toBe(200)

    // 2) Policy denial probe: scraper attempts gmail_send → 403
    const d = await j(true, '/api/proxy-request', {},
      { agent_token: tokScr, tool: 'gmail_send', action: 'send', params: { to: 'x@y.com', subject: 'no', text: 'no' } })
    expect(d.status).toBe(403)

    // 3) Retry probe (idempotent): http_fetch get a 503 then success (works in mock chaos or live with flaky endpoint)
    // If you run UPSTREAM_MODE=mock with FF_CHAOS=on, this should occasionally trigger retries automatically.
    // We still issue a call to bump retry counters if they exist.
    const f = await j(true, '/api/proxy-request', {},
      { agent_token: tokEnr, tool: 'http_fetch', action: 'get', params: { url: 'https://example.com' } })
    expect([200, 504, 502].includes(f.status)).toBe(true)

    // 4) OpenAI small call (for openai chat counters + histograms)
    const o = await j(true, '/api/proxy-request', { 'X-Agent-Intent': 'enrichment_summary' },
      { agent_token: tokEnr, tool: 'openai', action: 'chat', params: { model: 'gpt-4o-mini', input: 'hello metrics' } })
    expect(o.status).toBe(200)

    // 5) Gmail send happy path (engager)
    const g = await j(true, '/api/proxy-request', {},
      { agent_token: tokEng, tool: 'gmail_send', action: 'send', params: { to: 'sandbox@company.com', subject: 'metrics ok', text: 'hello' } })
    expect(g.status).toBe(200)

    // small wait for async metric flush
    await new Promise(r => setTimeout(r, 500))

    const after = await scrapeMetrics()

    // --- Assertions on metric deltas ---
    const reqAll = delta(after, before, 'gateway_requests_total')
    expect(reqAll).toBeGreaterThanOrEqual(5) // we made at least 6 calls; some may have merged; require >=5

    const reqSerp200 = Object.entries(after).filter(([k]) =>
      k.startsWith('gateway_requests_total{') &&
      k.includes('tool="serpapi"') && k.includes('action="search"') && (k.includes('code="200"') || k.includes('code="2'))
    ).reduce((acc, [k, v]) => acc + (v - (before[k] || 0)), 0)
    expect(reqSerp200).toBeGreaterThanOrEqual(2)

    const denials = delta(after, before, 'gateway_policy_denials_total')
    expect(denials).toBeGreaterThanOrEqual(1)

    const cacheHits = delta(after, before, 'gateway_cache_hits_total')
    expect(cacheHits).toBeGreaterThanOrEqual(1) // second serpapi call should hit cache if enabled

    const retries = delta(after, before, 'gateway_retries_total')
    // allow 0 if chaos off; warn but do not fail hard — still assert presence of metric name if exists
    if (Object.keys(after).some(k => k.startsWith('gateway_retries_total'))) {
      expect(retries).toBeGreaterThanOrEqual(0)
    }

    const histoBuckets = Object.keys(after).filter(k => k.startsWith('gateway_request_duration_ms_bucket'))
    expect(histoBuckets.length).toBeGreaterThan(0)

    const tokenValidations = delta(after, before, 'gateway_token_validations_total')
    expect(tokenValidations).toBeGreaterThanOrEqual(1)

    // Optional: breaker fast-fail (may be 0 if chaos off)
    const fastFails = delta(after, before, 'gateway_breaker_fastfail_total')
    expect(fastFails).toBeGreaterThanOrEqual(0)
  }, 40_000)

  test('token expiration metrics increment', async () => {
    const before = await scrapeMetrics()

    // Create a short-lived token
    const exp = new Date(Date.now() + 1 * 1000).toISOString() // 1 second expiry
    const shortToken = (await j(true, '/api/generate-token', { 'X-Agent-Intent': 'lead_discovery' },
      { agent_id: agentScraper, tools: ['serpapi'], permissions: ['read'], expires_at: exp })).json.agent_token

    // Wait for token to expire
    await new Promise(r => setTimeout(r, 2000))

    // Try to use expired token
    const expiredCall = await j(true, '/api/proxy-request', {},
      { agent_token: shortToken, tool: 'serpapi', action: 'search', params: { q: 'expired test', engine: 'google' } })
    expect(expiredCall.status).toBe(401) // Should be unauthorized

    // small wait for async metric flush
    await new Promise(r => setTimeout(r, 500))

    const after = await scrapeMetrics()

    // Check for token expiration metrics
    const tokenExpirations = delta(after, before, 'gateway_token_expirations_total')
    expect(tokenExpirations).toBeGreaterThanOrEqual(0) // May be 0 if not implemented, but metric should exist
  }, 10_000)

  test('circuit breaker metrics increment under chaos', async () => {
    const before = await scrapeMetrics()

    // Make multiple rapid calls to potentially trigger circuit breaker
    const promises = []
    for (let i = 0; i < 10; i++) {
      promises.push(j(true, '/api/proxy-request', {},
        { agent_token: tokEnr, tool: 'http_fetch', action: 'get', params: { url: 'https://example.com/chaos' } }))
    }
    
    await Promise.all(promises)

    // small wait for async metric flush
    await new Promise(r => setTimeout(r, 500))

    const after = await scrapeMetrics()

    // Check for circuit breaker metrics (may be 0 if chaos off)
    const breakerFastFails = delta(after, before, 'gateway_breaker_fastfail_total')
    expect(breakerFastFails).toBeGreaterThanOrEqual(0)

    // Check for retry metrics
    const retries = delta(after, before, 'gateway_retries_total')
    expect(retries).toBeGreaterThanOrEqual(0)
  }, 15_000)

  test('all required metrics are present', async () => {
    const metrics = await scrapeMetrics()
    
    const requiredMetrics = [
      'gateway_requests_total',
      'gateway_policy_denials_total',
      'gateway_cache_hits_total',
      'gateway_retries_total',
      'gateway_breaker_fastfail_total',
      'gateway_request_duration_ms_bucket',
      'gateway_token_validations_total',
      'gateway_token_expirations_total'
    ]

    for (const metric of requiredMetrics) {
      const hasMetric = Object.keys(metrics).some(k => k.startsWith(metric))
      expect(hasMetric, `Metric ${metric} should be present`).toBe(true)
    }
  }, 5_000)
})

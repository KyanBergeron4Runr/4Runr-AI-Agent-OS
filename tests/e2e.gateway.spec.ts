// tests/e2e.gateway.spec.ts
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import request from 'supertest'
import nock from 'nock'

// adjust import to your server bootstrap (must export a Fastify instance or start/stop helpers)
import { buildServer } from '../src/index'
import { prisma } from '../src/models/prisma'
import { memoryDB } from '../src/models/memory-db'

let app: any
let base = 'http://localhost:31337'

// test agents
let scraperAgentId: string
let enricherAgentId: string
let engagerAgentId: string

// helpers
async function createAgent(name: string, role: string) {
  const res = await request(base).post('/api/create-agent').send({
    name, role, created_by: 'e2e'
  })
  expect(res.status).toBe(201)
  expect(res.body.agent_id).toBeTruthy()
  expect(res.body.private_key).toMatch(/BEGIN PRIVATE KEY/)
  return res.body.agent_id as string
}

async function getToken(agent_id: string, tools: string[], permissions: string[], ttlMin = 10) {
  const expires_at = new Date(Date.now() + ttlMin * 60_000).toISOString()
  const res = await request(base)
    .post('/api/generate-token')
    .set('X-Agent-Intent', tools.includes('gmail_send') ? 'outreach_send' : tools.includes('openai') ? 'enrichment_summary' : 'lead_discovery')
    .send({ agent_id, tools, permissions, expires_at })
  expect(res.status).toBe(201)
  expect(res.body.agent_token).toMatch(/\./) // enc.sig(.token_id)
  return res.body.agent_token as string
}

beforeAll(async () => {
  // isolate env for tests
  process.env.PORT = '31337'
  process.env.SECRETS_BACKEND = process.env.SECRETS_BACKEND ?? 'env'
  process.env.TOKEN_HMAC_SECRET = process.env.TOKEN_HMAC_SECRET ?? 'test-hmac-secret'
  process.env.HTTP_TIMEOUT_MS = '1500' // short timeouts for tests
  process.env.CB_FAIL_THRESHOLD = '3'
  process.env.CB_OPEN_MS = '2000'
  process.env.CACHE_ENABLED = 'true'
  process.env.CACHE_TTL_MS = '60000'
  process.env.DEFAULT_TIMEZONE = 'America/Toronto'

  // secrets for adapters (env backend)
  process.env['serpapi.api_key'] = 'SERPAPI_TEST'
  process.env['openai.api_key'] = 'OPENAI_TEST'
  process.env['gmail_send.api_key'] = 'GMAIL_TEST'

  // start server
  app = await buildServer()
  await app.listen({ port: 31337, host: '0.0.0.0' })

  // seed default policies if not present (role-based)
  const havePolicies = await memoryDB.getAllPolicies()
  if (havePolicies.length === 0) {
    await memoryDB.createPolicy({
      name: 'scraper-base',
      description: 'Base policy for scraper agents',
      role: 'scraper',
      spec: JSON.stringify({
        scopes: ['serpapi:search', 'http_fetch:get'],
        intent: 'lead_discovery',
        guards: {
          http_fetch: {
            allowedDomains: ['wikipedia.org', 'example.com', 'news.ycombinator.com'],
            maxResponseBytes: 250000,
            timeoutMs: 1200
          }
        },
        quotas: [
          { action: 'serpapi:search', limit: 5, window: '1h', resetStrategy: 'sliding' }
        ],
        schedule: {
          enabled: true,
          timezone: 'America/Toronto',
          allowedDays: [0, 1, 2, 3, 4, 5, 6],
          allowedHours: { start: 0, end: 23 }
        },
        responseFilters: {
          redactFields: ['api_key', 'password'],
          truncateFields: [{ field: 'content', maxLength: 200000 }]
        }
      }),
      specHash: 'test-hash-1',
      active: true
    })

    await memoryDB.createPolicy({
      name: 'enricher-base',
      description: 'Base policy for enricher agents',
      role: 'enricher',
      spec: JSON.stringify({
        scopes: ['http_fetch:get', 'openai:chat'],
        intent: 'enrichment_summary',
        guards: {
          openai: {
            maxTokens: 600
          }
        },
        quotas: [
          { action: 'openai:chat', limit: 5, window: '1h', resetStrategy: 'sliding' }
        ],
        schedule: {
          enabled: true,
          timezone: 'America/Toronto',
          allowedDays: [0, 1, 2, 3, 4, 5, 6],
          allowedHours: { start: 0, end: 23 }
        },
        responseFilters: {
          redactFields: ['api_key', 'password'],
          truncateFields: [{ field: 'content', maxLength: 200000 }]
        }
      }),
      specHash: 'test-hash-2',
      active: true
    })

    await memoryDB.createPolicy({
      name: 'engager-base',
      description: 'Base policy for engager agents',
      role: 'engager',
      spec: JSON.stringify({
        scopes: ['gmail_send:send'],
        intent: 'outreach_send',
        guards: {
          gmail_send: {
            allowedDomains: ['company.com', 'gmail.com'],
            subjectMaxLen: 120,
            bodyMaxLen: 4000
          }
        },
        quotas: [
          { action: 'gmail_send:send', limit: 3, window: '1h', resetStrategy: 'sliding' }
        ],
        schedule: {
          enabled: true,
          timezone: 'America/Toronto',
          allowedDays: [0, 1, 2, 3, 4, 5, 6],
          allowedHours: { start: 0, end: 23 }
        }
      }),
      specHash: 'test-hash-3',
      active: true
    })
  }

  // create test agents
  scraperAgentId = await createAgent('scraper_agent', 'scraper')
  enricherAgentId = await createAgent('enricher_agent', 'enricher')
  engagerAgentId = await createAgent('engager_agent', 'engager')

  // mock upstreams - configure after server is running
  nock.disableNetConnect()
  nock.enableNetConnect((host) => {
    return host.includes('localhost') || host.includes('127.0.0.1')
  })

  // SerpAPI mock
  nock('https://serpapi.com')
    .persist()
    .get('/search')
    .query(true)
    .reply(200, { results: [{ title: 'ok' }], source: 'serpapi' })

  // OpenAI mock
  nock('https://api.openai.com')
    .persist()
    .post(/\/v1\/chat\/completions|\/v1\/responses/)
    .reply(200, { output: 'summary', source: 'openai' })

  // Gmail mock
  nock('https://gmail.googleapis.com')
    .persist()
    .post(/send/)
    .reply(200, { id: 'msg_123', status: 'queued', source: 'gmail' })
})

afterAll(async () => {
  await app?.close()
  nock.cleanAll()
})

describe('4Runr.Gateway E2E', () => {
  test('happy path — scraper via serpapi, cached second call faster', async () => {
    const token = await getToken(scraperAgentId, ['serpapi'], ['serpapi:search'], 5)

    const t1 = Date.now()
    const res1 = await request(base).post('/api/proxy-request').send({
      agent_token: token, tool: 'serpapi', action: 'search',
      params: { q: 'site:wikipedia.org plumber', engine: 'google' }
    })
    const d1 = Date.now() - t1
    expect(res1.status).toBe(200)
    expect(res1.body.source).toBe('serpapi')

    const t2 = Date.now()
    const res2 = await request(base).post('/api/proxy-request').send({
      agent_token: token, tool: 'serpapi', action: 'search',
      params: { q: 'site:wikipedia.org plumber', engine: 'google' }
    })
    const d2 = Date.now() - t2
    expect(res2.status).toBe(200)
    // crude cache signal: second call should be faster
    expect(d2).toBeLessThanOrEqual(d1)
  })

  test('policy denial — scraper cannot use gmail_send', async () => {
    const token = await getToken(scraperAgentId, ['serpapi'], ['serpapi:search'])
    const res = await request(base).post('/api/proxy-request').send({
      agent_token: token, tool: 'gmail_send', action: 'send',
      params: { to: 'x@gmail.com', subject: 'hi', text: 'nope' }
    })
    expect(res.status).toBe(403)
    expect(res.body.error || '').toMatch(/Policy denied|Not authorized/)
  })

  test('quota enforcement — openai.chat limit', async () => {
    const token = await getToken(enricherAgentId, ['openai'], ['openai:chat'])
    for (let i = 0; i < 5; i++) {
      const ok = await request(base).post('/api/proxy-request')
        .set('X-Agent-Intent', 'enrichment_summary')
        .send({ agent_token: token, tool: 'openai', action: 'chat', params: { model: 'gpt-4o-mini', input: 'x' } })
      expect(ok.status).toBe(200)
    }
    const over = await request(base).post('/api/proxy-request')
      .set('X-Agent-Intent', 'enrichment_summary')
      .send({ agent_token: token, tool: 'openai', action: 'chat', params: { model: 'gpt-4o-mini', input: 'x' } })
    expect([403, 429]).toContain(over.status)
    expect(JSON.stringify(over.body)).toMatch(/quota|limit|exceeded/i)
  })

  test('retry on transient 503 (http_fetch idempotent)', async () => {
    const token = await getToken(enricherAgentId, ['http_fetch'], ['http_fetch:get'])
    // Simulate first try 503 then success
    nock('https://news.ycombinator.com').get('/').reply(503, 'nope').get('/').reply(200, 'ok')

    const res = await request(base).post('/api/proxy-request')
      .send({ agent_token: token, tool: 'http_fetch', action: 'get', params: { url: 'https://news.ycombinator.com/' } })
    expect(res.status).toBe(200)
  })

  test('circuit breaker — serpapi repeated failure opens breaker then half-opens', async () => {
    // make serpapi fail for a bit
    nock.cleanAll()
    nock('https://serpapi.com').get('/search').query(true).times(3).reply(500, { err: 'boom' })
    nock('https://serpapi.com').get('/search').query(true).reply(200, { results: [{ title: 'ok' }], source: 'serpapi' })

    const token = await getToken(scraperAgentId, ['serpapi'], ['serpapi:search'])

    // three failures -> breaker opens; one call should fast-fail (expect 503/502 custom)
    for (let i = 0; i < 3; i++) {
      const r = await request(base).post('/api/proxy-request').send({
        agent_token: token, tool: 'serpapi', action: 'search',
        params: { q: 'x', engine: 'google' }
      })
      expect([500, 502, 504]).toContain(r.status)
    }
    // Immediately call again; should fast-fail due to OPEN
    const open = await request(base).post('/api/proxy-request').send({
      agent_token: token, tool: 'serpapi', action: 'search',
      params: { q: 'y', engine: 'google' }
    })
    expect([503, 429]).toContain(open.status) // fast fail while breaker OPEN

    // wait for HALF_OPEN
    await new Promise(r => setTimeout(r, Number(process.env.CB_OPEN_MS || '2000') + 200))
    const half = await request(base).post('/api/proxy-request').send({
      agent_token: token, tool: 'serpapi', action: 'search',
      params: { q: 'z', engine: 'google' }
    })
    expect(half.status).toBe(200) // closes on success
  })

  test('provenance — mismatched proof payload is rejected', async () => {
    const token = await getToken(scraperAgentId, ['serpapi'], ['serpapi:search'])
    // Send a bogus proof; your /proxy-request expects proof comparison under the hood
    const res = await request(base).post('/api/proxy-request').send({
      agent_token: token,
      tool: 'serpapi',
      action: 'search',
      params: { q: 'plumber', engine: 'google' },
      proof_payload: { agent_id: 'evil' } // mismatch
    })
    expect(res.status).toBe(403)
    expect(JSON.stringify(res.body)).toMatch(/payload mismatch|provenance/i)
  })

  test('rate limit — per-agent throttle returns 429', async () => {
    const token = await getToken(scraperAgentId, ['serpapi'], ['serpapi:search'])
    const calls = await Promise.allSettled(
      Array.from({ length: 12 }).map(() =>
        request(base).post('/api/proxy-request').send({
          agent_token: token, tool: 'serpapi', action: 'search',
          params: { q: 'site:example.com', engine: 'google' }
        })
      )
    )
    const statuses = calls
      .filter(c => c.status === 'fulfilled')
      .map((c: any) => c.value.status)
    expect(statuses.some(s => s === 429)).toBe(true)
  })

  test('token expiration — expired token is rejected', async () => {
    const token = await getToken(scraperAgentId, ['serpapi'], ['serpapi:search'], 0.1) // 6 seconds
    
    // Use immediately
    const immediate = await request(base).post('/api/proxy-request').send({
      agent_token: token, tool: 'serpapi', action: 'search',
      params: { q: 'test', engine: 'google' }
    })
    expect(immediate.status).toBe(200)
    
    // Wait for expiration
    await new Promise(r => setTimeout(r, 7000))
    
    // Try to use expired token
    const expired = await request(base).post('/api/proxy-request').send({
      agent_token: token, tool: 'serpapi', action: 'search',
      params: { q: 'test', engine: 'google' }
    })
    expect(expired.status).toBe(401)
    expect(JSON.stringify(expired.body)).toMatch(/expired|invalid/i)
  })

  test('metrics endpoint — returns prometheus metrics', async () => {
    const res = await request(base).get('/metrics')
    expect(res.status).toBe(200)
    expect(res.text).toMatch(/gateway_agent_creations_total/)
    expect(res.text).toMatch(/gateway_token_generations_total/)
    expect(res.text).toMatch(/gateway_proxy_requests_total/)
  })

  test('health endpoint — returns healthy status', async () => {
    const res = await request(base).get('/health')
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('healthy')
  })
})

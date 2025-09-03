#!/usr/bin/env node
// E2E Chaos Test - Full authentication path with real tokens and proof payloads

const http = require('http')

const BASE = process.env.GATEWAY_URL || 'http://localhost:3000'
const DUR_SEC = Number(process.env.CHAOS_DURATION_SEC || 600) // 10 min default

async function makeRequest(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    }

    const req = http.request(options, (res) => {
      let data = ''
      res.on('data', (chunk) => {
        data += chunk
      })
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data)
          resolve({ status: res.statusCode, data: jsonData })
        } catch (e) {
          resolve({ status: res.statusCode, data: data })
        }
      })
    })

    req.on('error', (error) => {
      reject(error)
    })

    if (body) {
      req.write(JSON.stringify(body))
    }
    req.end()
  })
}

async function createAgent(name, role) {
  const response = await makeRequest('POST', '/api/create-agent', {
    name,
    role,
    created_by: 'chaos-e2e'
  })
  
  if (response.status !== 201) {
    throw new Error(`create-agent failed ${response.status}: ${JSON.stringify(response.data)}`)
  }
  
  return response.data.agent_id
}

async function generateToken(agentId, tools, permissions, ttlMin = 10, intent = 'lead_discovery') {
  const expires_at = new Date(Date.now() + ttlMin * 60_000).toISOString()
  
  const response = await makeRequest('POST', '/api/generate-token', {
    agent_id: agentId,
    tools,
    permissions,
    expires_at
  }, {
    'X-Agent-Intent': intent
  })
  
  if (response.status !== 201) {
    throw new Error(`generate-token failed ${response.status}: ${JSON.stringify(response.data)}`)
  }
  
  return {
    token: response.data.agent_token,
    token_id: response.data.token_id,
    proof_payload: response.data.proof_payload // This should be the exact payload for provenance verification
  }
}

async function proxyRequest(tokenData, tool, action, params, intent) {
  const response = await makeRequest('POST', '/api/proxy-request', {
    agent_token: tokenData.token,
    token_id: tokenData.token_id,
    proof_payload: tokenData.proof_payload,
    tool,
    action,
    params
  }, {
    'X-Agent-Intent': intent
  })
  
  return { status: response.status, body: response.data }
}

async function main() {
  console.log('🎯 E2E Chaos Test Start - Full Authentication Path')
  console.log('== Mode:', process.env.UPSTREAM_MODE, 'FF_CHAOS:', process.env.FF_CHAOS, 'FF_POLICY:', process.env.FF_POLICY)
  console.log('== Duration:', DUR_SEC, 'seconds')
  console.log('== Base URL:', BASE)
  console.log('')

  // Create agents
  console.log('Creating agents...')
  const scraperId = await createAgent('chaos_scraper_e2e', 'scraper')
  const enricherId = await createAgent('chaos_enricher_e2e', 'enricher')
  const engagerId = await createAgent('chaos_engager_e2e', 'engager')
  console.log('Agents created:', { scraperId, enricherId, engagerId })
  console.log('')

  // Generate initial tokens with proof payloads
  console.log('Generating tokens with proof payloads...')
  let scraperToken = await generateToken(scraperId, ['serpapi', 'http_fetch'], ['read'], 10, 'lead_discovery')
  let enricherToken = await generateToken(enricherId, ['http_fetch', 'openai'], ['read'], 5, 'enrichment_summary')
  let engagerToken = await generateToken(engagerId, ['gmail_send'], ['write'], 5, 'outreach_send')
  console.log('Tokens generated with proof payloads')
  console.log('')

  const end = Date.now() + DUR_SEC * 1000
  let i = 0
  let totalOk = 0
  let totalDenied = 0
  let totalRateLimited = 0
  let totalFailed = 0
  let totalProvenanceMismatch = 0

  console.log('Starting E2E chaos loop...')
  console.log('Format: tick=# ok=# denied=# 429=# fail=# proof_mismatch=#')
  console.log('')

  while (Date.now() < end) {
    i++
    // burst every ~30s
    const burst = (i % 30 === 0)

    const ops = []
    const N = burst ? 20 : 6

    for (let k = 0; k < N; k++) {
      const pick = Math.random()
      if (pick < 0.45) { // scraper serpapi
        ops.push(proxyRequest(scraperToken, 'serpapi', 'search', { q: `test ${i}-${k}`, engine: 'google' }, 'lead_discovery'))
      } else if (pick < 0.75) { // enricher http + openai
        ops.push(proxyRequest(enricherToken, 'http_fetch', 'get', { url: 'https://example.com' }, 'enrichment_summary')
          .then(() => proxyRequest(enricherToken, 'openai', 'chat', { model: 'gpt-4o-mini', input: 'Summarize hello world' }, 'enrichment_summary')))
      } else { // engager
        ops.push(proxyRequest(engagerToken, 'gmail_send', 'send', { to: 'sandbox@company.com', subject: `hi ${i}-${k}`, text: 'hello' }, 'outreach_send'))
      }
    }

    // Add policy denial attempts (scraper trying gmail_send)
    ops.push(proxyRequest(scraperToken, 'gmail_send', 'send', { to: 'x@y.com', subject: 'no', text: 'no' }, 'lead_discovery'))

    // Add provenance mismatch test (tampered proof payload)
    if (i % 50 === 0) {
      const tamperedToken = {
        ...scraperToken,
        proof_payload: scraperToken.proof_payload + '_TAMPERED'
      }
      ops.push(proxyRequest(tamperedToken, 'serpapi', 'search', { q: 'tampered test', engine: 'google' }, 'lead_discovery'))
    }

    // Rotate tokens every ~2 minutes
    if (i % 120 === 0) {
      console.log('Rotating tokens...')
      scraperToken = await generateToken(scraperId, ['serpapi', 'http_fetch'], ['read'], 10, 'lead_discovery')
      enricherToken = await generateToken(enricherId, ['http_fetch', 'openai'], ['read'], 5, 'enrichment_summary')
      engagerToken = await generateToken(engagerId, ['gmail_send'], ['write'], 5, 'outreach_send')
    }

    const results = await Promise.allSettled(ops)
    const ok = results.filter(r => r.status === 'fulfilled' && r.value.status >= 200 && r.value.status < 300).length
    const denied = results.filter(r => r.status === 'fulfilled' && r.value.status === 403).length
    const rate = results.filter(r => r.status === 'fulfilled' && r.value.status === 429).length
    const fail = results.filter(r => r.status === 'fulfilled' && r.value.status >= 500 || r.status === 'rejected').length

    // Check for provenance mismatches (403 with specific error message)
    const provenanceMismatch = results.filter(r => 
      r.status === 'fulfilled' && 
      r.value.status === 403 && 
      (r.value.body?.error === 'Token proof verification failed' || 
       r.value.body?.error === 'Token not found in registry')
    ).length

    totalOk += ok
    totalDenied += denied
    totalRateLimited += rate
    totalFailed += fail
    totalProvenanceMismatch += provenanceMismatch

    if (i % 10 === 0) {
      const elapsed = Math.floor((Date.now() - (end - DUR_SEC * 1000)) / 1000)
      console.log(`tick=${i} (${elapsed}s) ok=${ok} denied=${denied} 429=${rate} fail=${fail} proof_mismatch=${provenanceMismatch}`)
    }

    // small pacing
    await new Promise(r => setTimeout(r, 1000))
  }

  console.log('')
  console.log('🎯 E2E Chaos Test Complete!')
  console.log('== Final totals:')
  console.log(`   OK (2xx): ${totalOk}`)
  console.log(`   Denied (403): ${totalDenied}`)
  console.log(`   Rate Limited (429): ${totalRateLimited}`)
  console.log(`   Failed (5xx): ${totalFailed}`)
  console.log(`   Provenance Mismatch: ${totalProvenanceMismatch}`)
  console.log(`   Total Requests: ${totalOk + totalDenied + totalRateLimited + totalFailed}`)
  console.log('')

  // dump metrics end snapshot
  console.log('Collecting metrics snapshot...')
  const m = await fetch(`${BASE}/metrics`).then(r => r.text())
  require('fs').writeFileSync(`metrics-chaos-e2e-${Date.now()}.txt`, m)
  console.log('== E2E Chaos done. Wrote metrics snapshot')
  
  // Extract key metrics for summary
  const metrics = m.split('\n')
  const cacheHits = metrics.find(line => line.includes('gateway_cache_hits_total')) || 'gateway_cache_hits_total 0'
  const breakerFastFail = metrics.find(line => line.includes('gateway_breaker_fastfail_total')) || 'gateway_breaker_fastfail_total 0'
  const requests2xx = metrics.find(line => line.includes('gateway_requests_total') && line.includes('code="2')) || 'gateway_requests_total{code="2xx"} 0'
  
  console.log('')
  console.log('📊 Key Metrics Summary:')
  console.log(`   ${cacheHits}`)
  console.log(`   ${breakerFastFail}`)
  console.log(`   ${requests2xx}`)
}

main().catch(e => { console.error(e); process.exit(1) })

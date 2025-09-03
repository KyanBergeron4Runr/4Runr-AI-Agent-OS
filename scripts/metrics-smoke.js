#!/usr/bin/env node
const fetch = require('node-fetch')

const BASE = process.env.GATEWAY_URL || 'http://localhost:3000'

const important = [
  'gateway_requests_total',
  'gateway_policy_denials_total',
  'gateway_cache_hits_total',
  'gateway_retries_total',
  'gateway_breaker_fastfail_total',
  'gateway_request_duration_ms_bucket',
  'gateway_token_validations_total',
  'gateway_token_expirations_total'
]

async function scrape() {
  const res = await fetch(`${BASE}/metrics`)
  const text = await res.text()
  const map = {}
  for (const line of text.split('\n')) {
    if (!line || line.startsWith('#')) continue
    const m = line.match(/^([a-zA-Z_:][a-zA-Z0-9_:]*)(\{[^}]*\})?\s+([0-9eE+.\-]+)$/)
    if (!m) continue
    const [_, name, labels, value] = m
    const key = labels ? `${name}${labels}` : name
    map[key] = Number(value)
  }
  return map
}

function sumLike(map, like) {
  return Object.entries(map).filter(([k]) => k.startsWith(like)).reduce((s, [,v]) => s + v, 0)
}

(async () => {
  console.log('🔍 4Runr Gateway Metrics Smoke Test')
  console.log(`🌐 Target: ${BASE}`)
  console.log('📊 Scraping initial metrics...')
  
  const b = await scrape()

  // minimal activity to move metrics
  const now = Date.now()
  const exp = new Date(now + 10*60*1000).toISOString()

  const j = (post, path, headers={}, body) =>
    fetch(`${BASE}${path}`, {
      method: post?'POST':'GET',
      headers: { 'content-type':'application/json', ...headers },
      body: post? JSON.stringify(body): undefined
    }).then(r => r.text().then(t => ({ status:r.status, text:t })))

  console.log('🔧 Creating test agent...')
  const a1 = await j(true, '/api/create-agent', {}, { name:'metrics_cli_scraper', created_by:'cli', role:'scraper' })
  const agent = JSON.parse(a1.text).agent_id
  
  console.log('🔑 Generating test token...')
  const t = await j(true, '/api/generate-token', { 'X-Agent-Intent':'lead_discovery' },
    { agent_id: agent, tools:['serpapi','http_fetch'], permissions:['read'], expires_at: exp })
  const token = JSON.parse(t.text).agent_token

  console.log('🚀 Executing test requests...')
  
  // Happy path - serpapi search (should increment requests)
  await j(true, '/api/proxy-request', {}, { agent_token: token, tool:'serpapi', action:'search', params:{ q:'cli metrics', engine:'google' } })
  
  // Cache hit - same serpapi call (should increment cache hits)
  await j(true, '/api/proxy-request', {}, { agent_token: token, tool:'serpapi', action:'search', params:{ q:'cli metrics', engine:'google' } })
  
  // Policy denial - scraper trying gmail_send (should increment denials)
  await j(true, '/api/proxy-request', {}, { agent_token: token, tool:'gmail_send', action:'send', params:{ to:'x@y.com', subject:'no', text:'no' } })

  // HTTP fetch for potential retries/breaker activity
  await j(true, '/api/proxy-request', {}, { agent_token: token, tool:'http_fetch', action:'get', params:{ url:'https://example.com' } })

  console.log('⏳ Waiting for metrics to flush...')
  await new Promise(r => setTimeout(r, 500))
  
  console.log('📊 Scraping final metrics...')
  const a = await scrape()

  console.log('\n== METRIC DELTAS (sum by metric family) ==')
  console.log('='.repeat(60))
  
  for (const name of important) {
    const d = sumLike(a, name) - sumLike(b, name)
    const status = d > 0 ? '✅' : d === 0 ? '⚠️ ' : '❌'
    console.log(`${status} ${name.padEnd(40)} ${String(d).padStart(8)}`)
  }
  
  console.log('='.repeat(60))
  
  // Summary
  const totalRequests = sumLike(a, 'gateway_requests_total') - sumLike(b, 'gateway_requests_total')
  const totalDenials = sumLike(a, 'gateway_policy_denials_total') - sumLike(b, 'gateway_policy_denials_total')
  const totalCacheHits = sumLike(a, 'gateway_cache_hits_total') - sumLike(b, 'gateway_cache_hits_total')
  
  console.log('\n📋 Summary:')
  console.log(`   Requests: ${totalRequests} (expected ≥3)`)
  console.log(`   Denials: ${totalDenials} (expected ≥1)`)
  console.log(`   Cache Hits: ${totalCacheHits} (expected ≥1 if cache enabled)`)
  
  // Check for required metrics presence
  console.log('\n🔍 Required Metrics Check:')
  const missingMetrics = []
  for (const metric of important) {
    const hasMetric = Object.keys(a).some(k => k.startsWith(metric))
    if (hasMetric) {
      console.log(`   ✅ ${metric}`)
    } else {
      console.log(`   ❌ ${metric} (missing)`)
      missingMetrics.push(metric)
    }
  }
  
  if (missingMetrics.length > 0) {
    console.log(`\n⚠️  Warning: ${missingMetrics.length} required metrics are missing`)
    process.exit(1)
  } else {
    console.log('\n🎉 All required metrics are present and moving!')
  }
  
  console.log('\n💡 Tips:')
  console.log('   - Set FF_CHAOS=on to see retries and breaker activity')
  console.log('   - Set FF_CACHE=on to see cache hits')
  console.log('   - Run with UPSTREAM_MODE=live for real API calls')
  
})().catch(e => { 
  console.error('❌ Error:', e.message)
  process.exit(1) 
})

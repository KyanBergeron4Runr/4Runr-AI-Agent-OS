#!/usr/bin/env node
// 10-min chaos: mixed traffic + periodic spikes + faults ON
// Using built-in fetch (Node.js 18+)

const BASE = process.env.GATEWAY_URL || 'http://localhost:3000'
const DUR_SEC = Number(process.env.CHAOS_DURATION_SEC || 600) // 10 min default

const agents = {
  scraper: null,
  enricher: null,
  engager: null,
}

async function createAgent(name, role) {
  const r = await fetch(`${BASE}/api/create-agent`, {
    method: 'POST',
    headers: {'content-type':'application/json'},
    body: JSON.stringify({ name, role, created_by: 'chaos' })
  })
  const j = await r.json()
  if (!r.ok) throw new Error('create-agent failed '+r.status+' '+JSON.stringify(j))
  return j.agent_id
}

async function token(agentId, tools, permissions, ttlMin=10, intent='lead_discovery') {
  const expires_at = new Date(Date.now() + ttlMin*60_000).toISOString()
  const r = await fetch(`${BASE}/api/generate-token`, {
    method:'POST',
    headers:{'content-type':'application/json','X-Agent-Intent':intent},
    body: JSON.stringify({ agent_id: agentId, tools, permissions, expires_at })
  })
  const j = await r.json()
  if (!r.ok) throw new Error('token failed '+r.status+' '+JSON.stringify(j))
  return j.agent_token
}

async function proxy(agent_token, tool, action, params, intent) {
  const r = await fetch(`${BASE}/api/proxy-request`, {
    method:'POST',
    headers:{'content-type':'application/json', ...(intent?{'X-Agent-Intent':intent}:{})},
    body: JSON.stringify({ agent_token, tool, action, params })
  })
  const text = await r.text()
  return { status: r.status, body: text }
}

async function main() {
  console.log('== Chaos start. Mode:', process.env.UPSTREAM_MODE, 'FF_CHAOS:', process.env.FF_CHAOS)
  console.log('== Duration:', DUR_SEC, 'seconds')
  console.log('== Base URL:', BASE)
  console.log('')

  // Create agents
  console.log('Creating agents...')
  agents.scraper  = await createAgent('chaos_scraper','scraper')
  agents.enricher = await createAgent('chaos_enricher','enricher')
  agents.engager  = await createAgent('chaos_engager','engager')
  console.log('Agents created:', agents)
  console.log('')

  // Generate initial tokens
  console.log('Generating tokens...')
  let tScr = await token(agents.scraper,  ['serpapi','http_fetch'], ['read'], 10, 'lead_discovery')
  let tEnr = await token(agents.enricher, ['http_fetch','openai'],  ['read'], 5,  'enrichment_summary')
  let tEng = await token(agents.engager,  ['gmail_send'],           ['write'],5,  'outreach_send')
  console.log('Tokens generated')
  console.log('')

  const end = Date.now() + DUR_SEC*1000
  let i = 0
  let totalOk = 0
  let totalDenied = 0
  let totalRateLimited = 0
  let totalFailed = 0

  console.log('Starting chaos loop...')
  console.log('Format: tick=# ok=# denied=# 429=# fail=#')
  console.log('')

  while (Date.now() < end) {
    i++
    // burst every ~30s
    const burst = (i % 30 === 0)

    const ops = []
    const N = burst ? 20 : 6

    for (let k=0;k<N;k++) {
      const pick = Math.random()
      if (pick < 0.45) { // scraper serpapi
        ops.push(proxy(tScr, 'serpapi', 'search', { q:`test ${i}-${k}`, engine:'google' }))
      } else if (pick < 0.75) { // enricher http + openai
        ops.push(proxy(tEnr, 'http_fetch', 'get', { url:'https://example.com' }, 'enrichment_summary')
          .then(()=>proxy(tEnr, 'openai', 'chat', { model:'gpt-4o-mini', input: 'Summarize hello world' }, 'enrichment_summary')))
      } else { // engager
        ops.push(proxy(tEng, 'gmail_send', 'send', { to:'sandbox@company.com', subject:`hi ${i}-${k}`, text:'hello' }, 'outreach_send'))
      }
    }

    // add a denial attempt (policy)
    ops.push(proxy(tScr, 'gmail_send', 'send', { to:'x@y.com', subject:'no', text:'no' }))

    // rotate tokens every ~2 minutes
    if (i % 120 === 0) {
      console.log('Rotating tokens...')
      tScr = await token(agents.scraper,  ['serpapi','http_fetch'], ['read'], 10, 'lead_discovery')
      tEnr = await token(agents.enricher, ['http_fetch','openai'],  ['read'], 5,  'enrichment_summary')
      tEng = await token(agents.engager,  ['gmail_send'],           ['write'],5,  'outreach_send')
    }

    const results = await Promise.allSettled(ops)
    const ok = results.filter(r=>r.status==='fulfilled' && r.value.status>=200 && r.value.status<300).length
    const denied = results.filter(r=>r.status==='fulfilled' && r.value.status===403).length
    const rate = results.filter(r=>r.status==='fulfilled' && r.value.status===429).length
    const fail = results.filter(r=>r.status==='fulfilled' && r.value.status>=500 || r.status==='rejected').length

    totalOk += ok
    totalDenied += denied
    totalRateLimited += rate
    totalFailed += fail

    if (i % 10 === 0) {
      const elapsed = Math.floor((Date.now() - (end - DUR_SEC*1000)) / 1000)
      console.log(`tick=${i} (${elapsed}s) ok=${ok} denied=${denied} 429=${rate} fail=${fail}`)
    }

    // small pacing
    await new Promise(r=>setTimeout(r, 1000))
  }

  console.log('')
  console.log('== Chaos complete!')
  console.log('== Final totals:')
  console.log(`   OK: ${totalOk}`)
  console.log(`   Denied: ${totalDenied}`)
  console.log(`   Rate Limited: ${totalRateLimited}`)
  console.log(`   Failed: ${totalFailed}`)
  console.log(`   Total Requests: ${totalOk + totalDenied + totalRateLimited + totalFailed}`)
  console.log('')

  // dump metrics end snapshot
  console.log('Collecting metrics snapshot...')
  const m = await fetch(`${BASE}/metrics`).then(r=>r.text())
  require('fs').writeFileSync(`metrics-chaos-snapshot.txt`, m)
  console.log('== Chaos done. Wrote metrics-chaos-snapshot.txt')
}

main().catch(e=>{ console.error(e); process.exit(1) })

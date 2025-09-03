#!/usr/bin/env node
const fs = require('fs')
const axios = require('axios')

const BASE = process.env.GATEWAY_URL || 'http://localhost:3000'
const OUT  = process.env.METRICS_OUT  || 'reports'

function parse(text) {
  const map = {}
  for (const line of text.split('\n')) {
    if (!line || line.startsWith('#')) continue
    const m = line.match(/^([a-zA-Z_:][\w:]*)(\{[^}]*\})?\s+([0-9eE+.\-]+)$/)
    if (!m) continue
    const [_, name, labels, value] = m
    const key = labels ? `${name}${labels}` : name
    map[key] = Number(value)
  }
  return map
}

function sumLike(map, like) {
  return Object.entries(map).filter(([k]) => k.startsWith(like))
    .reduce((s, [,v]) => s + v, 0)
}

;(async () => {
  fs.mkdirSync(OUT, { recursive: true })
  const before = await axios.get(`${BASE}/metrics`).then(r=>r.data)
  fs.writeFileSync(`${OUT}/big-before.prom`, before)
  
  console.log('>> RUN YOUR k6 NOW, then press Enter here to capture "during" and "after"...')
  process.stdin.resume()
  await new Promise(r => process.stdin.once('data', r))
  
  const during = await axios.get(`${BASE}/metrics`).then(r=>r.data)
  fs.writeFileSync(`${OUT}/big-during.prom`, during)
  
  console.log('>> Press Enter again ~30s after k6 finished to capture "after"...')
  await new Promise(r => process.stdin.once('data', r))
  
  const after = await axios.get(`${BASE}/metrics`).then(r=>r.data)
  fs.writeFileSync(`${OUT}/big-after.prom`, after)
  
  const B = parse(before), D = parse(during), A = parse(after)
  
  const families = [
    'gateway_requests_total',
    'gateway_request_duration_ms_bucket',
    'gateway_policy_denials_total',
    'gateway_cache_hits_total',
    'gateway_retries_total',
    'gateway_breaker_fastfail_total',
    'gateway_token_validations_total',
  ]
  
  console.log('\n== DELTAS (Before -> After) ==')
  for (const f of families) {
    const delta = sumLike(A, f) - sumLike(B, f)
    console.log(`${f.padEnd(38)} ${String(delta).padStart(10)}`)
  }
  
  console.log('\nSample lines:')
  for (const [k,v] of Object.entries(A)) {
    if (k.startsWith('gateway_cache_hits_total{') ||
        k.startsWith('gateway_breaker_fastfail_total{') ||
        k.startsWith('gateway_requests_total{tool="serpapi"')) {
      console.log(k, v)
      break
    }
  }
  
  console.log(`\nSaved snapshots to ${OUT}/big-*.prom`)
})().catch(e=>{ console.error(e); process.exit(1) })
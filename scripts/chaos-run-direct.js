#!/usr/bin/env node
// Direct chaos test using mock testing endpoint (bypasses token generation)

const http = require('http')

const BASE = process.env.GATEWAY_URL || 'http://localhost:3000'
const DUR_SEC = Number(process.env.CHAOS_DURATION_SEC || 600) // 10 min default

async function testMock(tool, action) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: `/api/test/mock?tool=${tool}&action=${action}`,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
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

    req.end()
  })
}

async function main() {
  console.log('== Direct Chaos Test Start')
  console.log('== Mode:', process.env.UPSTREAM_MODE, 'FF_CHAOS:', process.env.FF_CHAOS)
  console.log('== Duration:', DUR_SEC, 'seconds')
  console.log('== Base URL:', BASE)
  console.log('')

  const end = Date.now() + DUR_SEC*1000
  let i = 0
  let totalOk = 0
  let totalFailed = 0

  console.log('Starting direct chaos loop...')
  console.log('Format: tick=# ok=# fail=#')
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
        ops.push(testMock('serpapi', 'search'))
      } else if (pick < 0.75) { // enricher http + openai
        ops.push(testMock('http_fetch', 'get'))
        ops.push(testMock('openai', 'chat'))
      } else { // engager
        ops.push(testMock('gmail_send', 'send'))
      }
    }

    const results = await Promise.allSettled(ops)
    const ok = results.filter(r=>r.status==='fulfilled' && r.value.status>=200 && r.value.status<300).length
    const fail = results.filter(r=>r.status==='fulfilled' && r.value.status>=500 || r.status==='rejected').length

    totalOk += ok
    totalFailed += fail

    if (i % 10 === 0) {
      const elapsed = Math.floor((Date.now() - (end - DUR_SEC*1000)) / 1000)
      console.log(`tick=${i} (${elapsed}s) ok=${ok} fail=${fail}`)
    }

    // small pacing
    await new Promise(r=>setTimeout(r, 1000))
  }

  console.log('')
  console.log('== Direct Chaos Test Complete!')
  console.log('== Final totals:')
  console.log(`   OK: ${totalOk}`)
  console.log(`   Failed: ${totalFailed}`)
  console.log(`   Total Requests: ${totalOk + totalFailed}`)
  console.log(`   Success Rate: ${((totalOk / (totalOk + totalFailed)) * 100).toFixed(1)}%`)
  console.log('')

  // dump metrics end snapshot
  console.log('Collecting metrics snapshot...')
  const m = await fetch(`${BASE}/metrics`).then(r=>r.text())
  require('fs').writeFileSync(`metrics-chaos-direct-snapshot.txt`, m)
  console.log('== Chaos done. Wrote metrics-chaos-direct-snapshot.txt')
}

main().catch(e=>{ console.error(e); process.exit(1) })

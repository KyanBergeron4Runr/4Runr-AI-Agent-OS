#!/usr/bin/env node
// Alert testing chaos script - simulates high failure rates to test Prometheus alerts

const http = require('http')

const BASE = process.env.GATEWAY_URL || 'http://localhost:3000'
const DUR_SEC = Number(process.env.CHAOS_DURATION_SEC || 300) // 5 min default for alert testing
const FAILURE_RATE = Number(process.env.CHAOS_FAILURE_RATE || 80) // 80% failure rate for alert testing

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
  console.log('🚨 ALERT TESTING CHAOS START')
  console.log('== Mode:', process.env.UPSTREAM_MODE, 'FF_CHAOS:', process.env.FF_CHAOS)
  console.log('== Duration:', DUR_SEC, 'seconds')
  console.log('== Target Failure Rate:', FAILURE_RATE + '%')
  console.log('== Base URL:', BASE)
  console.log('')
  console.log('⚠️  WARNING: This will trigger HighErrorRate alerts!')
  console.log('⚠️  Expected: ChaosTestFailure alerts should fire')
  console.log('⚠️  Expected: HighErrorRate alerts may fire (this is the test)')
  console.log('')

  const end = Date.now() + DUR_SEC*1000
  let i = 0
  let totalOk = 0
  let totalFailed = 0

  console.log('Starting alert test chaos loop...')
  console.log('Format: tick=# ok=# fail=# rate=%')
  console.log('')

  while (Date.now() < end) {
    i++
    
    const ops = []
    const N = 10 // Consistent load for alert testing

    for (let k=0;k<N;k++) {
      const pick = Math.random()
      if (pick < 0.4) { // serpapi
        ops.push(testMock('serpapi', 'search'))
      } else if (pick < 0.7) { // http_fetch
        ops.push(testMock('http_fetch', 'get'))
      } else if (pick < 0.9) { // openai
        ops.push(testMock('openai', 'chat'))
      } else { // gmail_send
        ops.push(testMock('gmail_send', 'send'))
      }
    }

    const results = await Promise.allSettled(ops)
    const ok = results.filter(r=>r.status==='fulfilled' && r.value.status>=200 && r.value.status<300).length
    const fail = results.filter(r=>r.status==='fulfilled' && r.value.status>=500 || r.status==='rejected').length

    totalOk += ok
    totalFailed += fail

    const currentRate = totalOk + totalFailed > 0 ? ((totalFailed / (totalOk + totalFailed)) * 100).toFixed(1) : '0.0'

    if (i % 5 === 0) {
      const elapsed = Math.floor((Date.now() - (end - DUR_SEC*1000)) / 1000)
      console.log(`tick=${i} (${elapsed}s) ok=${ok} fail=${fail} rate=${currentRate}%`)
    }

    // Faster pacing for alert testing
    await new Promise(r=>setTimeout(r, 500))
  }

  console.log('')
  console.log('🚨 ALERT TESTING CHAOS COMPLETE!')
  console.log('== Final totals:')
  console.log(`   OK: ${totalOk}`)
  console.log(`   Failed: ${totalFailed}`)
  console.log(`   Total Requests: ${totalOk + totalFailed}`)
  console.log(`   Final Failure Rate: ${((totalFailed / (totalOk + totalFailed)) * 100).toFixed(1)}%`)
  console.log('')

  // Check if we achieved target failure rate
  const achievedRate = (totalFailed / (totalOk + totalFailed)) * 100
  if (achievedRate >= FAILURE_RATE * 0.8) { // Allow 20% tolerance
    console.log('✅ SUCCESS: Achieved target failure rate for alert testing')
  } else {
    console.log('⚠️  WARNING: Did not achieve target failure rate')
    console.log(`   Target: ${FAILURE_RATE}%, Achieved: ${achievedRate.toFixed(1)}%`)
  }

  // dump metrics end snapshot
  console.log('Collecting metrics snapshot...')
  const m = await fetch(`${BASE}/metrics`).then(r=>r.text())
  require('fs').writeFileSync(`metrics-alert-test-${Date.now()}.txt`, m)
  console.log('== Alert test done. Wrote metrics snapshot')
  
  console.log('')
  console.log('📊 NEXT STEPS:')
  console.log('1. Check Prometheus for ChaosTestFailure alerts')
  console.log('2. Check if HighErrorRate alerts fired (may be expected)')
  console.log('3. Verify alerts resolve when chaos stops')
  console.log('4. Review metrics snapshot for analysis')
}

main().catch(e=>{ console.error(e); process.exit(1) })

#!/usr/bin/env node
// Simple test to verify mock tools and chaos injection work

const http = require('http')

async function testMockTools() {
  console.log('🧪 Testing Mock Tools Directly')
  console.log('================================')
  console.log('')

  // Test 1: Health check
  console.log('✅ Test 1: Health check')
  const health = await makeRequest('GET', '/health')
  console.log(`   Status: ${health.status}`)
  console.log('')

  // Test 2: Create agent
  console.log('✅ Test 2: Create agent')
  const agentResponse = await makeRequest('POST', '/api/create-agent', {
    name: 'test_agent',
    created_by: 'test',
    role: 'scraper'
  })
  console.log(`   Status: ${agentResponse.status}`)
  if (agentResponse.status === 201) {
    console.log(`   Agent ID: ${agentResponse.data.agent_id}`)
  } else {
    console.log(`   Error: ${JSON.stringify(agentResponse.data)}`)
  }
  console.log('')

  // Test 3: Test mock serpapi directly (if we can bypass auth)
  console.log('✅ Test 3: Testing mock serpapi response')
  console.log('   This would test the mock tool and chaos injection')
  console.log('   Need to implement direct tool testing or fix token generation')
  console.log('')

  console.log('🔧 Next Steps:')
  console.log('   1. Fix token generation issue')
  console.log('   2. Or implement direct tool testing bypass')
  console.log('   3. Then test chaos injection')
}

function makeRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: method,
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

    if (body) {
      req.write(JSON.stringify(body))
    }
    req.end()
  })
}

testMockTools().catch(e => {
  console.error('❌ Test failed:', e.message)
})

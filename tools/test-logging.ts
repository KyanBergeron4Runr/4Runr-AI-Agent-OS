#!/usr/bin/env ts-node

import { memoryDB } from '../src/models/memory-db'

async function testLogging() {
  console.log('🧪 Testing 4Runr Gateway Logging\n')

  try {
    // Create a test log entry
    const testLog = await memoryDB.createRequestLog({
      agentId: 'test-agent-123',
      tool: 'openai',
      action: 'chat',
      responseTime: 150,
      statusCode: 200,
      success: true,
      errorMessage: undefined
    })

    console.log('✅ Test log created:', testLog)

    // Create a failed log entry
    const failedLog = await memoryDB.createRequestLog({
      agentId: 'test-agent-123',
      tool: 'serpapi',
      action: 'search',
      responseTime: 0,
      statusCode: 502,
      success: false,
      errorMessage: 'External API request failed'
    })

    console.log('✅ Failed log created:', failedLog)

    // Get all logs
    const allLogs = await memoryDB.getAllRequestLogs()
    console.log(`\n📊 Total logs in database: ${allLogs.length}`)

    // Show stats
    const stats = memoryDB.getStats()
    console.log('📈 Database stats:', stats)

  } catch (error) {
    console.error('❌ Logging test failed:', error)
  }
}

testLogging().then(() => {
  process.exit(0)
}).catch((error) => {
  console.error('❌ Test failed:', error)
  process.exit(1)
})

#!/usr/bin/env ts-node

import { memoryDB } from '../src/models/memory-db'

interface LogDisplay {
  Agent: string
  Tool: string
  Action: string
  Status: string
  Time: string
  Error: string
  At: string
}

async function viewLogs() {
  console.log('📊 4Runr Gateway Logs Dashboard\n')

  try {
    // Get recent logs (last 20)
    const logs = await memoryDB.getAllRequestLogs(20)

    if (logs.length === 0) {
      console.log('No logs found. Start making some requests!')
      return
    }

    // Format logs for display
    const displayLogs: LogDisplay[] = logs.map(log => ({
      Agent: log.agentId.substring(0, 8) + '...',
      Tool: log.tool,
      Action: log.action,
      Status: log.success ? '✅' : '❌',
      Time: `${log.responseTime}ms`,
      Error: log.errorMessage || 'None',
      At: log.createdAt.toISOString().replace('T', ' ').substring(0, 19)
    }))

    // Display logs in table format
    console.table(displayLogs)

    // Show summary statistics
    const totalRequests = logs.length
    const successfulRequests = logs.filter(l => l.success).length
    const failedRequests = totalRequests - successfulRequests
    const avgResponseTime = logs.reduce((sum, l) => sum + l.responseTime, 0) / totalRequests

    console.log('\n📈 Summary Statistics:')
    console.log(`  Total Requests: ${totalRequests}`)
    console.log(`  Successful: ${successfulRequests} (${((successfulRequests / totalRequests) * 100).toFixed(1)}%)`)
    console.log(`  Failed: ${failedRequests} (${((failedRequests / totalRequests) * 100).toFixed(1)}%)`)
    console.log(`  Avg Response Time: ${avgResponseTime.toFixed(0)}ms`)

    // Show tool usage breakdown
    const toolUsage = logs.reduce((acc, log) => {
      acc[log.tool] = (acc[log.tool] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    console.log('\n🔧 Tool Usage:')
    Object.entries(toolUsage).forEach(([tool, count]) => {
      console.log(`  ${tool}: ${count} requests`)
    })

    // Show agent activity
    const agentActivity = logs.reduce((acc, log) => {
      acc[log.agentId] = (acc[log.agentId] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    console.log('\n🤖 Agent Activity:')
    Object.entries(agentActivity).forEach(([agentId, count]) => {
      console.log(`  ${agentId.substring(0, 8)}...: ${count} requests`)
    })

  } catch (error) {
    console.error('❌ Error viewing logs:', error)
  }
}

// Run the dashboard
viewLogs().then(() => {
  process.exit(0)
}).catch((error) => {
  console.error('❌ Dashboard failed:', error)
  process.exit(1)
})

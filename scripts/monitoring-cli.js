#!/usr/bin/env node

/**
 * Multi-Level Monitoring CLI
 * Command line interface for managing the multi-level monitoring system
 * 
 * Usage:
 *   node scripts/monitoring-cli.js start
 *   node scripts/monitoring-cli.js status
 *   node scripts/monitoring-cli.js dashboard
 *   node scripts/monitoring-cli.js history [level] [hours]
 *   node scripts/monitoring-cli.js stats
 *   node scripts/monitoring-cli.js collect
 */

const { initializeMonitoring, getMonitoringDashboard, getSystemHealthSummary, getMetricsHistory, getMonitoringStats, forceMetricsCollection } = require('../dist/observability/monitoring-integration')

async function main() {
  const [,, command, ...args] = process.argv
  
  try {
    switch (command) {
      case 'start':
        await startMonitoring()
        break
        
      case 'status':
        await showStatus()
        break
        
      case 'dashboard':
        await showDashboard()
        break
        
      case 'history':
        await showHistory(args[0], args[1])
        break
        
      case 'stats':
        await showStats()
        break
        
      case 'collect':
        await forceCollection()
        break
        
      default:
        showHelp()
    }
  } catch (error) {
    console.error(`❌ Error: ${error.message}`)
    process.exit(1)
  }
}

async function startMonitoring() {
  console.log('📊 Starting Multi-Level Monitoring System...')
  
  initializeMonitoring()
  
  console.log('✅ Multi-Level Monitoring System started')
  console.log('📊 Monitoring levels:')
  console.log('   - Application: Prometheus metrics every 30s')
  console.log('   - System: CPU, memory, disk every 1m')
  console.log('   - Docker: Container stats every 1m')
  console.log('   - Infrastructure: Database, Redis every 2m')
  console.log('')
  console.log('🌐 Monitoring endpoints available:')
  console.log('   - GET /health/monitoring (dashboard)')
  console.log('   - GET /health/system (system summary)')
  console.log('   - GET /health/stats (statistics)')
  console.log('   - GET /health/history (historical data)')
  console.log('')
  console.log('📋 Use "node scripts/monitoring-cli.js status" to check status')
  
  // Keep running to show real-time updates
  console.log('📊 Real-time monitoring (Ctrl+C to stop):')
  
  setInterval(async () => {
    try {
      const summary = await getSystemHealthSummary()
      if (summary.enabled) {
        const timestamp = new Date().toLocaleTimeString()
        console.log(`[${timestamp}] Health: ${summary.overallHealth} | Levels: ${summary.healthyLevels}/${summary.totalLevels} healthy`)
      }
    } catch (error) {
      console.log(`[${new Date().toLocaleTimeString()}] Error getting status: ${error.message}`)
    }
  }, 30000) // Every 30 seconds
}

async function showStatus() {
  console.log('📊 Multi-Level Monitoring Status\n')
  
  const summary = await getSystemHealthSummary()
  
  if (!summary.enabled) {
    console.log('❌ Multi-Level Monitoring is not running')
    console.log('   Use "node scripts/monitoring-cli.js start" to start monitoring')
    return
  }
  
  console.log(`Overall Health: ${getHealthIcon(summary.overallHealth)} ${summary.overallHealth.toUpperCase()}`)
  console.log(`Healthy Levels: ${summary.healthyLevels}/${summary.totalLevels}`)
  console.log(`Last Update: ${new Date(summary.timestamp).toLocaleString()}`)
  console.log('')
  
  // Application level
  console.log('📱 Application Level:')
  console.log(`   Status: ${summary.application.available ? '✅ Available' : '❌ Unavailable'}`)
  console.log(`   Metrics Count: ${summary.application.metricsCount || 'N/A'}`)
  console.log(`   Last Update: ${summary.application.lastUpdate ? new Date(summary.application.lastUpdate).toLocaleString() : 'Never'}`)
  console.log('')
  
  // System level
  console.log('🖥️ System Level:')
  console.log(`   Status: ${summary.system.available ? '✅ Available' : '❌ Unavailable'}`)
  if (summary.system.cpuUsage !== null) {
    console.log(`   CPU Usage: ${summary.system.cpuUsage.toFixed(1)}%`)
  }
  if (summary.system.memoryUsage !== null) {
    console.log(`   Memory Usage: ${(summary.system.memoryUsage / 1024 / 1024).toFixed(1)}MB`)
  }
  console.log(`   Last Update: ${summary.system.lastUpdate ? new Date(summary.system.lastUpdate).toLocaleString() : 'Never'}`)
  console.log('')
  
  // Docker level
  console.log('🐳 Docker Level:')
  console.log(`   Status: ${summary.docker.available ? '✅ Available' : '❌ Unavailable'}`)
  console.log(`   Container Count: ${summary.docker.containerCount || 'N/A'}`)
  console.log(`   Last Update: ${summary.docker.lastUpdate ? new Date(summary.docker.lastUpdate).toLocaleString() : 'Never'}`)
  console.log('')
  
  // Infrastructure level
  console.log('🏗️ Infrastructure Level:')
  console.log(`   Status: ${summary.infrastructure.available ? '✅ Available' : '❌ Unavailable'}`)
  console.log(`   Database: ${summary.infrastructure.databaseConnected ? '✅ Connected' : '❌ Disconnected'}`)
  console.log(`   Redis: ${summary.infrastructure.redisConnected ? '✅ Connected' : '❌ Disconnected'}`)
  console.log(`   Last Update: ${summary.infrastructure.lastUpdate ? new Date(summary.infrastructure.lastUpdate).toLocaleString() : 'Never'}`)
}

async function showDashboard() {
  console.log('📊 Multi-Level Monitoring Dashboard\n')
  
  const dashboard = await getMonitoringDashboard()
  
  if (!dashboard.enabled) {
    console.log('❌ Multi-Level Monitoring is not running')
    return
  }
  
  console.log(`Dashboard Generated: ${new Date(dashboard.timestamp).toLocaleString()}`)
  console.log('')
  
  console.log('📈 Collection Summary:')
  console.log(`   Total Collections: ${dashboard.summary.totalCollections}`)
  console.log(`   Overall Success Rate: ${dashboard.summary.overallSuccessRate.toFixed(1)}%`)
  console.log(`   Healthy Levels: ${dashboard.summary.healthyLevels}/${dashboard.summary.totalLevels}`)
  console.log('')
  
  console.log('📊 Level Details:')
  Object.entries(dashboard.levels).forEach(([level, data]) => {
    const icon = data.status === 'healthy' ? '✅' : '❌'
    console.log(`   ${icon} ${level.charAt(0).toUpperCase() + level.slice(1)}:`)
    console.log(`      Collections: ${data.recentCollections}`)
    console.log(`      Success Rate: ${data.successRate.toFixed(1)}%`)
    console.log(`      Last Collection: ${data.lastCollection ? new Date(data.lastCollection).toLocaleString() : 'Never'}`)
    console.log('')
  })
}

async function showHistory(level, hours) {
  const hoursNum = hours ? parseInt(hours) : 24
  const levelFilter = level || 'all'
  
  console.log(`📊 Monitoring History - ${levelFilter} (last ${hoursNum} hours)\n`)
  
  const options = {
    level: level || undefined,
    hours: hoursNum,
    limit: 50
  }
  
  const history = await getMetricsHistory(options)
  
  if (history.length === 0) {
    console.log('No historical data found for the specified criteria')
    return
  }
  
  console.log(`Found ${history.length} data points:\n`)
  
  // Group by level
  const byLevel = history.reduce((acc, item) => {
    if (!acc[item.level]) {
      acc[item.level] = []
    }
    acc[item.level].push(item)
    return acc
  }, {})
  
  Object.entries(byLevel).forEach(([levelName, items]) => {
    console.log(`📊 ${levelName.charAt(0).toUpperCase() + levelName.slice(1)} Level (${items.length} collections):`)
    
    const successful = items.filter(item => item.success).length
    const successRate = (successful / items.length) * 100
    
    console.log(`   Success Rate: ${successRate.toFixed(1)}% (${successful}/${items.length})`)
    console.log(`   Latest: ${new Date(items[0].timestamp).toLocaleString()}`)
    console.log(`   Oldest: ${new Date(items[items.length - 1].timestamp).toLocaleString()}`)
    
    // Show recent failures if any
    const recentFailures = items.filter(item => !item.success).slice(0, 3)
    if (recentFailures.length > 0) {
      console.log(`   Recent Failures:`)
      recentFailures.forEach(failure => {
        console.log(`     - ${new Date(failure.timestamp).toLocaleString()}: ${failure.error}`)
      })
    }
    
    console.log('')
  })
}

async function showStats() {
  console.log('📊 Multi-Level Monitoring Statistics\n')
  
  const stats = await getMonitoringStats()
  
  if (!stats.enabled) {
    console.log('❌ Multi-Level Monitoring is not running')
    return
  }
  
  console.log(`Statistics Period: ${stats.period}`)
  console.log(`Generated: ${new Date(stats.timestamp).toLocaleString()}`)
  console.log('')
  
  console.log('📈 Overall Summary:')
  console.log(`   Total Collections: ${stats.summary.totalCollections}`)
  console.log(`   Successful: ${stats.summary.successfulCollections}`)
  console.log(`   Failed: ${stats.summary.failedCollections}`)
  console.log(`   Success Rate: ${stats.summary.overallSuccessRate}%`)
  console.log('')
  
  console.log('📊 By Level:')
  stats.levels.forEach(level => {
    console.log(`   ${level.level.charAt(0).toUpperCase() + level.level.slice(1)}:`)
    console.log(`     Collections: ${level.totalCollections}`)
    console.log(`     Success Rate: ${level.successRate}%`)
    console.log(`     Last Collection: ${level.lastCollection ? new Date(level.lastCollection).toLocaleString() : 'Never'}`)
    console.log('')
  })
}

async function forceCollection() {
  console.log('🔄 Forcing metrics collection across all levels...')
  
  const result = await forceMetricsCollection()
  
  if (!result.enabled) {
    console.log('❌ Multi-Level Monitoring is not running')
    return
  }
  
  console.log('✅ Forced collection completed')
  console.log('')
  
  // Show updated status
  await showStatus()
}

function getHealthIcon(health) {
  switch (health) {
    case 'healthy': return '✅'
    case 'degraded': return '⚠️'
    case 'unhealthy': return '❌'
    default: return '❓'
  }
}

function showHelp() {
  console.log(`
Multi-Level Monitoring CLI

Commands:
  start                     - Start monitoring system with real-time updates
  status                    - Show current monitoring status
  dashboard                 - Show monitoring dashboard
  history [level] [hours]   - Show historical data (default: all levels, 24 hours)
  stats                     - Show monitoring statistics
  collect                   - Force immediate metrics collection

Examples:
  node scripts/monitoring-cli.js start
  node scripts/monitoring-cli.js status
  node scripts/monitoring-cli.js history application 12
  node scripts/monitoring-cli.js history docker 6
  node scripts/monitoring-cli.js stats

The multi-level monitoring system collects metrics at different levels:
- Application: Prometheus metrics from your application
- System: CPU, memory, disk usage from the operating system
- Docker: Container statistics and resource usage
- Infrastructure: Database and Redis connectivity checks

All data is persisted to disk and survives application crashes.
`)
}

main()
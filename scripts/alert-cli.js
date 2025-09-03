#!/usr/bin/env node

/**
 * Alert Management CLI
 * Command line interface for managing the enhanced alert system
 * 
 * Usage:
 *   node scripts/alert-cli.js start
 *   node scripts/alert-cli.js status
 *   node scripts/alert-cli.js dashboard
 *   node scripts/alert-cli.js history [level] [hours]
 *   node scripts/alert-cli.js create <level> <title> <message> <category>
 *   node scripts/alert-cli.js resolve <alert-id>
 *   node scripts/alert-cli.js test
 */

const { initializeAlerting, getAlertDashboard, getAlertStatistics, getAlertHistory, createManualAlert, resolveAlert, testAlertSystem } = require('../dist/observability/alert-integration')

async function main() {
  const [,, command, ...args] = process.argv
  
  try {
    switch (command) {
      case 'start':
        await startAlerting()
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
        
      case 'create':
        await createAlert(args[0], args[1], args[2], args[3])
        break
        
      case 'resolve':
        await resolveAlertById(args[0])
        break
        
      case 'test':
        await testAlerts()
        break
        
      default:
        showHelp()
    }
  } catch (error) {
    console.error(`❌ Error: ${error.message}`)
    process.exit(1)
  }
}

async function startAlerting() {
  console.log('🚨 Starting Enhanced Alert Management System...')
  
  initializeAlerting()
  
  console.log('✅ Enhanced Alert Management System started')
  console.log('🚨 Alert features:')
  console.log('   - Intelligent correlation and suppression')
  console.log('   - Automated escalation and responses')
  console.log('   - Multi-level alert rules')
  console.log('   - Historical analysis and trends')
  console.log('')
  console.log('🌐 Alert endpoints available:')
  console.log('   - GET /health/alerts (dashboard)')
  console.log('   - GET /health/alerts/stats (statistics)')
  console.log('   - GET /health/alerts/history (history)')
  console.log('   - POST /health/alerts (create alert)')
  console.log('   - POST /health/alerts/:id/resolve (resolve)')
  console.log('   - POST /health/alerts/:id/acknowledge (acknowledge)')
  console.log('')
  console.log('📋 Use "node scripts/alert-cli.js status" to check status')
  
  // Keep running to show real-time alerts
  console.log('🚨 Real-time alerting (Ctrl+C to stop):')
  
  setInterval(async () => {
    try {
      const dashboard = await getAlertDashboard()
      if (dashboard.enabled && dashboard.summary.activeAlerts > 0) {
        const timestamp = new Date().toLocaleTimeString()
        const { criticalAlerts, warningAlerts, infoAlerts } = dashboard.summary
        console.log(`[${timestamp}] Active Alerts: ${criticalAlerts} critical, ${warningAlerts} warning, ${infoAlerts} info`)
      }
    } catch (error) {
      console.log(`[${new Date().toLocaleTimeString()}] Error getting alert status: ${error.message}`)
    }
  }, 30000) // Every 30 seconds
}

async function showStatus() {
  console.log('🚨 Enhanced Alert Management Status\n')
  
  const dashboard = await getAlertDashboard()
  
  if (!dashboard.enabled) {
    console.log('❌ Enhanced Alert Management is not running')
    console.log('   Use "node scripts/alert-cli.js start" to start alerting')
    return
  }
  
  const { summary, statistics } = dashboard
  
  console.log(`Alert System Status: ${summary.activeAlerts > 0 ? '🚨 ACTIVE ALERTS' : '✅ All Clear'}`)
  console.log(`Last Update: ${new Date(dashboard.timestamp).toLocaleString()}`)
  console.log('')
  
  // Active alerts summary
  console.log('🚨 Active Alerts:')
  console.log(`   Critical: ${summary.criticalAlerts}`)
  console.log(`   Warning: ${summary.warningAlerts}`)
  console.log(`   Info: ${summary.infoAlerts}`)
  console.log(`   Total: ${summary.activeAlerts}`)
  console.log('')
  
  // 24-hour statistics
  console.log('📊 24-Hour Statistics:')
  console.log(`   Total Alerts: ${statistics.total}`)
  console.log(`   Resolved: ${statistics.resolved} (${statistics.total > 0 ? Math.round(statistics.resolved / statistics.total * 100) : 0}%)`)
  console.log(`   Acknowledged: ${statistics.acknowledged}`)
  console.log(`   Escalated: ${statistics.escalated}`)
  console.log('')
  
  // By level breakdown
  console.log('📈 By Level (24h):')
  console.log(`   Critical: ${statistics.byLevel.critical}`)
  console.log(`   Warning: ${statistics.byLevel.warning}`)
  console.log(`   Info: ${statistics.byLevel.info}`)
  console.log('')
  
  // By category breakdown
  if (Object.keys(statistics.byCategory).length > 0) {
    console.log('📂 By Category (24h):')
    Object.entries(statistics.byCategory).forEach(([category, count]) => {
      console.log(`   ${category}: ${count}`)
    })
    console.log('')
  }
  
  // Active correlations
  if (summary.activeCorrelations > 0) {
    console.log(`🔗 Active Correlations: ${summary.activeCorrelations}`)
    console.log('')
  }
}

async function showDashboard() {
  console.log('🚨 Enhanced Alert Management Dashboard\n')
  
  const dashboard = await getAlertDashboard()
  
  if (!dashboard.enabled) {
    console.log('❌ Enhanced Alert Management is not running')
    return
  }
  
  console.log(`Dashboard Generated: ${new Date(dashboard.timestamp).toLocaleString()}`)
  console.log('')
  
  // Show active alerts by level
  const levels = ['critical', 'warning', 'info']
  
  for (const level of levels) {
    const alerts = dashboard.activeAlerts[level] || []
    const icon = getAlertIcon(level)
    
    if (alerts.length > 0) {
      console.log(`${icon} ${level.toUpperCase()} Alerts (${alerts.length}):`)
      alerts.forEach(alert => {
        const age = getAlertAge(alert.timestamp)
        const status = alert.acknowledgedBy ? '👍 Acknowledged' : '🔔 Unacknowledged'
        console.log(`   ${alert.id.substring(0, 8)}: ${alert.title}`)
        console.log(`      ${alert.message}`)
        console.log(`      Age: ${age} | ${status} | Category: ${alert.category}`)
        if (alert.escalationLevel > 0) {
          console.log(`      ⬆️ Escalated (Level ${alert.escalationLevel})`)
        }
        console.log('')
      })
    } else {
      console.log(`${icon} ${level.toUpperCase()} Alerts: None`)
    }
  }
  
  // Show recent resolved alerts
  const recentResolved = dashboard.recentAlerts.filter(a => a.resolved).slice(0, 5)
  if (recentResolved.length > 0) {
    console.log('✅ Recently Resolved:')
    recentResolved.forEach(alert => {
      const resolvedAge = getAlertAge(alert.resolvedAt)
      console.log(`   ${alert.id.substring(0, 8)}: ${alert.title} (resolved ${resolvedAge} ago by ${alert.resolvedBy})`)
    })
    console.log('')
  }
  
  // Show correlations
  if (dashboard.correlations.length > 0) {
    console.log('🔗 Alert Correlations:')
    dashboard.correlations.forEach(corr => {
      const status = corr.resolved ? '✅ Resolved' : '🔄 Active'
      const duration = corr.endTime ? 
        `Duration: ${Math.round((new Date(corr.endTime) - new Date(corr.startTime)) / 60000)}m` :
        `Age: ${getAlertAge(corr.startTime)}`
      
      console.log(`   ${corr.id.substring(0, 8)}: ${corr.description}`)
      console.log(`      ${status} | ${corr.alertCount} alerts | ${duration}`)
    })
  }
}

async function showHistory(level, hours) {
  const hoursNum = hours ? parseInt(hours) : 24
  const levelFilter = level || 'all'
  
  console.log(`🚨 Alert History - ${levelFilter} (last ${hoursNum} hours)\n`)
  
  const options = {
    level: level || undefined,
    hours: hoursNum,
    limit: 50
  }
  
  const history = await getAlertHistory(options)
  
  if (history.length === 0) {
    console.log('No alerts found for the specified criteria')
    return
  }
  
  console.log(`Found ${history.length} alerts:\n`)
  
  // Group by level
  const byLevel = history.reduce((acc, alert) => {
    if (!acc[alert.level]) {
      acc[alert.level] = []
    }
    acc[alert.level].push(alert)
    return acc
  }, {})
  
  Object.entries(byLevel).forEach(([levelName, alerts]) => {
    const icon = getAlertIcon(levelName)
    console.log(`${icon} ${levelName.toUpperCase()} Alerts (${alerts.length}):`)
    
    alerts.slice(0, 10).forEach(alert => {
      const age = getAlertAge(alert.timestamp)
      const status = alert.resolved ? 
        `✅ Resolved by ${alert.resolvedBy}` : 
        alert.acknowledgedBy ? 
          `👍 Acknowledged by ${alert.acknowledgedBy}` : 
          '🔔 Active'
      
      console.log(`   ${alert.id.substring(0, 8)}: ${alert.title}`)
      console.log(`      ${alert.message}`)
      console.log(`      ${age} ago | ${status} | Category: ${alert.category}`)
      
      if (alert.escalationLevel > 0) {
        console.log(`      ⬆️ Escalated to level ${alert.escalationLevel}`)
      }
      
      console.log('')
    })
    
    if (alerts.length > 10) {
      console.log(`   ... and ${alerts.length - 10} more alerts`)
      console.log('')
    }
  })
}

async function createAlert(level, title, message, category) {
  if (!level || !title || !message || !category) {
    console.error('❌ Usage: create <level> <title> <message> <category>')
    console.error('   Levels: info, warning, critical')
    console.error('   Example: create warning "High CPU" "CPU usage is 85%" "system"')
    return
  }
  
  if (!['info', 'warning', 'critical'].includes(level)) {
    console.error('❌ Invalid level. Must be: info, warning, or critical')
    return
  }
  
  console.log(`🚨 Creating ${level} alert...`)
  
  const alert = await createManualAlert({
    level,
    title,
    message,
    category,
    metadata: { source: 'cli', createdBy: 'alert-cli' }
  })
  
  console.log(`✅ Alert created: ${alert.id}`)
  console.log(`   Level: ${alert.level}`)
  console.log(`   Title: ${alert.title}`)
  console.log(`   Message: ${alert.message}`)
  console.log(`   Category: ${alert.category}`)
}

async function resolveAlertById(alertId) {
  if (!alertId) {
    console.error('❌ Usage: resolve <alert-id>')
    console.error('   Example: resolve alert-1629123456789-abc123def')
    return
  }
  
  console.log(`🔄 Resolving alert ${alertId}...`)
  
  const resolved = await resolveAlert(alertId, 'alert-cli')
  
  if (resolved) {
    console.log(`✅ Alert resolved: ${alertId}`)
  } else {
    console.log(`❌ Failed to resolve alert: ${alertId} (not found or already resolved)`)
  }
}

async function testAlerts() {
  console.log('🧪 Testing Alert System...')
  
  const result = await testAlertSystem()
  
  if (result.success) {
    console.log('✅ Alert system test completed successfully')
    console.log(`   Alerts created: ${result.alertsCreated}`)
    console.log(`   Alerts resolved: ${result.alertsResolved}`)
  } else {
    console.log('❌ Alert system test failed')
  }
}

function getAlertIcon(level) {
  switch (level) {
    case 'critical': return '🚨'
    case 'warning': return '⚠️'
    case 'info': return 'ℹ️'
    default: return '📢'
  }
}

function getAlertAge(timestamp) {
  const now = new Date()
  const alertTime = new Date(timestamp)
  const diffMs = now - alertTime
  
  const minutes = Math.floor(diffMs / 60000)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  
  if (days > 0) {
    return `${days}d ${hours % 24}h`
  } else if (hours > 0) {
    return `${hours}h ${minutes % 60}m`
  } else {
    return `${minutes}m`
  }
}

function showHelp() {
  console.log(`
Enhanced Alert Management CLI

Commands:
  start                           - Start alert system with real-time updates
  status                          - Show current alert status and statistics
  dashboard                       - Show detailed alert dashboard
  history [level] [hours]         - Show alert history (default: all levels, 24 hours)
  create <level> <title> <msg> <cat> - Create manual alert
  resolve <alert-id>              - Resolve an alert
  test                            - Test alert system functionality

Examples:
  node scripts/alert-cli.js start
  node scripts/alert-cli.js status
  node scripts/alert-cli.js history critical 12
  node scripts/alert-cli.js create warning "High Memory" "Memory usage 85%" "system"
  node scripts/alert-cli.js resolve alert-1629123456789-abc123def

Alert Levels:
  info     - Informational alerts
  warning  - Warning conditions that need attention
  critical - Critical issues requiring immediate action

The enhanced alert system provides:
- Intelligent correlation and suppression
- Automated escalation and responses
- Historical analysis and trends
- Integration with health and monitoring systems
`)
}

main()
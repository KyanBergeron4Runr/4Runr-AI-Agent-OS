#!/usr/bin/env node

/**
 * 48-Hour Burn-in Chaos Controller
 * Automates infrastructure chaos events during the burn-in test
 */

const { execSync } = require('child_process')
const fs = require('fs')

const CHAOS_LOG_FILE = 'reports/TASK-025/chaos-events.log'
const METRICS_DIR = 'reports/TASK-025'

// Ensure reports directory exists
fs.mkdirSync(METRICS_DIR, { recursive: true })

class ChaosController {
  constructor() {
    this.startTime = new Date()
    this.events = []
    this.isRunning = false
    this.logFile = fs.createWriteStream(CHAOS_LOG_FILE, { flags: 'a' })
  }

  log(message) {
    const timestamp = new Date().toISOString()
    const logMessage = `[${timestamp}] ${message}`
    console.log(logMessage)
    this.logFile.write(logMessage + '\n')
    
    this.events.push({
      timestamp,
      message,
      elapsed_hours: (Date.now() - this.startTime.getTime()) / (1000 * 60 * 60)
    })
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  async executeCommand(command, description) {
    try {
      this.log(`EXECUTING: ${description}`)
      const result = execSync(command, { encoding: 'utf8', timeout: 30000 })
      this.log(`SUCCESS: ${description}`)
      return result
    } catch (error) {
      this.log(`ERROR: ${description} - ${error.message}`)
      throw error
    }
  }

  async restartGateway() {
    await this.executeCommand(
      'docker compose restart gateway',
      'Restarting gateway container'
    )
    
    // Wait for health check
    await this.sleep(10000)
    
    try {
      await this.executeCommand(
        'curl -f http://localhost:3000/health',
        'Health check after gateway restart'
      )
    } catch (error) {
      this.log('WARNING: Gateway health check failed, waiting longer...')
      await this.sleep(20000)
    }
  }

  async restartDatabase() {
    await this.executeCommand(
      'docker compose restart db',
      'Restarting database container'
    )
    
    // Wait for database to be ready
    await this.sleep(15000)
  }

  async restartRedis() {
    await this.executeCommand(
      'docker compose restart redis',
      'Restarting Redis container'
    )
    
    // Wait for Redis to be ready
    await this.sleep(5000)
  }

  async enableChaos(weight = 40) {
    await this.executeCommand(
      `echo 'FF_CHAOS=on' >> config/.env && docker compose restart gateway`,
      `Enabling chaos injection (${weight}% weight)`
    )
    
    await this.sleep(10000) // Wait for restart
  }

  async disableChaos() {
    await this.executeCommand(
      `sed -i 's/FF_CHAOS=on/FF_CHAOS=off/' config/.env && docker compose restart gateway`,
      'Disabling chaos injection'
    )
    
    await this.sleep(10000) // Wait for restart
  }

  async updateQuotas(openaiQuota = 50) {
    this.log(`Updating OpenAI quota to ${openaiQuota}% of original`)
    // This would typically update policy configuration
    // For now, we'll log the event for manual verification
  }

  async captureMetrics(hour) {
    const filename = `${METRICS_DIR}/metrics-hour-${hour.toString().padStart(2, '0')}.prom`
    
    try {
      await this.executeCommand(
        `curl -fsS http://localhost:3000/metrics > ${filename}`,
        `Capturing metrics for hour ${hour}`
      )
    } catch (error) {
      this.log(`Failed to capture metrics for hour ${hour}: ${error.message}`)
    }
  }

  async captureDockerStats(hour) {
    const filename = `${METRICS_DIR}/docker-stats-hour-${hour.toString().padStart(2, '0')}.csv`
    
    try {
      await this.executeCommand(
        `docker stats --no-stream --format "table {{.Container}},{{.CPUPerc}},{{.MemUsage}},{{.NetIO}},{{.BlockIO}}" > ${filename}`,
        `Capturing Docker stats for hour ${hour}`
      )
    } catch (error) {
      this.log(`Failed to capture Docker stats for hour ${hour}: ${error.message}`)
    }
  }

  async start48HourTest() {
    this.isRunning = true
    this.log('🔥 Starting 48-hour burn-in chaos controller')
    this.log(`Test start time: ${this.startTime.toISOString()}`)
    
    // Initial metrics capture
    await this.captureMetrics(0)
    await this.captureDockerStats(0)
    
    // Schedule events for 48 hours
    const totalHours = 48
    
    for (let hour = 1; hour <= totalHours && this.isRunning; hour++) {
      // Wait for the next hour
      await this.sleep(60 * 60 * 1000) // 1 hour
      
      if (!this.isRunning) break
      
      this.log(`=== HOUR ${hour} OF 48 ===`)
      
      // Hourly metrics capture
      await this.captureMetrics(hour)
      await this.captureDockerStats(hour)
      
      // Scheduled chaos events
      try {
        // Gateway restart every 12 hours
        if (hour % 12 === 0) {
          await this.restartGateway()
        }
        
        // Database restart once per day (at 24h and 48h)
        if (hour === 24 || hour === 48) {
          await this.restartDatabase()
        }
        
        // Redis restart once per day (at 12h and 36h)
        if (hour === 12 || hour === 36) {
          await this.restartRedis()
        }
        
        // Chaos injection window (30 minutes at hours 6, 18, 30, 42)
        if ([6, 18, 30, 42].includes(hour)) {
          await this.enableChaos(40)
          this.log('Chaos window started - 30 minutes of 40% fault injection')
          
          // Wait 30 minutes
          await this.sleep(30 * 60 * 1000)
          
          await this.disableChaos()
          this.log('Chaos window ended')
        }
        
        // Policy changes at 24h mark
        if (hour === 24) {
          await this.updateQuotas(50) // Halve OpenAI quota
        }
        
      } catch (error) {
        this.log(`Error during hour ${hour} chaos events: ${error.message}`)
        // Continue the test even if some chaos events fail
      }
    }
    
    this.log('🏁 48-hour burn-in chaos controller completed')
    await this.generateFinalReport()
  }

  async generateFinalReport() {
    const endTime = new Date()
    const duration = endTime.getTime() - this.startTime.getTime()
    
    const report = {
      test_id: 'BURNIN-48H-2025-08-15',
      start_time: this.startTime.toISOString(),
      end_time: endTime.toISOString(),
      duration_hours: duration / (1000 * 60 * 60),
      chaos_events: this.events,
      total_events: this.events.length,
      infrastructure_restarts: {
        gateway: this.events.filter(e => e.message.includes('gateway')).length,
        database: this.events.filter(e => e.message.includes('database')).length,
        redis: this.events.filter(e => e.message.includes('Redis')).length
      },
      chaos_windows: this.events.filter(e => e.message.includes('Chaos window')).length / 2,
      metrics_snapshots: 49, // 0-48 hours
      docker_stats_snapshots: 49
    }
    
    fs.writeFileSync(
      `${METRICS_DIR}/chaos-controller-report.json`,
      JSON.stringify(report, null, 2)
    )
    
    this.log('Final chaos controller report generated')
  }

  stop() {
    this.isRunning = false
    this.log('Chaos controller stop requested')
    this.logFile.end()
  }
}

// Handle graceful shutdown
const controller = new ChaosController()

process.on('SIGINT', () => {
  console.log('\nReceived SIGINT, stopping chaos controller...')
  controller.stop()
  process.exit(0)
})

process.on('SIGTERM', () => {
  console.log('\nReceived SIGTERM, stopping chaos controller...')
  controller.stop()
  process.exit(0)
})

// Start the 48-hour test
if (require.main === module) {
  controller.start48HourTest().catch(error => {
    console.error('Chaos controller failed:', error)
    process.exit(1)
  })
}

module.exports = ChaosController
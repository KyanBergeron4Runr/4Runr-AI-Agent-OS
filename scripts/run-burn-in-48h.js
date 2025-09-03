#!/usr/bin/env node

/**
 * 48-Hour Burn-in Test Runner
 * Orchestrates the complete 48-hour burn-in test
 */

const { spawn, execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const REPORTS_DIR = 'reports/TASK-025'
const TEST_METADATA_FILE = `${REPORTS_DIR}/run-metadata.json`

class BurnInTestRunner {
  constructor() {
    this.startTime = new Date()
    this.processes = []
    this.isRunning = false
    
    // Ensure reports directory exists
    fs.mkdirSync(REPORTS_DIR, { recursive: true })
  }

  log(message) {
    const timestamp = new Date().toISOString()
    console.log(`[${timestamp}] ${message}`)
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  async checkPrerequisites() {
    this.log('🔍 Checking prerequisites...')
    
    try {
      // Check Docker is running
      execSync('docker --version', { stdio: 'ignore' })
      this.log('✅ Docker is available')
      
      // Check k6 is installed
      execSync('"C:\\Program Files\\k6\\k6.exe" version', { stdio: 'ignore' })
      this.log('✅ k6 is available')
      
      // Check services are running
      const services = execSync('docker compose ps --format json', { encoding: 'utf8' })
      const serviceList = JSON.parse(`[${services.trim().split('\n').join(',')}]`)
      
      const requiredServices = ['gateway', 'db', 'redis']
      for (const service of requiredServices) {
        const found = serviceList.find(s => s.Service === service && s.State === 'running')
        if (!found) {
          throw new Error(`Service ${service} is not running`)
        }
      }
      this.log('✅ All required services are running')
      
      // Check gateway health
      execSync('curl -f http://localhost:3000/health', { stdio: 'ignore' })
      this.log('✅ Gateway is healthy')
      
      return true
    } catch (error) {
      this.log(`❌ Prerequisite check failed: ${error.message}`)
      return false
    }
  }

  async setupEnvironment() {
    this.log('⚙️ Setting up environment for burn-in test...')
    
    try {
      // Ensure proper configuration
      const envConfig = `
# Burn-in test configuration
UPSTREAM_MODE=mock
FF_POLICY=on
FF_CACHE=on
FF_RETRY=on
FF_BREAKERS=on
FF_ASYNC=on
FF_CHAOS=off
`
      
      // Backup current config
      if (fs.existsSync('config/.env')) {
        fs.copyFileSync('config/.env', 'config/.env.backup')
        this.log('✅ Backed up current configuration')
      }
      
      // Apply burn-in configuration
      fs.appendFileSync('config/.env', envConfig)
      this.log('✅ Applied burn-in configuration')
      
      // Restart services to pick up config
      execSync('docker compose restart gateway', { stdio: 'inherit' })
      await this.sleep(10000) // Wait for restart
      
      // Verify health after restart
      execSync('curl -f http://localhost:3000/health', { stdio: 'ignore' })
      this.log('✅ Gateway restarted and healthy')
      
      return true
    } catch (error) {
      this.log(`❌ Environment setup failed: ${error.message}`)
      return false
    }
  }

  async createMetadata() {
    const metadata = {
      test_id: 'BURNIN-48H-2025-08-15-01',
      started_at: this.startTime.toISOString(),
      duration_hours: 48,
      profile: 'burn-in-48h',
      load_profile: {
        steady_rps: 65,
        spike_rps: 175,
        spike_frequency: '6h',
        spike_duration: '10m'
      },
      traffic_mix: {
        happy_path: 0.50,
        policy_denied: 0.30,
        chaos_faulted: 0.20
      },
      chaos_schedule: {
        gateway_restarts: '12h intervals',
        db_restarts: '24h intervals',
        redis_restarts: '12h intervals (offset)',
        chaos_windows: '30min at hours 6,18,30,42',
        policy_changes: 'hour 24 (quota reduction)'
      },
      flags: {
        UPSTREAM_MODE: 'mock',
        FF_POLICY: 'on',
        FF_CACHE: 'on',
        FF_RETRY: 'on',
        FF_BREAKERS: 'on',
        FF_ASYNC: 'on',
        FF_CHAOS: 'off (toggled during chaos windows)'
      },
      success_criteria: {
        availability: '≥97%',
        policy_accuracy: '≥99%',
        memory_drift: '≤10% sustained',
        cpu_stability: 'within 70-80% baseline',
        recovery_time: '≤60s for breaker events'
      },
      host: {
        cpu: '12c',
        ram_gb: 8,
        os: 'WSL2+Docker Desktop',
        platform: 'Windows 11'
      }
    }
    
    fs.writeFileSync(TEST_METADATA_FILE, JSON.stringify(metadata, null, 2))
    this.log('✅ Test metadata created')
    
    return metadata
  }

  spawnProcess(command, args, name) {
    this.log(`🚀 Starting ${name}...`)
    
    const process = spawn(command, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false
    })
    
    // Log output
    process.stdout.on('data', (data) => {
      console.log(`[${name}] ${data.toString().trim()}`)
    })
    
    process.stderr.on('data', (data) => {
      console.error(`[${name}] ${data.toString().trim()}`)
    })
    
    process.on('close', (code) => {
      this.log(`${name} exited with code ${code}`)
    })
    
    process.on('error', (error) => {
      this.log(`${name} error: ${error.message}`)
    })
    
    this.processes.push({ process, name })
    return process
  }

  async startBurnInTest() {
    this.isRunning = true
    this.log('🔥 Starting 48-hour burn-in test suite')
    
    try {
      // 1. Check prerequisites
      if (!(await this.checkPrerequisites())) {
        throw new Error('Prerequisites not met')
      }
      
      // 2. Setup environment
      if (!(await this.setupEnvironment())) {
        throw new Error('Environment setup failed')
      }
      
      // 3. Create test metadata
      await this.createMetadata()
      
      // 4. Start monitoring
      const monitor = this.spawnProcess('node', ['scripts/burn-in-monitor.js'], 'Monitor')
      
      // 5. Start chaos controller
      const chaosController = this.spawnProcess('node', ['scripts/chaos-controller-48h.js'], 'ChaosController')
      
      // 6. Wait a moment for monitors to initialize
      await this.sleep(5000)
      
      // 7. Start k6 load test
      const k6Process = this.spawnProcess('C:\\Program Files\\k6\\k6.exe', ['run', 'bench/k6-burn-in-48h.js'], 'K6LoadTest')
      
      this.log('🎯 All processes started - 48-hour burn-in test is running')
      this.log('📊 Monitor logs: reports/TASK-025/monitor.log')
      this.log('🌪️ Chaos logs: reports/TASK-025/chaos-events.log')
      this.log('📈 Metrics: reports/TASK-025/metrics-hour-*.prom')
      
      // Wait for k6 to complete (48 hours)
      await new Promise((resolve, reject) => {
        k6Process.on('close', (code) => {
          if (code === 0) {
            this.log('✅ k6 load test completed successfully')
            resolve()
          } else {
            this.log(`❌ k6 load test failed with code ${code}`)
            reject(new Error(`k6 failed with code ${code}`))
          }
        })
        
        k6Process.on('error', reject)
      })
      
      // Give monitors time to finish processing
      await this.sleep(30000)
      
      // Stop other processes
      this.stopAllProcesses()
      
      // Generate final report
      await this.generateFinalReport()
      
      this.log('🏁 48-hour burn-in test completed successfully!')
      
    } catch (error) {
      this.log(`❌ Burn-in test failed: ${error.message}`)
      this.stopAllProcesses()
      throw error
    }
  }

  stopAllProcesses() {
    this.log('🛑 Stopping all processes...')
    
    for (const { process, name } of this.processes) {
      try {
        if (!process.killed) {
          process.kill('SIGTERM')
          this.log(`Stopped ${name}`)
        }
      } catch (error) {
        this.log(`Error stopping ${name}: ${error.message}`)
      }
    }
    
    this.processes = []
  }

  async generateFinalReport() {
    this.log('📋 Generating final burn-in report...')
    
    const endTime = new Date()
    const duration = endTime.getTime() - this.startTime.getTime()
    
    try {
      // Read monitoring report
      const monitorReport = JSON.parse(
        fs.readFileSync(`${REPORTS_DIR}/monitor-final-report.json`, 'utf8')
      )
      
      // Read chaos controller report
      const chaosReport = JSON.parse(
        fs.readFileSync(`${REPORTS_DIR}/chaos-controller-report.json`, 'utf8')
      )
      
      // Count metrics files
      const metricsFiles = fs.readdirSync(REPORTS_DIR)
        .filter(f => f.startsWith('metrics-hour-'))
        .length
      
      const dockerStatsFiles = fs.readdirSync(REPORTS_DIR)
        .filter(f => f.startsWith('docker-stats-hour-'))
        .length
      
      const finalReport = {
        test_id: 'BURNIN-48H-FINAL-2025-08-15',
        start_time: this.startTime.toISOString(),
        end_time: endTime.toISOString(),
        actual_duration_hours: duration / (1000 * 60 * 60),
        planned_duration_hours: 48,
        test_completed: true,
        
        // Monitoring results
        monitoring: {
          total_iterations: monitorReport.total_iterations,
          total_alerts: monitorReport.total_alerts,
          alert_summary: monitorReport.alert_summary,
          success_criteria: monitorReport.success_criteria
        },
        
        // Chaos engineering results
        chaos: {
          total_events: chaosReport.total_events,
          infrastructure_restarts: chaosReport.infrastructure_restarts,
          chaos_windows: chaosReport.chaos_windows
        },
        
        // Data collection
        artifacts: {
          metrics_snapshots: metricsFiles,
          docker_stats_snapshots: dockerStatsFiles,
          monitor_log: 'monitor.log',
          chaos_log: 'chaos-events.log'
        },
        
        // Overall assessment
        success: monitorReport.success_criteria?.overall_success || false,
        ready_for_staging: monitorReport.success_criteria?.overall_success || false
      }
      
      fs.writeFileSync(
        `${REPORTS_DIR}/FINAL-BURN-IN-REPORT.json`,
        JSON.stringify(finalReport, null, 2)
      )
      
      this.log('✅ Final burn-in report generated')
      this.log(`📊 Success: ${finalReport.success ? 'PASS' : 'FAIL'}`)
      this.log(`🚀 Ready for staging: ${finalReport.ready_for_staging ? 'YES' : 'NO'}`)
      
    } catch (error) {
      this.log(`❌ Failed to generate final report: ${error.message}`)
    }
  }

  async cleanup() {
    this.log('🧹 Cleaning up...')
    
    try {
      // Restore original configuration
      if (fs.existsSync('config/.env.backup')) {
        fs.copyFileSync('config/.env.backup', 'config/.env')
        fs.unlinkSync('config/.env.backup')
        this.log('✅ Restored original configuration')
      }
      
      // Restart services with original config
      execSync('docker compose restart gateway', { stdio: 'inherit' })
      this.log('✅ Services restarted with original configuration')
      
    } catch (error) {
      this.log(`⚠️ Cleanup warning: ${error.message}`)
    }
  }
}

// Handle graceful shutdown
const runner = new BurnInTestRunner()

process.on('SIGINT', async () => {
  console.log('\nReceived SIGINT, stopping burn-in test...')
  runner.stopAllProcesses()
  await runner.cleanup()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  console.log('\nReceived SIGTERM, stopping burn-in test...')
  runner.stopAllProcesses()
  await runner.cleanup()
  process.exit(0)
})

// Start the burn-in test
if (require.main === module) {
  runner.startBurnInTest()
    .then(() => {
      console.log('🎉 Burn-in test completed successfully!')
      process.exit(0)
    })
    .catch(async (error) => {
      console.error('💥 Burn-in test failed:', error.message)
      await runner.cleanup()
      process.exit(1)
    })
}

module.exports = BurnInTestRunner
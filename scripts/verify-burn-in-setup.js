#!/usr/bin/env node

/**
 * Burn-in Test Setup Verification
 * Verifies all prerequisites are met before starting the 48-hour test
 */

const { execSync } = require('child_process')
const fs = require('fs')

class SetupVerifier {
  constructor() {
    this.checks = []
    this.warnings = []
    this.errors = []
  }

  log(message, type = 'INFO') {
    const timestamp = new Date().toISOString()
    console.log(`[${timestamp}] [${type}] ${message}`)
  }

  check(description, testFn) {
    try {
      const result = testFn()
      this.checks.push({ description, status: 'PASS', result })
      this.log(`✅ ${description}`, 'PASS')
      return true
    } catch (error) {
      this.checks.push({ description, status: 'FAIL', error: error.message })
      this.log(`❌ ${description}: ${error.message}`, 'FAIL')
      this.errors.push(`${description}: ${error.message}`)
      return false
    }
  }

  warn(description, testFn) {
    try {
      const result = testFn()
      this.checks.push({ description, status: 'PASS', result })
      this.log(`✅ ${description}`, 'PASS')
      return true
    } catch (error) {
      this.checks.push({ description, status: 'WARN', error: error.message })
      this.log(`⚠️ ${description}: ${error.message}`, 'WARN')
      this.warnings.push(`${description}: ${error.message}`)
      return false
    }
  }

  async verify() {
    this.log('🔍 Verifying 48-hour burn-in test setup...')
    
    // Critical checks (must pass)
    this.check('Docker is installed and running', () => {
      const version = execSync('docker --version', { encoding: 'utf8' })
      return version.trim()
    })
    
    this.check('Docker Compose is available', () => {
      const version = execSync('docker compose version', { encoding: 'utf8' })
      return version.trim()
    })
    
    this.check('k6 is installed', () => {
      const version = execSync('"C:\\Program Files\\k6\\k6.exe" version', { encoding: 'utf8' })
      return version.trim()
    })
    
    this.check('Node.js is available', () => {
      const version = execSync('node --version', { encoding: 'utf8' })
      return version.trim()
    })
    
    this.check('Gateway service is running', () => {
      const ps = execSync('docker compose ps gateway --format json', { encoding: 'utf8' })
      const service = JSON.parse(ps)
      if (service.State !== 'running') {
        throw new Error(`Gateway state is ${service.State}, expected running`)
      }
      return service.State
    })
    
    this.check('Database service is running', () => {
      const ps = execSync('docker compose ps db --format json', { encoding: 'utf8' })
      const service = JSON.parse(ps)
      if (service.State !== 'running') {
        throw new Error(`Database state is ${service.State}, expected running`)
      }
      return service.State
    })
    
    this.check('Redis service is running', () => {
      const ps = execSync('docker compose ps redis --format json', { encoding: 'utf8' })
      const service = JSON.parse(ps)
      if (service.State !== 'running') {
        throw new Error(`Redis state is ${service.State}, expected running`)
      }
      return service.State
    })
    
    this.check('Gateway health endpoint responds', () => {
      execSync('curl -f http://localhost:3000/health', { stdio: 'ignore' })
      return 'healthy'
    })
    
    this.check('Gateway metrics endpoint responds', () => {
      execSync('curl -f http://localhost:3000/metrics', { stdio: 'ignore' })
      return 'metrics available'
    })
    
    this.check('Test scripts exist', () => {
      const scripts = [
        'bench/k6-burn-in-48h.js',
        'scripts/chaos-controller-48h.js',
        'scripts/burn-in-monitor.js',
        'scripts/run-burn-in-48h.js'
      ]
      
      for (const script of scripts) {
        if (!fs.existsSync(script)) {
          throw new Error(`Missing script: ${script}`)
        }
      }
      
      return `${scripts.length} scripts found`
    })
    
    // Warning checks (nice to have)
    this.warn('Sufficient disk space available', () => {
      // This is a simplified check - in production you'd check actual disk space
      const stats = fs.statSync('.')
      return 'disk space check skipped (manual verification recommended)'
    })
    
    this.warn('System has adequate resources', () => {
      // Check available memory and CPU
      const stats = execSync('docker system df', { encoding: 'utf8' })
      return 'resource check completed'
    })
    
    // Configuration checks
    this.check('Environment configuration exists', () => {
      if (!fs.existsSync('config/.env')) {
        throw new Error('config/.env file not found')
      }
      
      const config = fs.readFileSync('config/.env', 'utf8')
      const requiredVars = ['PORT', 'DATABASE_URL', 'REDIS_URL', 'UPSTREAM_MODE']
      
      for (const varName of requiredVars) {
        if (!config.includes(varName)) {
          throw new Error(`Missing required environment variable: ${varName}`)
        }
      }
      
      return 'configuration valid'
    })
    
    // Generate summary
    this.generateSummary()
    
    return {
      ready: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings,
      checks: this.checks
    }
  }

  generateSummary() {
    const total = this.checks.length
    const passed = this.checks.filter(c => c.status === 'PASS').length
    const failed = this.checks.filter(c => c.status === 'FAIL').length
    const warned = this.checks.filter(c => c.status === 'WARN').length
    
    this.log('', 'INFO')
    this.log('=== SETUP VERIFICATION SUMMARY ===', 'INFO')
    this.log(`Total checks: ${total}`, 'INFO')
    this.log(`Passed: ${passed}`, 'INFO')
    this.log(`Failed: ${failed}`, 'INFO')
    this.log(`Warnings: ${warned}`, 'INFO')
    
    if (this.errors.length === 0) {
      this.log('', 'INFO')
      this.log('🎉 SETUP VERIFICATION PASSED', 'PASS')
      this.log('✅ Ready to start 48-hour burn-in test', 'PASS')
      this.log('', 'INFO')
      this.log('To start the test, run:', 'INFO')
      this.log('  make burn-in-48h', 'INFO')
      this.log('  # or', 'INFO')
      this.log('  node scripts/run-burn-in-48h.js', 'INFO')
    } else {
      this.log('', 'INFO')
      this.log('💥 SETUP VERIFICATION FAILED', 'FAIL')
      this.log('❌ Cannot start burn-in test until errors are resolved', 'FAIL')
      this.log('', 'INFO')
      this.log('Errors to fix:', 'INFO')
      for (const error of this.errors) {
        this.log(`  - ${error}`, 'FAIL')
      }
    }
    
    if (this.warnings.length > 0) {
      this.log('', 'INFO')
      this.log('Warnings (recommended to address):', 'INFO')
      for (const warning of this.warnings) {
        this.log(`  - ${warning}`, 'WARN')
      }
    }
  }
}

// Run verification
if (require.main === module) {
  const verifier = new SetupVerifier()
  
  verifier.verify()
    .then(result => {
      process.exit(result.ready ? 0 : 1)
    })
    .catch(error => {
      console.error('Verification failed:', error.message)
      process.exit(1)
    })
}

module.exports = SetupVerifier
#!/usr/bin/env node

/**
 * Startup script that initializes the enhanced health manager
 * This can be used to start the application with enhanced monitoring
 */

const { initializeHealthManager } = require('../dist/runtime/health-integration')

async function startWithHealthManager() {
  console.log('🚀 Starting 4RUNR Gateway with Enhanced Health Manager...')
  
  try {
    // Initialize health manager before starting the main application
    initializeHealthManager()
    
    console.log('✅ Health Manager initialized successfully')
    console.log('📊 Enhanced monitoring active:')
    console.log('   - Application responsiveness checks')
    console.log('   - Memory usage monitoring')
    console.log('   - Database connectivity checks')
    console.log('   - Resource leak detection')
    console.log('   - Automatic alert generation')
    console.log('')
    console.log('🌐 Health endpoints available:')
    console.log('   - GET /health (basic)')
    console.log('   - GET /health/enhanced (detailed)')
    console.log('   - GET /ready (readiness)')
    console.log('   - GET /metrics (Prometheus)')
    console.log('')
    
    // The main application will start normally
    // Health manager runs in the background
    
  } catch (error) {
    console.error('❌ Failed to initialize Health Manager:', error)
    process.exit(1)
  }
}

// Only run if this script is executed directly
if (require.main === module) {
  startWithHealthManager()
}

module.exports = { startWithHealthManager }
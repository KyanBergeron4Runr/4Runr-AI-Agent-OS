#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting Production Gateway...');

// Start the production gateway
const gateway = spawn('node', ['production-gateway.js'], {
  stdio: 'inherit',
  cwd: __dirname
});

// Handle process events
gateway.on('error', (error) => {
  console.error('❌ Failed to start production gateway:', error.message);
  process.exit(1);
});

gateway.on('close', (code) => {
  if (code === 0) {
    console.log('✅ Production gateway stopped gracefully');
  } else {
    console.log(`⚠️ Production gateway stopped with code ${code}`);
  }
});

// Handle SIGINT (Ctrl+C)
process.on('SIGINT', () => {
  console.log('\n🛑 Stopping production gateway...');
  gateway.kill('SIGINT');
});

// Handle SIGTERM
process.on('SIGTERM', () => {
  console.log('\n🛑 Stopping production gateway...');
  gateway.kill('SIGTERM');
});

console.log('📋 Production gateway is starting...');
console.log('📋 Available endpoints:');
console.log('  GET  /health');
console.log('  GET  /ready');
console.log('  GET  /metrics');
console.log('  POST /api/runs (with validation & idempotency)');
console.log('  GET  /api/runs/:id');
console.log('  POST /api/runs/:id/start');
console.log('  POST /api/runs/:id/cancel');
console.log('  GET  /api/runs/:id/logs/stream (SSE)');
console.log('  GET  /diagnostics/sse-test (SSE)');
console.log('\nPress Ctrl+C to stop');

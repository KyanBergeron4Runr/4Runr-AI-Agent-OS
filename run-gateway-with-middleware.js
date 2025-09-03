#!/usr/bin/env node

// Set environment variables for middleware
process.env.VALIDATION_ENFORCE = 'strict';
process.env.IDEMPOTENCY_ENABLED = 'true';
process.env.IDEMPOTENCY_TTL_SECONDS = '86400';
process.env.PORT = '3000';
process.env.HOST = '127.0.0.1';

console.log('🚀 Starting 4Runr Gateway with Middleware');
console.log('📝 Validation: strict');
console.log('🔄 Idempotency: enabled (24h TTL)');
console.log('🌐 Port: 3000');
console.log('🏠 Host: 127.0.0.1');
console.log('');

// Import and run the gateway
import('./apps/gateway/src/index-with-middleware.ts')
  .then(() => {
    console.log('✅ Gateway started successfully');
  })
  .catch((error) => {
    console.error('❌ Failed to start gateway:', error);
    process.exit(1);
  });

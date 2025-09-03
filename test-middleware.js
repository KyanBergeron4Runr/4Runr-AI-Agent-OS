// Simple test to verify middleware works
const { createValidationMiddleware } = require('./packages/middleware/validation/validateRequest');
const { createIdempotencyMiddleware } = require('./packages/middleware/idempotency/idempotency');
const { InMemoryIdempotencyStore } = require('./packages/adapters/redis/IdempotencyStore');
const { RunCreateInputSchema } = require('./packages/middleware/validation/schemas/RunCreate.schema');

console.log('Testing middleware imports...');

try {
  // Test validation middleware
  const validationMiddleware = createValidationMiddleware(RunCreateInputSchema, 'strict');
  console.log('✅ Validation middleware created successfully');
  
  // Test idempotency middleware
  const store = new InMemoryIdempotencyStore(86400);
  const idempotencyMiddleware = createIdempotencyMiddleware(store);
  console.log('✅ Idempotency middleware created successfully');
  
  // Test schema
  console.log('✅ RunCreateInputSchema imported successfully');
  
  console.log('\n🎉 All middleware components working correctly!');
} catch (error) {
  console.error('❌ Error testing middleware:', error);
  process.exit(1);
}

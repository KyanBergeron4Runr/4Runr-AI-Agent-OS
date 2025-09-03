#!/usr/bin/env node

const Fastify = require('fastify');

// Set environment variables for middleware
process.env.VALIDATION_ENFORCE = 'strict';
process.env.IDEMPOTENCY_ENABLED = 'true';
process.env.IDEMPOTENCY_TTL_SECONDS = '86400';

console.log('🚀 Starting Simple 4Runr Gateway with Middleware');
console.log('📝 Validation: strict');
console.log('🔄 Idempotency: enabled (24h TTL)');
console.log('🌐 Port: 3000');
console.log('🏠 Host: 127.0.0.1');
console.log('');

// Simple in-memory storage
const runs = new Map();
const idempotencyStore = new Map();
let runCounter = 0;

// Create Fastify instance
const fastify = Fastify({
  logger: true,
  trustProxy: true
});

// Simple validation middleware
function createValidationMiddleware() {
  return async (request, reply) => {
    const body = request.body;
    
    // Basic validation rules
    if (!body.name || body.name.trim().length === 0) {
      return reply.status(422).send({
        error: 'validation_error',
        details: [{ path: 'name', code: 'too_short' }]
      });
    }
    
    if (body.name.length > 100) {
      return reply.status(422).send({
        error: 'validation_error',
        details: [{ path: 'name', code: 'too_long' }]
      });
    }
    
    // Check input size
    const inputSize = JSON.stringify(body.input || {}).length;
    if (inputSize > 50000) {
      return reply.status(422).send({
        error: 'validation_error',
        details: [{ path: 'input', code: 'too_large' }]
      });
    }
    
    // Check tags array
    if (body.tags && !Array.isArray(body.tags)) {
      return reply.status(422).send({
        error: 'validation_error',
        details: [{ path: 'tags', code: 'invalid_type' }]
      });
    }
    
    if (body.tags && body.tags.length > 10) {
      return reply.status(422).send({
        error: 'validation_error',
        details: [{ path: 'tags', code: 'too_many_items' }]
      });
    }
  };
}

// Simple idempotency middleware
function createIdempotencyMiddleware() {
  return async (request, reply) => {
    const idempotencyKey = request.headers['idempotency-key'];
    
    if (!idempotencyKey) {
      console.log('[DEBUG] No idempotency key provided');
      return; // No key, proceed normally
    }
    
    console.log(`[DEBUG] Processing idempotency key: ${idempotencyKey}`);
    
    // Validate UUID format (basic check)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(idempotencyKey)) {
      console.log(`[DEBUG] Invalid UUID format: ${idempotencyKey}`);
      return reply.status(400).send({
        error: 'invalid_idempotency_key',
        message: 'Idempotency key must be a valid UUID'
      });
    }
    
    // Check if we have a stored response
    const stored = idempotencyStore.get(idempotencyKey);
    console.log(`[DEBUG] Stored response found: ${!!stored}`);
    if (stored) {
      console.log(`[DEBUG] Stored status: ${stored.statusCode}, Store size: ${idempotencyStore.size}`);
    }
    
    if (stored) {
      const bodyHash = JSON.stringify(request.body);
      console.log(`[DEBUG] Body hash comparison:`);
      console.log(`  Stored: ${stored.bodyHash}`);
      console.log(`  Current: ${bodyHash}`);
      console.log(`  Match: ${stored.bodyHash === bodyHash}`);
      
      if (stored.bodyHash === bodyHash) {
        // Same key + body, return stored response
        console.log(`[DEBUG] Idempotency HIT - returning stored response`);
        reply.status(stored.statusCode);
        reply.send(stored.response);
        return; // IMPORTANT: Stop execution here
      } else {
        // Same key + different body, conflict
        console.log(`[DEBUG] Idempotency CONFLICT - different body`);
        return reply.status(409).send({
          error: 'idempotency_conflict',
          details: {
            expectedHash: stored.bodyHash,
            actualHash: bodyHash
          }
        });
      }
    }
    
    // Store request info for later
    request.idempotencyKey = idempotencyKey;
    request.bodyHash = JSON.stringify(request.body);
    console.log(`[DEBUG] Idempotency MISS - storing request info`);
  };
}

// Capture idempotency response
function captureIdempotencyResponse() {
  return async (request, reply, payload) => {
    if (request.idempotencyKey) {
      console.log(`[DEBUG] Storing idempotency response for key: ${request.idempotencyKey}`);
      console.log(`[DEBUG] Status: ${reply.statusCode}, Body hash: ${request.bodyHash}`);
      
      idempotencyStore.set(request.idempotencyKey, {
        bodyHash: request.bodyHash,
        statusCode: reply.statusCode,
        response: payload
      });
      
      console.log(`[DEBUG] Stored response. Store size: ${idempotencyStore.size}`);
    }
  };
}

// Health endpoint
fastify.get('/health', async (request, reply) => {
  reply.header('X-Gateway', 'main');
  return {
    ok: true,
    version: '1.0.0',
    time: new Date().toISOString()
  };
});

// Create run endpoint with middleware
fastify.post('/api/runs', {
  onRequest: [
    createIdempotencyMiddleware()
  ],
  preHandler: [
    createValidationMiddleware()
  ]
}, async (request, reply) => {
  const body = request.body;
  const runId = `run-${Date.now()}-${++runCounter}`;
  
  const run = {
    id: runId,
    name: body.name,
    status: 'created',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    input: body.input || '',
    output: null,
    logs: []
  };
  
  runs.set(runId, run);
  console.log(`[INFO] Run created: ${runId}, name: ${run.name}`);
  
  const response = {
    success: true,
    run: run
  };
  
  // Store idempotency response immediately
  if (request.idempotencyKey) {
    console.log(`[DEBUG] Storing idempotency response for key: ${request.idempotencyKey}`);
    idempotencyStore.set(request.idempotencyKey, {
      bodyHash: request.bodyHash,
      statusCode: 201,
      response: response
    });
    console.log(`[DEBUG] Stored response. Store size: ${idempotencyStore.size}`);
  }
  
  reply.status(201);
  return response;
});

// Get run endpoint
fastify.get('/api/runs/:id', async (request, reply) => {
  const { id } = request.params;
  const run = runs.get(id);
  
  if (!run) {
    return reply.status(404).send({ error: 'Run not found' });
  }
  
  return run;
});

// Start the server
const start = async () => {
  try {
    await fastify.listen({ port: 3000, host: '127.0.0.1' });
    console.log('✅ Gateway server listening on 127.0.0.1:3000');
    console.log('📝 Validation: strict');
    console.log('🔄 Idempotency: enabled (24h TTL)');
  } catch (err) {
    console.error('❌ Failed to start gateway:', err);
    process.exit(1);
  }
};

start();

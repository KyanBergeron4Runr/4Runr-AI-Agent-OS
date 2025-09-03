#!/usr/bin/env node

const Fastify = require('fastify');

console.log('🚀 Starting Simple Test Gateway');
console.log('🌐 Port: 9999');
console.log('🏠 Host: 127.0.0.1');
console.log('');

// Simple in-memory storage
const idempotencyStore = new Map();
let runCounter = 0;

// Create Fastify instance
const fastify = Fastify({
  logger: false // Disable logging for simplicity
});

// Simple idempotency middleware
function createIdempotencyMiddleware() {
  return async (request, reply) => {
    const idempotencyKey = request.headers['idempotency-key'];
    
    if (!idempotencyKey) {
      return; // No key, proceed normally
    }
    
    console.log(`[DEBUG] Processing idempotency key: ${idempotencyKey}`);
    
    // Check if we have a stored response
    const stored = idempotencyStore.get(idempotencyKey);
    if (stored) {
      const bodyHash = JSON.stringify(request.body);
      if (stored.bodyHash === bodyHash) {
        // Same key + body, return stored response with 200 status
        console.log(`[DEBUG] Idempotency HIT - returning stored response with 200 status`);
        reply.status(200); // Return 200 for cached responses, not the stored 201
        reply.send(stored.response);
        return; // Stop execution here
      } else {
        // Same key + different body, conflict
        console.log(`[DEBUG] Idempotency CONFLICT - different body`);
        return reply.status(409).send({
          error: 'idempotency_conflict',
          details: { expectedHash: stored.bodyHash, actualHash: bodyHash }
        });
      }
    }
    
    // Store request info for later
    request.idempotencyKey = idempotencyKey;
    request.bodyHash = JSON.stringify(request.body);
    console.log(`[DEBUG] Idempotency MISS - storing request info`);
  };
}

// Health endpoint
fastify.get('/health', async (request, reply) => {
  return { ok: true, version: '1.0.0', time: new Date().toISOString() };
});

// Create run endpoint with idempotency and inline validation
fastify.post('/api/runs', {
  preHandler: [createIdempotencyMiddleware()]
}, async (request, reply) => {
  const body = request.body;
  
  // Basic validation
  if (!body.name || body.name.trim() === '') {
    return reply.status(422).send({
      error: 'validation_error',
      details: [{ path: 'name', code: 'too_short', message: 'Name is required' }]
    });
  }
  
  if (body.tags && !Array.isArray(body.tags)) {
    return reply.status(422).send({
      error: 'validation_error',
      details: [{ path: 'tags', code: 'invalid_type', message: 'Tags must be an array' }]
    });
  }
  
  // Check for size limits (70KB = ~70000 chars)
  const bodySize = JSON.stringify(body).length;
  if (bodySize > 70000) {
    return reply.status(422).send({
      error: 'validation_error',
      details: [{ path: 'body', code: 'too_large', message: 'Request body too large' }]
    });
  }
  
  const runId = `run-${Date.now()}-${++runCounter}`;
  
  const run = {
    id: runId,
    name: body.name,
    status: 'created',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  
  const response = { success: true, run: run };
  
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

// Start the server
const start = async () => {
  try {
    await fastify.listen({ port: 9999, host: '127.0.0.1' });
    console.log('✅ Gateway server listening on 127.0.0.1:9999');
  } catch (err) {
    console.error('❌ Failed to start gateway:', err);
    process.exit(1);
  }
};

start();

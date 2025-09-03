const http = require('http');
const url = require('url');
const crypto = require('crypto');

// Configuration with environment variable support
const CONFIG = {
  BODY_LIMIT_BYTES: parseInt(process.env.GATEWAY_BODY_LIMIT_BYTES) || 262144, // 256KB
  RUN_INPUT_STRING_MAX: parseInt(process.env.RUN_INPUT_STRING_MAX) || 65536, // 64KB
  IDEMP_TTL_MS: parseInt(process.env.IDEMP_TTL_MS) || 86400000, // 24h
  RATE_LIMIT_ENABLED: process.env.RATE_LIMIT_ENABLED === 'true',
  RATE_LIMIT_PER_SEC: parseInt(process.env.RATE_LIMIT_PER_SEC) || 50,
  PORT: process.env.PORT || 3000,
  HOST: process.env.HOST || '127.0.0.1'
};

// In-memory storage
const runs = new Map();
const sseClients = new Set();
const idempotencyStore = new Map(); // client_token -> { runId, timestamp }
let runCounter = 0;
let sseMessageCounter = 0;
let sseConnectionsOpened = 0;
let sseConnectionsClosed = 0;

// Rate limiting state
const rateLimitStore = new Map(); // IP -> { count, resetTime }

// Simple logger
const log = (msg, data = '') => console.log(`[${new Date().toISOString()}] ${msg}`, data);

// Input validation schemas
const VALIDATION_SCHEMAS = {
  createRun: {
    name: {
      required: true,
      type: 'string',
      maxLength: 128,
      validate: (value) => value.trim().length > 0
    },
    input: {
      required: false,
      type: ['string', 'object'],
      maxStringLength: CONFIG.RUN_INPUT_STRING_MAX,
      maxObjectSize: CONFIG.BODY_LIMIT_BYTES / 2
    },
    client_token: {
      required: false,
      type: 'string',
      minLength: 8,
      maxLength: 128,
      pattern: /^[a-zA-Z0-9_-]+$/
    },
    tags: {
      required: false,
      type: 'array',
      maxItems: 16,
      itemSchema: {
        type: 'string',
        maxLength: 64
      }
    }
  }
};

// Validation functions
const validateField = (value, schema, fieldName) => {
  const errors = [];
  
  // Check required
  if (schema.required && (value === undefined || value === null || value === '')) {
    errors.push(`${fieldName} is required`);
    return errors;
  }
  
  if (value === undefined || value === null) {
    return errors; // Optional field, skip validation
  }
  
  // Check type
  if (schema.type) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    const isValidType = types.some(type => {
      if (type === 'string') return typeof value === 'string';
      if (type === 'object') return typeof value === 'object' && !Array.isArray(value);
      if (type === 'array') return Array.isArray(value);
      return false;
    });
    
    if (!isValidType) {
      errors.push(`${fieldName} must be ${types.join(' or ')}`);
      return errors;
    }
  }
  
  // String validations
  if (typeof value === 'string') {
    if (schema.maxLength && value.length > schema.maxLength) {
      errors.push(`${fieldName} must be at most ${schema.maxLength} characters`);
    }
    if (schema.minLength && value.length < schema.minLength) {
      errors.push(`${fieldName} must be at least ${schema.minLength} characters`);
    }
    if (schema.pattern && !schema.pattern.test(value)) {
      errors.push(`${fieldName} format is invalid`);
    }
    if (schema.validate && !schema.validate(value)) {
      errors.push(`${fieldName} validation failed`);
    }
  }
  
  // Array validations
  if (Array.isArray(value)) {
    if (schema.maxItems && value.length > schema.maxItems) {
      errors.push(`${fieldName} must have at most ${schema.maxItems} items`);
    }
    if (schema.itemSchema) {
      value.forEach((item, index) => {
        const itemErrors = validateField(item, schema.itemSchema, `${fieldName}[${index}]`);
        errors.push(...itemErrors);
      });
    }
  }
  
  // Object size validation
  if (typeof value === 'object' && !Array.isArray(value) && schema.maxObjectSize) {
    const objectSize = JSON.stringify(value).length;
    if (objectSize > schema.maxObjectSize) {
      errors.push(`${fieldName} object size exceeds limit of ${schema.maxObjectSize} bytes`);
    }
  }
  
  return errors;
};

const validateRequest = (data, schema) => {
  const errors = [];
  
  for (const [fieldName, fieldSchema] of Object.entries(schema)) {
    const fieldErrors = validateField(data[fieldName], fieldSchema, fieldName);
    errors.push(...fieldErrors);
  }
  
  return errors;
};

// Rate limiting
const checkRateLimit = (ip) => {
  if (!CONFIG.RATE_LIMIT_ENABLED) return { allowed: true };
  
  const now = Date.now();
  const windowMs = 1000; // 1 second window
  const key = `${ip}:${Math.floor(now / windowMs)}`;
  
  const current = rateLimitStore.get(key) || { count: 0, resetTime: now + windowMs };
  
  if (now > current.resetTime) {
    current.count = 0;
    current.resetTime = now + windowMs;
  }
  
  if (current.count >= CONFIG.RATE_LIMIT_PER_SEC) {
    return { allowed: false, retryAfter: Math.ceil((current.resetTime - now) / 1000) };
  }
  
  current.count++;
  rateLimitStore.set(key, current);
  
  // Clean up old entries
  for (const [oldKey] of rateLimitStore) {
    if (oldKey !== key) {
      const [, timestamp] = oldKey.split(':');
      if (now - parseInt(timestamp) * windowMs > 60000) { // Keep 1 minute
        rateLimitStore.delete(oldKey);
      }
    }
  }
  
  return { allowed: true };
};

// Idempotency
const handleIdempotency = (clientToken) => {
  if (!clientToken) return { isDuplicate: false };
  
  const now = Date.now();
  const existing = idempotencyStore.get(clientToken);
  
  if (existing && (now - existing.timestamp) < CONFIG.IDEMP_TTL_MS) {
    return { isDuplicate: true, runId: existing.runId };
  }
  
  // Clean up expired entries
  for (const [token, entry] of idempotencyStore) {
    if ((now - entry.timestamp) >= CONFIG.IDEMP_TTL_MS) {
      idempotencyStore.delete(token);
    }
  }
  
  return { isDuplicate: false };
};

const storeIdempotency = (clientToken, runId) => {
  if (!clientToken) return;
  
  idempotencyStore.set(clientToken, {
    runId,
    timestamp: Date.now()
  });
};

// Create HTTP server
const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const path = parsedUrl.pathname;
  const method = req.method;
  const clientIp = req.socket.remoteAddress || req.headers['x-forwarded-for'] || 'unknown';

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Workspace-ID, Last-Event-ID');

  // Handle preflight
  if (method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Helper to send JSON response
  const sendJson = (statusCode, data) => {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  };

  // Helper to send SSE response
  const sendSSE = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  log(`${method} ${path} - IP: ${clientIp} - Headers: ${JSON.stringify(req.headers)}`);

  // Health endpoint
  if (path === '/health' && method === 'GET') {
    return sendJson(200, {
      ok: true,
      version: '2.0.0',
      time: new Date().toISOString(),
      config: {
        bodyLimitBytes: CONFIG.BODY_LIMIT_BYTES,
        rateLimitEnabled: CONFIG.RATE_LIMIT_ENABLED,
        rateLimitPerSec: CONFIG.RATE_LIMIT_PER_SEC
      }
    });
  }

  // Ready endpoint
  if (path === '/ready' && method === 'GET') {
    return sendJson(200, {
      ready: true,
      timestamp: new Date().toISOString()
    });
  }

  // Metrics endpoint
  if (path === '/metrics' && method === 'GET') {
    const activeConnections = sseConnectionsOpened - sseConnectionsClosed;
    const metrics = [
      '# HELP runs_total Total number of runs',
      '# TYPE runs_total counter',
      `runs_total ${runs.size}`,
      '',
      '# HELP sse_connections_opened Total SSE connections opened',
      '# TYPE sse_connections_opened counter',
      `sse_connections_opened ${sseConnectionsOpened}`,
      '',
      '# HELP sse_connections_closed Total SSE connections closed',
      '# TYPE sse_connections_closed counter',
      `sse_connections_closed ${sseConnectionsClosed}`,
      '',
      '# HELP sse_active_connections Active SSE connections',
      '# TYPE sse_active_connections gauge',
      `sse_active_connections ${Math.max(0, activeConnections)}`,
      '',
      '# HELP sse_messages_total Total SSE messages sent',
      '# TYPE sse_messages_total counter',
      `sse_messages_total ${sseMessageCounter}`,
      '',
      '# HELP idempotency_store_size Current idempotency store size',
      '# TYPE idempotency_store_size gauge',
      `idempotency_store_size ${idempotencyStore.size}`
    ].join('\n');

    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end(metrics);
    return;
  }

  // Create run endpoint with validation and idempotency
  if (path === '/api/runs' && method === 'POST') {
    // Check rate limit
    const rateLimitResult = checkRateLimit(clientIp);
    if (!rateLimitResult.allowed) {
      res.setHeader('Retry-After', rateLimitResult.retryAfter);
      return sendJson(429, { 
        error: 'Rate limit exceeded',
        retryAfter: rateLimitResult.retryAfter
      });
    }

    let body = '';
    let bodySize = 0;
    
    req.on('data', chunk => {
      bodySize += chunk.length;
      if (bodySize > CONFIG.BODY_LIMIT_BYTES) {
        req.destroy();
        return;
      }
      body += chunk;
    });
    
    req.on('error', (err) => {
      if (err.code === 'ECONNRESET') {
        log('Request body too large, connection reset');
      }
    });
    
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        
        // Validate input
        const validationErrors = validateRequest(data, VALIDATION_SCHEMAS.createRun);
        if (validationErrors.length > 0) {
          return sendJson(422, { 
            error: 'Validation failed',
            details: validationErrors
          });
        }
        
        // Check idempotency
        const idempResult = handleIdempotency(data.client_token);
        if (idempResult.isDuplicate) {
          const existingRun = runs.get(idempResult.runId);
          if (existingRun) {
            return sendJson(200, {
              success: true,
              run: existingRun,
              idempotent: true
            });
          }
        }
        
        const runId = `run-${Date.now()}-${++runCounter}`;
        
        const run = {
          id: runId,
          name: data.name,
          status: 'created',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          input: data.input || '',
          output: null,
          logs: [],
          tags: data.tags || [],
          client_token: data.client_token || null
        };
        
        runs.set(runId, run);
        
        // Store idempotency mapping
        if (data.client_token) {
          storeIdempotency(data.client_token, runId);
        }
        
        log('Run created', { runId, name: run.name, clientToken: data.client_token });
        
        sendJson(201, {
          success: true,
          run: run
        });
      } catch (e) {
        if (e instanceof SyntaxError) {
          return sendJson(400, { error: 'Invalid JSON' });
        }
        return sendJson(500, { error: 'Internal server error' });
      }
    });
    return;
  }

  // SSE endpoint for run logs (must come before general GET endpoint)
  if (path.startsWith('/api/runs/') && path.endsWith('/logs/stream') && method === 'GET') {
    const runId = path.split('/')[3];
    const run = runs.get(runId);
    
    // If run doesn't exist, create a placeholder run for SSE
    if (!run) {
      const placeholderRun = {
        id: runId,
        name: `SSE-Run-${runId}`,
        status: 'created',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        input: '',
        output: null,
        logs: []
      };
      runs.set(runId, placeholderRun);
      log('Created placeholder run for SSE', { runId });
    }
    
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });

    const clientId = `sse-${Date.now()}-${Math.random()}`;
    sseClients.add(clientId);
    sseConnectionsOpened++;
    sseMessageCounter++;
    
    let messageId = 1;
    const lastEventId = req.headers['last-event-id'];
    if (lastEventId && !isNaN(Number(lastEventId))) {
      messageId = Number(lastEventId) + 1;
    }
    
    const sendEvent = (data) => {
      res.write(`id: ${messageId++}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
      sseMessageCounter++;
    };

    // Send initial connection event
    sendEvent({
      type: 'connected',
      runId: runId,
      timestamp: new Date().toISOString()
    });

    // Send run status updates every 5 seconds
    const interval = setInterval(() => {
      const currentRun = runs.get(runId);
      if (currentRun) {
        sendEvent({
          type: 'status_update',
          runId: runId,
          status: currentRun.status,
          timestamp: new Date().toISOString()
        });
        
        // Close stream if run is completed, failed, or canceled
        if (['completed', 'failed', 'canceled'].includes(currentRun.status)) {
          sendEvent({
            type: 'final',
            runId: runId,
            status: currentRun.status,
            timestamp: new Date().toISOString()
          });
          res.end();
          clearInterval(interval);
          sseClients.delete(clientId);
          sseConnectionsClosed++;
          log(`SSE client ${clientId} disconnected (run ${currentRun.status}). Active: ${sseConnectionsOpened - sseConnectionsClosed}`);
        }
      }
    }, 5000);

    // Clean up on disconnect
    req.on('close', () => {
      clearInterval(interval);
      sseClients.delete(clientId);
      sseConnectionsClosed++;
      log(`SSE client ${clientId} disconnected. Active: ${sseConnectionsOpened - sseConnectionsClosed}`);
    });

    log(`SSE client ${clientId} connected. Active: ${sseConnectionsOpened - sseConnectionsClosed}`);
    return;
  }

  // Get run endpoint
  if (path.startsWith('/api/runs/') && method === 'GET') {
    const runId = path.split('/')[3];
    const run = runs.get(runId);
    
    if (!run) {
      return sendJson(404, { error: 'Run not found' });
    }
    
    return sendJson(200, {
      success: true,
      run: run
    });
  }

  // Cancel run endpoint
  if (path.startsWith('/api/runs/') && path.endsWith('/cancel') && method === 'POST') {
    const runId = path.split('/')[3];
    const run = runs.get(runId);
    
    if (!run) {
      return sendJson(404, { error: 'Run not found' });
    }
    
    if (run.status === 'canceled') {
      return sendJson(409, { error: 'Run already canceled' });
    }
    
    if (run.status === 'completed' || run.status === 'failed') {
      return sendJson(409, { error: 'Cannot cancel completed run' });
    }
    
    // Update run status
    run.status = 'canceled';
    run.canceled_at = new Date().toISOString();
    run.updated_at = new Date().toISOString();
    run.logs.push({
      timestamp: new Date().toISOString(),
      level: 'info',
      message: 'Run canceled by user'
    });
    
    log('Run canceled', { runId });
    
    return sendJson(202, {
      success: true,
      run: run
    });
  }

  // Start run endpoint
  if (path.startsWith('/api/runs/') && path.endsWith('/start') && method === 'POST') {
    const runId = path.split('/')[3];
    const run = runs.get(runId);
    
    if (!run) {
      return sendJson(404, { error: 'Run not found' });
    }
    
    if (run.status === 'canceled') {
      return sendJson(409, { error: 'Cannot start canceled run' });
    }
    
    // Update run status
    run.status = 'in-progress';
    run.started_at = new Date().toISOString();
    run.updated_at = new Date().toISOString();
    
    // Simulate run completion after 30 seconds (unless canceled)
    setTimeout(() => {
      if (runs.has(runId)) {
        const completedRun = runs.get(runId);
        if (completedRun.status === 'in-progress') {
          completedRun.status = 'completed';
          completedRun.completed_at = new Date().toISOString();
          completedRun.updated_at = new Date().toISOString();
          completedRun.output = 'Run completed successfully';
          completedRun.logs.push({
            timestamp: new Date().toISOString(),
            level: 'info',
            message: 'Run completed'
          });
          log('Run completed', { runId });
        }
      }
    }, 30000);
    
    log('Run started', { runId });
    
    return sendJson(200, {
      success: true,
      run: run
    });
  }



  // General SSE endpoint (for S2 harness)
  if (path === '/api/sse/stream' && method === 'GET') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });

    const clientId = `sse-general-${Date.now()}-${Math.random()}`;
    sseClients.add(clientId);
    sseConnectionsOpened++;
    sseMessageCounter++;
    
    let messageId = 1;
    const lastEventId = req.headers['last-event-id'];
    if (lastEventId && !isNaN(Number(lastEventId))) {
      messageId = Number(lastEventId) + 1;
    }

    const sendEvent = (data) => {
      res.write(`id: ${messageId++}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
      sseMessageCounter++;
    };

    // Send initial connection event
    sendEvent({
      type: 'connected',
      clientId: clientId,
      timestamp: new Date().toISOString()
    });

    // Send heartbeat events every 5 seconds
    const interval = setInterval(() => {
      sendEvent({
        type: 'heartbeat',
        clientId: clientId,
        timestamp: new Date().toISOString(),
        activeConnections: sseConnectionsOpened - sseConnectionsClosed
      });
    }, 5000);

    // Clean up on disconnect
    req.on('close', () => {
      clearInterval(interval);
      sseClients.delete(clientId);
      sseConnectionsClosed++;
      log(`SSE general client ${clientId} disconnected. Active: ${sseConnectionsOpened - sseConnectionsClosed}`);
    });

    log(`SSE general client ${clientId} connected. Active: ${sseConnectionsOpened - sseConnectionsClosed}`);
    return;
  }

  // SSE test endpoint
  if (path === '/diagnostics/sse-test' && method === 'GET') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });

    const clientId = `sse-test-${Date.now()}-${Math.random()}`;
    sseClients.add(clientId);
    sseConnectionsOpened++;
    sseMessageCounter++;
    
    let messageId = 1;
    const lastEventId = req.headers['last-event-id'];
    if (lastEventId && !isNaN(Number(lastEventId))) {
      messageId = Number(lastEventId) + 1;
    }

    const sendEvent = (data) => {
      res.write(`id: ${messageId++}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
      sseMessageCounter++;
    };

    // Send test events every 2 seconds
    const interval = setInterval(() => {
      sendEvent({
        type: 'test',
        timestamp: new Date().toISOString(),
        message: 'SSE test event',
        activeConnections: sseConnectionsOpened - sseConnectionsClosed
      });
    }, 2000);

    // Clean up on disconnect
    req.on('close', () => {
      clearInterval(interval);
      sseClients.delete(clientId);
      sseConnectionsClosed++;
      log(`SSE test client ${clientId} disconnected. Active: ${sseConnectionsOpened - sseConnectionsClosed}`);
    });

    log(`SSE test client ${clientId} connected. Active: ${sseConnectionsOpened - sseConnectionsClosed}`);
    return;
  }

  // 404 for everything else
  sendJson(404, { error: 'Not found' });
});

server.listen(CONFIG.PORT, CONFIG.HOST, () => {
  log(`🚀 Production Gateway running on http://${CONFIG.HOST}:${CONFIG.PORT}`);
  log('📋 Configuration:');
  log(`  Body limit: ${CONFIG.BODY_LIMIT_BYTES} bytes`);
  log(`  Rate limiting: ${CONFIG.RATE_LIMIT_ENABLED ? 'enabled' : 'disabled'}`);
  if (CONFIG.RATE_LIMIT_ENABLED) {
    log(`  Rate limit: ${CONFIG.RATE_LIMIT_PER_SEC} req/sec`);
  }
  log(`  Idempotency TTL: ${CONFIG.IDEMP_TTL_MS}ms`);
  log('📋 Available endpoints:');
  log('  GET  /health');
  log('  GET  /ready');
  log('  GET  /metrics');
  log('  POST /api/runs (with validation & idempotency)');
  log('  GET  /api/runs/:id');
  log('  POST /api/runs/:id/start');
  log('  POST /api/runs/:id/cancel');
  log('  GET  /api/runs/:id/logs/stream (SSE)');
  log('  GET  /diagnostics/sse-test (SSE)');
  log('Press Ctrl+C to stop');
});

// Graceful shutdown
process.on('SIGINT', () => {
  log('🛑 Shutting down Production Gateway...');
  server.close(() => {
    log('✅ Production Gateway stopped');
    process.exit(0);
  });
});

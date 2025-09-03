import Fastify from 'fastify';

// Simple environment parsing
const PORT = parseInt(process.env['PORT'] || '3000', 10);
const HOST = process.env['HOST'] || '127.0.0.1';

// Simple logger
const logger = {
  info: (msg: string, data?: any) => console.log(`[INFO] ${msg}`, data || ''),
  error: (msg: string, data?: any) => console.error(`[ERROR] ${msg}`, data || ''),
  warn: (msg: string, data?: any) => console.warn(`[WARN] ${msg}`, data || '')
};

// In-memory storage for runs (in production, this would be a database)
const runs = new Map<string, any>();
let runCounter = 0;

// Create Fastify instance
const fastify = Fastify({
  logger: true,
  trustProxy: true
});

// Configure content type parser to handle empty bodies
fastify.addContentTypeParser('application/json', { parseAs: 'string' }, function (req, body, done) {
  try {
    if (body === '') {
      done(null, {});
    } else {
      const json = JSON.parse(body as string);
      done(null, json);
    }
  } catch (err) {
    const error = err as Error;
    (error as any).statusCode = 400;
    done(error, undefined);
  }
});

// Health endpoint
fastify.get('/health', async (request, reply) => {
  reply.header('X-Gateway', 'main');
  return {
    ok: true,
    version: '1.0.0',
    time: new Date().toISOString()
  };
});

// Readiness endpoint
fastify.get('/ready', async (request, reply) => {
  return {
    ready: true,
    timestamp: new Date().toISOString()
  };
});

// In-memory storage for SSE connections and metrics
const sseConnections = new Map<string, Set<any>>();
let sseMessageCounter = 0;
let sseConnectionsTotal = 0;

// Metrics endpoint
fastify.get('/metrics', async (request, reply) => {
  reply.header('X-Gateway', 'main');
  const activeConnections = Array.from(sseConnections.values()).reduce((sum, connections) => sum + connections.size, 0);
  
  const metrics = [
    '# HELP runs_total Total number of runs',
    '# TYPE runs_total counter',
    `runs_total ${runs.size}`,
    '',
    '# HELP sse_active_connections Active SSE connections',
    '# TYPE sse_active_connections gauge',
    `sse_active_connections ${activeConnections}`,
    '',
    '# HELP sse_messages_total Total SSE messages sent',
    '# TYPE sse_messages_total counter',
    `sse_messages_total ${sseMessageCounter}`,
    '',
    '# HELP sse_connections_total Total SSE connections made',
    '# TYPE sse_connections_total counter',
    `sse_connections_total ${sseConnectionsTotal}`
  ].join('\n');

  reply.type('text/plain');
  return metrics;
});

// Workspace plan endpoint
fastify.post('/api/workspace/plan', async (request, reply) => {
  const body = request.body as any;
  logger.info('Setting workspace plan', { plan: body.plan });
  
  return {
    success: true,
    plan: body.plan,
    updated_at: new Date().toISOString()
  };
});

// Create run endpoint
fastify.post('/api/runs', async (request, reply) => {
  const body = request.body as any;
  // Use the provided ID if available, otherwise generate one
  const runId = body.id || `run-${Date.now()}-${++runCounter}`;
  
  const run = {
    id: runId,
    name: body.name || 'Test Run',
    status: 'created',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    input: body.input || '',
    output: null,
    logs: []
  };
  
  runs.set(runId, run);
  logger.info('Run created', { runId, name: run.name });
  
  // Emit events to any waiting SSE connections
  const connections = sseConnections.get(runId);
  if (connections) {
    connections.forEach(connection => {
      connection.write(`event: log\ndata: ${JSON.stringify({
        type: 'run_created',
        runId: runId,
        timestamp: new Date().toISOString()
      })}\n\n`);
      sseMessageCounter++;
    });
  }
  
  reply.status(201);
  return {
    success: true,
    run: run
  };
});

// Get run endpoint
fastify.get('/api/runs/:id', async (request, reply) => {
  const { id } = request.params as { id: string };
  const run = runs.get(id);
  
  if (!run) {
    return reply.status(404).send({ error: 'Run not found' });
  }
  
  // Return the run data directly (not wrapped in success/run)
  return run;
});

// Start run endpoint
fastify.post('/api/runs/:id/start', async (request, reply) => {
  const { id } = request.params as { id: string };
  const run = runs.get(id);
  
  if (!run) {
    return reply.status(404).send({ error: 'Run not found' });
  }
  
  // Update run status to running immediately
  run.status = 'running';
  run.started_at = new Date().toISOString();
  run.updated_at = new Date().toISOString();
  
  // Emit events to SSE connections
  const connections = sseConnections.get(id);
  if (connections) {
    connections.forEach(connection => {
      connection.write(`event: log\ndata: ${JSON.stringify({
        type: 'run_started',
        runId: id,
        status: 'running',
        timestamp: new Date().toISOString()
      })}\n\n`);
      sseMessageCounter++;
    });
  }
  
  // Simulate run completion after 3 seconds (much faster for testing)
  setTimeout(() => {
    if (runs.has(id)) {
      const completedRun = runs.get(id);
      completedRun.status = 'completed';
      completedRun.completed_at = new Date().toISOString();
      completedRun.updated_at = new Date().toISOString();
      completedRun.output = 'Run completed successfully';
      completedRun.logs.push({
        timestamp: new Date().toISOString(),
        level: 'info',
        message: 'Run completed'
      });
      logger.info('Run completed', { runId: id });
      
      // Emit completion event
      const connections = sseConnections.get(id);
      if (connections) {
        connections.forEach(connection => {
          connection.write(`event: end\ndata: ${JSON.stringify({
            type: 'run_completed',
            runId: id,
            status: 'completed',
            timestamp: new Date().toISOString()
          })}\n\n`);
          sseMessageCounter++;
        });
      }
    }
  }, 3000);
  
  logger.info('Run started', { runId: id });
  
  return {
    success: true,
    run: run
  };
});

// SSE endpoint for run logs - TOLERANT of pre-run subscriptions
fastify.get('/api/runs/:id/logs/stream', async (request, reply) => {
  const { id } = request.params as { id: string };
  const run = runs.get(id);
  
  // Don't 404 if run doesn't exist - keep connection open for pre-run subscriptions
  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });

  // Track this connection
  if (!sseConnections.has(id)) {
    sseConnections.set(id, new Set());
  }
  sseConnections.get(id)!.add(reply.raw);
  sseConnectionsTotal++;
  sseMessageCounter++;

  let messageId = 1;
  const lastEventId = request.headers['last-event-id'];
  if (lastEventId && !isNaN(Number(lastEventId))) {
    messageId = Number(lastEventId) + 1;
  }
  
  const sendEvent = (data: any) => {
    reply.raw.write(`id: ${messageId++}\n`);
    reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
    sseMessageCounter++;
  };

  // Send initial connection event
  sendEvent({
    type: 'connected',
    runId: id,
    timestamp: new Date().toISOString()
  });

  // Send heartbeat every 15 seconds to keep connection alive
  const heartbeatInterval = setInterval(() => {
    reply.raw.write(': keepalive\n\n');
  }, 15000);

  // Send run status updates every 5 seconds (if run exists)
  const statusInterval = setInterval(() => {
    const currentRun = runs.get(id);
    if (currentRun) {
      sendEvent({
        type: 'status_update',
        runId: id,
        status: currentRun.status,
        timestamp: new Date().toISOString()
      });
    }
  }, 5000);

  // Clean up on disconnect
  request.raw.on('close', () => {
    clearInterval(heartbeatInterval);
    clearInterval(statusInterval);
    
    // Remove from tracking
    const connections = sseConnections.get(id);
    if (connections) {
      connections.delete(reply.raw);
      if (connections.size === 0) {
        sseConnections.delete(id);
      }
    }
  });
});

// SSE endpoint for S2 harness pattern (without run ID)
fastify.get('/api/runs/logs/stream', async (request, reply) => {
  // Don't 404 - keep connection open for S2 harness
  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });

  // Track this connection with a generic ID
  const genericId = 's2-harness-generic';
  if (!sseConnections.has(genericId)) {
    sseConnections.set(genericId, new Set());
  }
  sseConnections.get(genericId)!.add(reply.raw);
  sseConnectionsTotal++;
  sseMessageCounter++;

  let messageId = 1;
  const lastEventId = request.headers['last-event-id'];
  if (lastEventId && !isNaN(Number(lastEventId))) {
    messageId = Number(lastEventId) + 1;
  }
  
  const sendEvent = (data: any) => {
    reply.raw.write(`id: ${messageId++}\n`);
    reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
    sseMessageCounter++;
  };

  // Send initial connection event
  sendEvent({
    type: 'connected',
    timestamp: new Date().toISOString()
  });

  // Send heartbeat every 15 seconds to keep connection alive
  const heartbeatInterval = setInterval(() => {
    reply.raw.write(': keepalive\n\n');
  }, 15000);

  // Clean up on disconnect
  request.raw.on('close', () => {
    clearInterval(heartbeatInterval);
    
    // Remove from tracking
    const connections = sseConnections.get(genericId);
    if (connections) {
      connections.delete(reply.raw);
      if (connections.size === 0) {
        sseConnections.delete(genericId);
      }
    }
  });
});

// Registry publish endpoint
fastify.post('/api/registry/publish', async (request, reply) => {
  const body = request.body as any;
  logger.info('Registry publish', { name: body.name, version: body.version });
  
  reply.status(201);
  return {
    success: true,
    name: body.name,
    version: body.version,
    published_at: new Date().toISOString()
  };
});

// Safety check endpoint
fastify.get('/api/safety/check', async (request, reply) => {
  return {
    status: 'safe',
    timestamp: new Date().toISOString()
  };
});

// Privacy toggle endpoint
fastify.post('/api/privacy/toggle', async (request, reply) => {
  const body = request.body as any;
  logger.info('Privacy toggle', { storePlain: body.storePlain });
  
  return {
    success: true,
    storePlain: body.storePlain,
    updated_at: new Date().toISOString()
  };
});

// Demo run endpoint for testing
fastify.post('/api/diagnostics/emit-demo-run', async (request, reply) => {
  const runId = `demo-run-${Date.now()}`;
  
  logger.info('Demo run created', { runId });
  
  return {
    success: true,
    runId,
    message: 'Demo run created successfully'
  };
});

// SSE test endpoint
fastify.get('/diagnostics/sse-test', async (request, reply) => {
  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });

  const sendEvent = (data: any) => {
    reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  // Send test events every 2 seconds
  const interval = setInterval(() => {
    sendEvent({
      type: 'test',
      timestamp: new Date().toISOString(),
      message: 'SSE test event'
    });
  }, 2000);

  // Clean up on disconnect
  request.raw.on('close', () => {
    clearInterval(interval);
  });
});

// Start server
const start = async () => {
  try {
    await fastify.listen({ 
      port: PORT, 
      host: HOST 
    });
    logger.info(`Gateway server listening on ${HOST}:${PORT}`);
  } catch (err) {
    logger.error('Error starting server:', err);
    process.exit(1);
  }
};

start();

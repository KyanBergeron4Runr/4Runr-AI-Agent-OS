import Fastify from 'fastify';
import cors from 'fastify-cors';
import { parseEnv } from '@4runr/shared/env';
import { logger } from '@4runr/shared/logger';

// Parse environment variables
const env = parseEnv();

// Create Fastify instance
const fastify = Fastify({
  logger: logger,
  trustProxy: true
});

// Register plugins
await fastify.register(cors, {
  origin: true,
  credentials: true
});

// Health endpoint
fastify.get('/health', async (request, reply) => {
  return {
    ok: true,
    service: 'sse-worker',
    version: '1.0.0',
    time: new Date().toISOString()
  };
});

// SSE stream endpoint
fastify.get('/api/runs/:runId/guard/stream', async (request, reply) => {
  const { runId } = request.params as { runId: string };
  
  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });

  const sendEvent = (data: any) => {
    reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  // Send initial connection event
  sendEvent({
    type: 'sentinel.heartbeat',
    runId,
    timestamp: new Date().toISOString(),
    message: 'SSE connection established'
  });

  // Send periodic heartbeat events
  const heartbeatInterval = setInterval(() => {
    sendEvent({
      type: 'sentinel.heartbeat',
      runId,
      timestamp: new Date().toISOString(),
      message: 'Heartbeat'
    });
  }, 5000);

  // Send some demo events
  setTimeout(() => {
    sendEvent({
      type: 'shield.decision',
      runId,
      timestamp: new Date().toISOString(),
      action: 'pass',
      reason: 'No violations detected'
    });
  }, 2000);

  setTimeout(() => {
    sendEvent({
      type: 'judge.verdict',
      runId,
      timestamp: new Date().toISOString(),
      groundedness: 0.95,
      citation_coverage: 0.8
    });
  }, 4000);

  // Clean up on disconnect
  request.raw.on('close', () => {
    clearInterval(heartbeatInterval);
    logger.info('SSE connection closed', { runId });
  });

  logger.info('SSE connection established', { runId });
});

// Start server
const start = async () => {
  try {
    await fastify.listen({ 
      port: 3001, 
      host: '0.0.0.0' 
    });
    logger.info('SSE Worker server listening on 0.0.0.0:3001');
  } catch (err) {
    logger.error('Error starting SSE worker:', err);
    process.exit(1);
  }
};

start();

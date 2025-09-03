import Fastify from 'fastify';
import cors from 'fastify-cors';
import { parseEnv } from '@4runr/shared/env';
import { logger } from '@4runr/shared/logger';
const env = parseEnv();
const fastify = Fastify({
    logger: logger,
    trustProxy: true
});
await fastify.register(cors, {
    origin: true,
    credentials: true
});
fastify.get('/health', async (request, reply) => {
    return {
        ok: true,
        service: 'sse-worker',
        version: '1.0.0',
        time: new Date().toISOString()
    };
});
fastify.get('/api/runs/:runId/guard/stream', async (request, reply) => {
    const { runId } = request.params;
    reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
    });
    const sendEvent = (data) => {
        reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
    };
    sendEvent({
        type: 'sentinel.heartbeat',
        runId,
        timestamp: new Date().toISOString(),
        message: 'SSE connection established'
    });
    const heartbeatInterval = setInterval(() => {
        sendEvent({
            type: 'sentinel.heartbeat',
            runId,
            timestamp: new Date().toISOString(),
            message: 'Heartbeat'
        });
    }, 5000);
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
    request.raw.on('close', () => {
        clearInterval(heartbeatInterval);
        logger.info('SSE connection closed', { runId });
    });
    logger.info('SSE connection established', { runId });
});
const start = async () => {
    try {
        await fastify.listen({
            port: 3001,
            host: '0.0.0.0'
        });
        logger.info('SSE Worker server listening on 0.0.0.0:3001');
    }
    catch (err) {
        logger.error('Error starting SSE worker:', err);
        process.exit(1);
    }
};
start();
//# sourceMappingURL=index.js.map
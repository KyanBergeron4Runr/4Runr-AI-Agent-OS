import Fastify from 'fastify';
const PORT = parseInt(process.env['PORT'] || '3000', 10);
const HOST = process.env['HOST'] || '127.0.0.1';
const logger = {
    info: (msg, data) => console.log(`[INFO] ${msg}`, data || ''),
    error: (msg, data) => console.error(`[ERROR] ${msg}`, data || ''),
    warn: (msg, data) => console.warn(`[WARN] ${msg}`, data || '')
};
const runs = new Map();
let runCounter = 0;
const fastify = Fastify({
    logger: true,
    trustProxy: true
});
fastify.addContentTypeParser('application/json', { parseAs: 'string' }, function (req, body, done) {
    try {
        if (body === '') {
            done(null, {});
        }
        else {
            const json = JSON.parse(body);
            done(null, json);
        }
    }
    catch (err) {
        const error = err;
        error.statusCode = 400;
        done(error, undefined);
    }
});
fastify.get('/health', async (request, reply) => {
    reply.header('X-Gateway', 'main');
    return {
        ok: true,
        version: '1.0.0',
        time: new Date().toISOString()
    };
});
fastify.get('/ready', async (request, reply) => {
    return {
        ready: true,
        timestamp: new Date().toISOString()
    };
});
const sseConnections = new Map();
let sseMessageCounter = 0;
let sseConnectionsTotal = 0;
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
fastify.post('/api/workspace/plan', async (request, reply) => {
    const body = request.body;
    logger.info('Setting workspace plan', { plan: body.plan });
    return {
        success: true,
        plan: body.plan,
        updated_at: new Date().toISOString()
    };
});
fastify.post('/api/runs', async (request, reply) => {
    const body = request.body;
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
fastify.get('/api/runs/:id', async (request, reply) => {
    const { id } = request.params;
    const run = runs.get(id);
    if (!run) {
        return reply.status(404).send({ error: 'Run not found' });
    }
    return run;
});
fastify.post('/api/runs/:id/start', async (request, reply) => {
    const { id } = request.params;
    const run = runs.get(id);
    if (!run) {
        return reply.status(404).send({ error: 'Run not found' });
    }
    run.status = 'running';
    run.started_at = new Date().toISOString();
    run.updated_at = new Date().toISOString();
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
fastify.get('/api/runs/:id/logs/stream', async (request, reply) => {
    const { id } = request.params;
    const run = runs.get(id);
    reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
    });
    if (!sseConnections.has(id)) {
        sseConnections.set(id, new Set());
    }
    sseConnections.get(id).add(reply.raw);
    sseConnectionsTotal++;
    sseMessageCounter++;
    let messageId = 1;
    const lastEventId = request.headers['last-event-id'];
    if (lastEventId && !isNaN(Number(lastEventId))) {
        messageId = Number(lastEventId) + 1;
    }
    const sendEvent = (data) => {
        reply.raw.write(`id: ${messageId++}\n`);
        reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
        sseMessageCounter++;
    };
    sendEvent({
        type: 'connected',
        runId: id,
        timestamp: new Date().toISOString()
    });
    const heartbeatInterval = setInterval(() => {
        reply.raw.write(': keepalive\n\n');
    }, 15000);
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
    request.raw.on('close', () => {
        clearInterval(heartbeatInterval);
        clearInterval(statusInterval);
        const connections = sseConnections.get(id);
        if (connections) {
            connections.delete(reply.raw);
            if (connections.size === 0) {
                sseConnections.delete(id);
            }
        }
    });
});
fastify.get('/api/runs/logs/stream', async (request, reply) => {
    reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
    });
    const genericId = 's2-harness-generic';
    if (!sseConnections.has(genericId)) {
        sseConnections.set(genericId, new Set());
    }
    sseConnections.get(genericId).add(reply.raw);
    sseConnectionsTotal++;
    sseMessageCounter++;
    let messageId = 1;
    const lastEventId = request.headers['last-event-id'];
    if (lastEventId && !isNaN(Number(lastEventId))) {
        messageId = Number(lastEventId) + 1;
    }
    const sendEvent = (data) => {
        reply.raw.write(`id: ${messageId++}\n`);
        reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
        sseMessageCounter++;
    };
    sendEvent({
        type: 'connected',
        timestamp: new Date().toISOString()
    });
    const heartbeatInterval = setInterval(() => {
        reply.raw.write(': keepalive\n\n');
    }, 15000);
    request.raw.on('close', () => {
        clearInterval(heartbeatInterval);
        const connections = sseConnections.get(genericId);
        if (connections) {
            connections.delete(reply.raw);
            if (connections.size === 0) {
                sseConnections.delete(genericId);
            }
        }
    });
});
fastify.post('/api/registry/publish', async (request, reply) => {
    const body = request.body;
    logger.info('Registry publish', { name: body.name, version: body.version });
    reply.status(201);
    return {
        success: true,
        name: body.name,
        version: body.version,
        published_at: new Date().toISOString()
    };
});
fastify.get('/api/safety/check', async (request, reply) => {
    return {
        status: 'safe',
        timestamp: new Date().toISOString()
    };
});
fastify.post('/api/privacy/toggle', async (request, reply) => {
    const body = request.body;
    logger.info('Privacy toggle', { storePlain: body.storePlain });
    return {
        success: true,
        storePlain: body.storePlain,
        updated_at: new Date().toISOString()
    };
});
fastify.post('/api/diagnostics/emit-demo-run', async (request, reply) => {
    const runId = `demo-run-${Date.now()}`;
    logger.info('Demo run created', { runId });
    return {
        success: true,
        runId,
        message: 'Demo run created successfully'
    };
});
fastify.get('/diagnostics/sse-test', async (request, reply) => {
    reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
    });
    const sendEvent = (data) => {
        reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
    };
    const interval = setInterval(() => {
        sendEvent({
            type: 'test',
            timestamp: new Date().toISOString(),
            message: 'SSE test event'
        });
    }, 2000);
    request.raw.on('close', () => {
        clearInterval(interval);
    });
});
const start = async () => {
    try {
        await fastify.listen({
            port: PORT,
            host: HOST
        });
        logger.info(`Gateway server listening on ${HOST}:${PORT}`);
    }
    catch (err) {
        logger.error('Error starting server:', err);
        process.exit(1);
    }
};
start();
//# sourceMappingURL=index.js.map
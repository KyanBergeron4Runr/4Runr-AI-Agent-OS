"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sandboxRoutes = sandboxRoutes;
const zod_1 = require("zod");
const memory_db_1 = require("../models/memory-db");
const http_1 = require("../runtime/http");
const metrics_1 = require("../observability/metrics");
const tools_1 = require("../tools");
const crypto_1 = __importDefault(require("crypto"));
// Simple token generation function
function generateToken(data) {
    const tokenData = {
        agentId: data.agentId,
        scopes: data.scopes,
        expiresAt: new Date(Date.now() + data.ttlSeconds * 1000).toISOString(),
        tokenId: crypto_1.default.randomUUID()
    };
    return Buffer.from(JSON.stringify(tokenData)).toString('base64');
}
// Simple token validation function
function validateToken(token) {
    try {
        const decoded = Buffer.from(token, 'base64').toString('utf8');
        const data = JSON.parse(decoded);
        if (new Date(data.expiresAt) < new Date()) {
            return { valid: false, error: 'Token expired' };
        }
        return { valid: true, data };
    }
    catch (error) {
        return { valid: false, error: 'Invalid token format' };
    }
}
// Validation schemas
const TokenRequestSchema = zod_1.z.object({
    agentId: zod_1.z.string().uuid(),
    scopes: zod_1.z.array(zod_1.z.string()).min(1),
    ttlSeconds: zod_1.z.number().min(30).max(3600).optional().default(120)
});
const IntrospectRequestSchema = zod_1.z.object({
    token: zod_1.z.string().min(1)
});
const RequestComposerSchema = zod_1.z.object({
    agentId: zod_1.z.string().uuid(),
    tool: zod_1.z.string().min(1),
    action: zod_1.z.string().min(1),
    params: zod_1.z.record(zod_1.z.any())
});
// Helper function to scrub sensitive data
function scrubSensitiveData(obj) {
    if (typeof obj !== 'object' || obj === null)
        return obj;
    const scrubbed = { ...obj };
    const sensitiveKeys = ['authorization', 'authorization', 'kek', 'dek', 'api_key', 'secret', 'password', 'token'];
    for (const key of Object.keys(scrubbed)) {
        if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
            scrubbed[key] = '***';
        }
        else if (typeof scrubbed[key] === 'object') {
            scrubbed[key] = scrubSensitiveData(scrubbed[key]);
        }
    }
    return scrubbed;
}
async function sandboxRoutes(server) {
    // Guard: Only enable in demo mode
    server.addHook('preHandler', async (request, reply) => {
        if (process.env.DEMO_MODE !== 'on') {
            return reply.code(403).send({ error: 'Sandbox endpoints only available in demo mode' });
        }
    });
    // Rate limiting for sandbox endpoints
    const rateLimiter = new Map();
    server.addHook('preHandler', async (request, reply) => {
        const ip = request.ip || 'unknown';
        const now = Date.now();
        const windowMs = 60 * 1000; // 1 minute
        if (!rateLimiter.has(ip) || now > rateLimiter.get(ip).resetTime) {
            rateLimiter.set(ip, { count: 1, resetTime: now + windowMs });
        }
        else {
            const record = rateLimiter.get(ip);
            record.count++;
            if (record.count > 10) { // 10 requests per minute
                return reply.code(429).send({ error: 'Rate limit exceeded' });
            }
        }
    });
    // POST /api/sandbox/token - Generate a short-lived token
    server.post('/api/sandbox/token', {
        schema: {
            body: TokenRequestSchema
        }
    }, async (request, reply) => {
        try {
            const { agentId, scopes, ttlSeconds } = request.body;
            // Verify agent exists
            const agent = await memory_db_1.memoryDB.findAgentById(agentId);
            if (!agent) {
                return reply.code(404).send({ error: 'Agent not found' });
            }
            // Generate token
            const token = generateToken({
                agentId: agentId,
                scopes: scopes,
                ttlSeconds: ttlSeconds
            });
            // Store in registry for introspection
            const tokenId = crypto_1.default.randomUUID();
            await memory_db_1.memoryDB.createTokenRegistry({
                tokenId: tokenId,
                agentId: agentId,
                payloadHash: Buffer.from(token).toString('base64'),
                issuedAt: new Date(),
                expiresAt: new Date(Date.now() + ttlSeconds * 1000),
                isRevoked: false
            });
            // Parse token for display
            const tokenData = JSON.parse(Buffer.from(token, 'base64').toString());
            return {
                token: token,
                data: scrubSensitiveData(tokenData),
                expiresAt: tokenData.expiresAt,
                proof: {
                    tokenId: tokenId,
                    agentId: agentId,
                    scopes: scopes,
                    ttlSeconds: ttlSeconds
                }
            };
        }
        catch (error) {
            console.error('Error generating sandbox token:', error);
            return reply.code(500).send({ error: 'Failed to generate token' });
        }
    });
    // POST /api/sandbox/token/introspect - Introspect a token
    server.post('/api/sandbox/token/introspect', {
        schema: {
            body: IntrospectRequestSchema
        }
    }, async (request, reply) => {
        try {
            const { token } = request.body;
            // Validate token
            const validation = validateToken(token);
            if (!validation.valid) {
                return {
                    valid: false,
                    error: validation.error,
                    expiresAt: null,
                    scopes: [],
                    agentId: null,
                    provenance: null,
                    payload: null,
                    header: null,
                    hash: null
                };
            }
            // Parse token for display
            const tokenData = JSON.parse(Buffer.from(token, 'base64').toString());
            // Find in registry
            const registry = await memory_db_1.memoryDB.findTokenRegistryByTokenId(tokenData.tokenId);
            return {
                valid: true,
                expiresAt: tokenData.expiresAt,
                scopes: tokenData.scopes || [],
                agentId: tokenData.agentId,
                provenance: registry ? {
                    tokenId: registry.tokenId,
                    issuedAt: registry.issuedAt,
                    isRevoked: registry.isRevoked
                } : null,
                payload: scrubSensitiveData(tokenData),
                header: null,
                hash: Buffer.from(token).toString('base64').substring(0, 16) + '...'
            };
        }
        catch (error) {
            console.error('Error introspecting token:', error);
            return reply.code(500).send({ error: 'Failed to introspect token' });
        }
    });
    // POST /api/sandbox/request - Compose and execute a request
    server.post('/api/sandbox/request', {
        schema: {
            body: RequestComposerSchema
        }
    }, async (request, reply) => {
        const correlationId = (0, http_1.generateCorrelationId)();
        reply.header('X-Correlation-Id', correlationId);
        try {
            const { agentId, tool, action, params } = request.body;
            // Verify agent exists
            const agent = await memory_db_1.memoryDB.findAgentById(agentId);
            if (!agent) {
                return reply.code(404).send({ error: 'Agent not found' });
            }
            // Generate short-lived token for this request
            const token = generateToken({
                agentId: agentId,
                scopes: [tool],
                ttlSeconds: 60 // 60 seconds
            });
            // Start metrics timer
            const timer = (0, metrics_1.startRequestTimer)(tool, action);
            // Prepare request data
            const requestData = {
                agent_token: token,
                tool,
                action,
                params
            };
            // Capture request details for response
            const requestDetails = {
                method: 'POST',
                path: `/api/proxy-request`,
                headers: {
                    'Content-Type': 'application/json',
                    'X-Correlation-Id': correlationId
                },
                body: scrubSensitiveData(requestData)
            };
            let decision = { allowed: false, reason: 'Unknown', kind: 'unknown' };
            let response = { status: 500, body: { error: 'Request failed' } };
            let metrics = { latency: 0, retries: 0, breaker: 'closed' };
            const startTime = Date.now();
            try {
                // Check if tool/action exists
                if (!tools_1.routes[tool] || !tools_1.routes[tool][action]) {
                    decision = { allowed: false, reason: `Tool ${tool}:${action} not available`, kind: 'tool_not_found' };
                    response = { status: 404, body: { error: `Tool ${tool}:${action} not available` } };
                }
                else {
                    // Execute the request through the proxy logic
                    // Simulate proxy execution
                    const result = await tools_1.routes[tool][action](params);
                    const latency = Date.now() - startTime;
                    // Timer is handled by the metrics system
                    decision = { allowed: true, reason: 'Request allowed', kind: 'allowed' };
                    response = { status: 200, body: result };
                    metrics = { latency, retries: 0, breaker: 'closed' };
                }
            }
            catch (error) {
                const latency = Date.now() - startTime;
                // Timer is handled by the metrics system
                decision = { allowed: false, reason: error.message, kind: 'error' };
                response = { status: 500, body: { error: error.message } };
                metrics = { latency, retries: 0, breaker: 'closed' };
            }
            // Generate cURL command
            const curlCommand = `curl -X POST ${server.server.address()}/api/proxy-request \\
  -H "Content-Type: application/json" \\
  -H "X-Correlation-Id: ${correlationId}" \\
  -d '${JSON.stringify(requestData)}'`;
            return {
                request: requestDetails,
                decision,
                response,
                metrics,
                curl: curlCommand,
                correlationId
            };
        }
        catch (error) {
            console.error('Error in sandbox request:', error);
            return reply.code(500).send({ error: 'Failed to process request' });
        }
    });
    // GET /api/metrics/summary - Get metrics summary
    server.get('/api/metrics/summary', async (request, reply) => {
        try {
            const { window = '15m' } = request.query;
            // For now, return stub data
            // TODO: Implement real metrics aggregation
            return {
                p50: 150,
                p95: 450,
                requestsByCode: {
                    '200': 85,
                    '400': 10,
                    '403': 5
                },
                denialsByKind: {
                    'unauthorized': 3,
                    'tool_not_found': 2
                },
                retries: 12,
                breaker: {
                    serpapi: 'closed',
                    openai: 'closed',
                    http_fetch: 'closed'
                }
            };
        }
        catch (error) {
            console.error('Error getting metrics summary:', error);
            return reply.code(500).send({ error: 'Failed to get metrics summary' });
        }
    });
}
//# sourceMappingURL=sandbox.js.map
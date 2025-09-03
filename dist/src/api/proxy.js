"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.proxyRoutes = proxyRoutes;
const _4runr_cipher_1 = require("../services/4runr-cipher");
const memory_db_1 = require("../models/memory-db");
const token_utils_1 = require("../utils/token-utils");
const crypto_1 = __importDefault(require("crypto"));
const rate_limiter_flexible_1 = require("rate-limiter-flexible");
const policyEngine_1 = require("../services/policyEngine");
const validators_1 = require("../policies/validators");
// Import resilience features
const http_1 = require("../runtime/http");
const circuit_1 = require("../runtime/circuit");
const retry_1 = require("../runtime/retry");
const metrics_1 = require("../observability/metrics");
const lifecycle_1 = require("../runtime/lifecycle");
// Import tool adapters
const serpapi_1 = require("../tools/serpapi");
const http_fetch_1 = require("../tools/http-fetch");
const openai_1 = require("../tools/openai");
const gmail_send_1 = require("../tools/gmail-send");
// Rate limiter configuration
const rateLimiter = new rate_limiter_flexible_1.RateLimiterMemory({
    points: 5, // 5 requests
    duration: 60, // per 60 seconds
});
// Tool router - maps tool/action to adapter methods
const toolRoutes = {
    serpapi: { search: serpapi_1.serpApiTool.search.bind(serpapi_1.serpApiTool) },
    http_fetch: {
        get: http_fetch_1.httpFetchTool.get.bind(http_fetch_1.httpFetchTool),
        head: http_fetch_1.httpFetchTool.head.bind(http_fetch_1.httpFetchTool)
    },
    openai: {
        chat: openai_1.openaiTool.chat.bind(openai_1.openaiTool),
        complete: openai_1.openaiTool.complete.bind(openai_1.openaiTool)
    },
    gmail_send: {
        send: gmail_send_1.gmailSendTool.send.bind(gmail_send_1.gmailSendTool),
        profile: gmail_send_1.gmailSendTool.getProfile.bind(gmail_send_1.gmailSendTool)
    }
};
async function proxyRoutes(server) {
    // POST /proxy-request - Proxy agent requests to external APIs
    server.post('/proxy-request', async (request, reply) => {
        // Check if shutdown is in progress
        if ((0, lifecycle_1.isShutdownInProgress)()) {
            return reply.code(503).send({ error: 'Service is shutting down' });
        }
        // Generate correlation ID for request tracking
        const correlationId = (0, http_1.generateCorrelationId)();
        reply.header('X-Correlation-Id', correlationId);
        try {
            const { agent_token, token_id, proof_payload, tool, action, params } = request.body;
            // Validate required fields
            if (!agent_token || !tool || !action || !params) {
                return reply.code(400).send({
                    error: 'Missing required fields: agent_token, tool, action, and params are required.'
                });
            }
            // Validate token provenance if token_id is provided
            if (token_id) {
                if (!proof_payload) {
                    return reply.code(400).send({
                        error: 'Token provenance validation requires proof_payload when token_id is provided.'
                    });
                }
                // Verify token provenance
                const registry = await memory_db_1.memoryDB.findTokenRegistryByTokenId(token_id);
                if (!registry) {
                    console.warn(`Token registry not found for token_id: ${token_id}`);
                    return reply.code(403).send({ error: 'Token not found in registry' });
                }
                if (registry.isRevoked) {
                    console.warn(`Revoked token used: ${token_id}`);
                    return reply.code(403).send({ error: 'Token has been revoked' });
                }
                // Verify proof payload hash
                const proofHash = crypto_1.default.createHash('sha256').update(proof_payload).digest('hex');
                if (proofHash !== registry.payloadHash) {
                    console.warn(`Token proof mismatch for token_id: ${token_id}`);
                    return reply.code(403).send({ error: 'Token proof verification failed' });
                }
            }
            // Step 1: Verify HMAC signature
            const [encryptedPayload, signature] = agent_token.split('.');
            if (!encryptedPayload || !signature) {
                return reply.code(400).send({ error: 'Invalid token format. Expected: BASE64(encrypted).SIGNATURE' });
            }
            const signingSecret = process.env.SIGNING_SECRET || 'default-secret-change-in-production';
            const validSignature = crypto_1.default
                .createHmac('sha256', signingSecret)
                .update(encryptedPayload)
                .digest('hex');
            if (signature !== validSignature) {
                console.warn('Invalid token signature received');
                return reply.code(403).send({ error: 'Invalid token signature' });
            }
            // Step 2: Decrypt token payload
            let tokenData;
            try {
                // For now, use a centralized private key (in production, each agent would have their own)
                const gatewayPrivateKey = process.env.GATEWAY_PRIVATE_KEY;
                if (!gatewayPrivateKey) {
                    return reply.code(500).send({ error: 'Gateway private key not configured' });
                }
                const tokenDataRaw = (0, _4runr_cipher_1.decryptByAgent)(gatewayPrivateKey, encryptedPayload);
                tokenData = JSON.parse(tokenDataRaw);
                (0, metrics_1.recordTokenValidation)(tokenData.agent_id, true);
            }
            catch (error) {
                console.error('Token decryption failed:', error);
                (0, metrics_1.recordTokenValidation)('unknown', false);
                return reply.code(403).send({ error: 'Token decryption failed' });
            }
            // Step 3: Validate token data
            const now = new Date();
            const tokenExpiry = new Date(tokenData.expires_at);
            if ((0, token_utils_1.isTokenExpired)(tokenData.expires_at)) {
                console.warn(`Token expired for agent ${tokenData.agent_id}`);
                (0, metrics_1.recordTokenExpiration)(tokenData.agent_id);
                // Log the expired token attempt
                try {
                    await memory_db_1.memoryDB.createRequestLog({
                        corrId: correlationId,
                        agentId: tokenData.agent_id,
                        tool,
                        action,
                        responseTime: 0,
                        statusCode: 403,
                        success: false,
                        errorMessage: 'Token expired'
                    });
                }
                catch (logError) {
                    console.error('Failed to log expired token:', logError);
                }
                return reply.code(403).send({ error: 'Token expired' });
            }
            // Step 3.5: Check for token rotation recommendation
            if ((0, token_utils_1.isTokenExpiringSoon)(tokenData.expires_at)) {
                reply.header('X-Token-Rotation-Recommended', 'true');
                reply.header('X-Token-Expires-At', tokenData.expires_at);
            }
            // Step 4: Validate agent exists and is active
            const agent = await memory_db_1.memoryDB.findAgentById(tokenData.agent_id);
            if (!agent) {
                console.warn(`Agent not found: ${tokenData.agent_id}`);
                return reply.code(403).send({ error: 'Agent not found' });
            }
            if (agent.status !== 'active') {
                console.warn(`Inactive agent attempted request: ${tokenData.agent_id}`);
                return reply.code(403).send({ error: 'Agent is not active' });
            }
            // Step 5: Policy evaluation
            const policyEngine = policyEngine_1.PolicyEngine.getInstance();
            const policyResult = await policyEngine.evaluateRequest(tokenData.agent_id, agent.role, tool, action, params);
            if (!policyResult.allowed) {
                console.warn(`Policy denied request for agent ${tokenData.agent_id}: ${policyResult.reason}`);
                (0, metrics_1.recordPolicyDenial)(tokenData.agent_id, tool, action);
                // Log the policy denial
                try {
                    await memory_db_1.memoryDB.createRequestLog({
                        corrId: correlationId,
                        agentId: tokenData.agent_id,
                        tool,
                        action,
                        responseTime: 0,
                        statusCode: 403,
                        success: false,
                        errorMessage: `Policy denied: ${policyResult.reason}`
                    });
                }
                catch (logError) {
                    console.error('Failed to log policy denial:', logError);
                }
                return reply.code(403).send({
                    error: 'Policy denied',
                    reason: policyResult.reason
                });
            }
            // Step 5.5: Validate tool parameters
            const validationResult = (0, validators_1.validateToolParameters)(tool, action, params);
            if (!validationResult.valid) {
                console.warn(`Parameter validation failed for agent ${tokenData.agent_id}: ${validationResult.errors?.join(', ')}`);
                return reply.code(400).send({
                    error: 'Parameter validation failed',
                    details: validationResult.errors
                });
            }
            // Step 5.6: Check tool configuration
            let toolInstance;
            switch (tool) {
                case 'serpapi':
                    toolInstance = serpapi_1.serpApiTool;
                    break;
                case 'openai':
                    toolInstance = openai_1.openaiTool;
                    break;
                case 'gmail_send':
                    toolInstance = gmail_send_1.gmailSendTool;
                    break;
                case 'http_fetch':
                    // HTTP fetch doesn't need credentials
                    break;
                default:
                    return reply.code(400).send({ error: 'Unknown tool' });
            }
            if (toolInstance && !(await toolInstance.isConfigured())) {
                return reply.code(503).send({ error: `${tool} not configured - no active credential found` });
            }
            // Step 5.5: Rate limiting
            try {
                await rateLimiter.consume(tokenData.agent_id);
            }
            catch (rateLimitError) {
                console.warn(`Rate limit exceeded for agent ${tokenData.agent_id}`);
                // Log the rate limit violation
                try {
                    await memory_db_1.memoryDB.createRequestLog({
                        corrId: correlationId,
                        agentId: tokenData.agent_id,
                        tool,
                        action,
                        responseTime: 0,
                        statusCode: 429,
                        success: false,
                        errorMessage: 'Rate limit exceeded'
                    });
                }
                catch (logError) {
                    console.error('Failed to log rate limit:', logError);
                }
                return reply.code(429).send({
                    error: 'Rate limit exceeded',
                    retry_after: Math.ceil(rateLimitError.msBeforeNext / 1000)
                });
            }
            // Step 6: Proxy request to external API using tool adapters with resilience
            let result;
            let responseTime = 0;
            const startTime = Date.now();
            try {
                // Check if tool and action are supported
                if (!toolRoutes[tool]) {
                    return reply.code(400).send({ error: `Unsupported tool: ${tool}` });
                }
                if (!toolRoutes[tool][action]) {
                    return reply.code(400).send({ error: `Unsupported action: ${action} for tool: ${tool}` });
                }
                // Execute the tool action with circuit breaker, retries, and metrics
                result = await (0, circuit_1.executeWithCircuitBreaker)(tool, async () => {
                    return (0, retry_1.executeWithRetry)(tool, action, async () => {
                        const toolResult = await toolRoutes[tool][action](params);
                        // Apply response filters if policy specifies them
                        if (policyResult.appliedFilters) {
                            return policyResult.appliedFilters;
                        }
                        return toolResult;
                    });
                });
                responseTime = Date.now() - startTime;
                // Record successful request metrics
                (0, metrics_1.recordRequest)(tool, action, 200, responseTime);
            }
            catch (error) {
                responseTime = Date.now() - startTime;
                const errorMessage = error.response?.data?.error || error.message;
                console.error(`External API error for ${tool}/${action}:`, errorMessage);
                // Record failed request metrics
                const statusCode = error.response?.status || 502;
                (0, metrics_1.recordRequest)(tool, action, statusCode, responseTime);
                // Log the failed request
                try {
                    await memory_db_1.memoryDB.createRequestLog({
                        corrId: correlationId,
                        agentId: tokenData.agent_id,
                        tool,
                        action,
                        responseTime,
                        statusCode,
                        success: false,
                        errorMessage: errorMessage
                    });
                }
                catch (logError) {
                    console.error('Failed to log error request:', logError);
                }
                return reply.code(statusCode).send({
                    error: 'External API request failed',
                    details: error.response?.data || error.message
                });
            }
            // Step 7: Log the successful request
            try {
                const sanitizedParams = (0, validators_1.sanitizeParameters)(tool, action, params);
                await memory_db_1.memoryDB.createRequestLog({
                    corrId: correlationId,
                    agentId: tokenData.agent_id,
                    tool,
                    action,
                    responseTime,
                    statusCode: 200,
                    success: true,
                    errorMessage: undefined
                });
            }
            catch (logError) {
                console.error('Failed to log request:', logError);
                // Don't fail the request if logging fails
            }
            // Step 8: Return the result
            return reply.code(200).send({
                success: true,
                data: result,
                metadata: {
                    agent_id: tokenData.agent_id,
                    agent_name: agent.name,
                    tool,
                    action,
                    response_time_ms: responseTime
                }
            });
        }
        catch (error) {
            console.error('Proxy request error:', error);
            return reply.code(500).send({
                error: 'Internal server error during proxy request'
            });
        }
    });
    // GET /proxy/status - Get proxy system status
    server.get('/proxy/status', async (request, reply) => {
        try {
            // Check tool configurations
            const configured_tools = {
                serpapi: await serpapi_1.serpApiTool.isConfigured(),
                openai: await openai_1.openaiTool.isConfigured(),
                http_fetch: true, // Always available (no external API key needed)
                gmail_send: await gmail_send_1.gmailSendTool.isConfigured()
            };
            const status = {
                status: 'operational',
                timestamp: new Date().toISOString(),
                configured_tools,
                available_actions: {
                    serpapi: ['search'],
                    http_fetch: ['get', 'head'],
                    openai: ['chat', 'complete'],
                    gmail_send: ['send', 'profile']
                },
                signing_secret: !!process.env.SIGNING_SECRET,
                gateway_key: !!process.env.GATEWAY_PRIVATE_KEY,
                kek_configured: !!process.env.KEK_BASE64
            };
            return reply.send(status);
        }
        catch (error) {
            console.error('Status check error:', error);
            return reply.code(500).send({ error: 'Status check failed' });
        }
    });
    // GET /proxy/logs - Get recent request logs
    server.get('/proxy/logs', async (request, reply) => {
        try {
            const { limit = '20' } = request.query;
            const logs = await memory_db_1.memoryDB.getAllRequestLogs(parseInt(limit));
            return reply.send({
                logs,
                total: logs.length,
                timestamp: new Date().toISOString()
            });
        }
        catch (error) {
            console.error('Logs retrieval error:', error);
            return reply.code(500).send({ error: 'Failed to retrieve logs' });
        }
    });
}
//# sourceMappingURL=proxy.js.map
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.tokenRoutes = tokenRoutes;
const memory_db_1 = require("../models/memory-db");
const _4runr_cipher_1 = require("../services/4runr-cipher");
const crypto_1 = __importDefault(require("crypto"));
const metrics_1 = require("../observability/metrics");
async function tokenRoutes(server) {
    // POST /generate-token - Generate encrypted, signed token for agent
    server.post('/generate-token', async (request, reply) => {
        try {
            const { agent_id, tools, permissions, expires_at } = request.body;
            // Validate required fields
            if (!agent_id || !tools || !permissions || !expires_at) {
                return reply.code(400).send({
                    error: 'Missing required fields: agent_id, tools, permissions, and expires_at are required.'
                });
            }
            // Validate tools and permissions are arrays
            if (!Array.isArray(tools) || !Array.isArray(permissions)) {
                return reply.code(400).send({
                    error: 'Tools and permissions must be arrays.'
                });
            }
            // Validate expiry date
            const expiryDate = new Date(expires_at);
            if (isNaN(expiryDate.getTime())) {
                return reply.code(400).send({
                    error: 'Invalid expires_at date format. Use ISO 8601 format.'
                });
            }
            // Check if token would be expired
            if (expiryDate <= new Date()) {
                return reply.code(400).send({
                    error: 'Token expiry date must be in the future.'
                });
            }
            // Find agent and get their public key
            const agent = await memory_db_1.memoryDB.findAgentById(agent_id);
            if (!agent) {
                return reply.code(404).send({ error: 'Agent not found.' });
            }
            if (agent.status !== 'active') {
                return reply.code(400).send({ error: 'Agent is not active.' });
            }
            // Create token payload with security features
            const payload = JSON.stringify({
                agent_id,
                agent_name: agent.name,
                tools,
                permissions,
                expires_at,
                nonce: crypto_1.default.randomUUID(), // Prevent replay attacks
                issued_at: new Date().toISOString()
            });
            // Generate token ID and compute payload hash for provenance
            const tokenId = crypto_1.default.randomUUID();
            const payloadHash = crypto_1.default.createHash('sha256').update(payload).digest('hex');
            // Get gateway's public key and encrypt payload with it
            const gatewayPrivateKey = process.env.GATEWAY_PRIVATE_KEY;
            if (!gatewayPrivateKey) {
                return reply.code(500).send({ error: 'Gateway private key not configured' });
            }
            const gatewayPublicKey = (0, _4runr_cipher_1.getGatewayPublicKey)(gatewayPrivateKey);
            const encryptedToken = (0, _4runr_cipher_1.encryptForGateway)(gatewayPublicKey, payload);
            // Create HMAC signature for tamper protection
            const signingSecret = process.env.SIGNING_SECRET || 'default-secret-change-in-production';
            const signature = crypto_1.default
                .createHmac('sha256', signingSecret)
                .update(encryptedToken)
                .digest('hex');
            // Combine encrypted token with signature
            const finalToken = `${encryptedToken}.${signature}`;
            // Store token in memory database for tracking
            await memory_db_1.memoryDB.createToken({
                agentId: agent_id,
                encrypted: finalToken,
                expiresAt: expiryDate,
                revoked: false
            });
            // Record token generation metric
            (0, metrics_1.recordTokenGeneration)(agent_id);
            // Store token provenance in registry
            await memory_db_1.memoryDB.createTokenRegistry({
                tokenId,
                agentId: agent_id,
                payloadHash,
                issuedAt: new Date(),
                expiresAt: expiryDate,
                isRevoked: false
            });
            return reply.code(201).send({
                agent_token: finalToken,
                token_id: tokenId,
                expires_at: expires_at,
                agent_name: agent.name
            });
        }
        catch (error) {
            console.error('Error generating token:', error);
            return reply.code(500).send({
                error: 'Internal server error while generating token.'
            });
        }
    });
    // GET /tokens/:agent_id - List tokens for an agent (admin only)
    server.get('/tokens/:agent_id', async (request, reply) => {
        try {
            const { agent_id } = request.params;
            const tokens = await memory_db_1.memoryDB.findTokensByAgentId(agent_id);
            return reply.send({ tokens });
        }
        catch (error) {
            console.error('Error fetching tokens:', error);
            return reply.code(500).send({
                error: 'Internal server error while fetching tokens.'
            });
        }
    });
    // POST /tokens/:token_id/revoke - Revoke a token
    server.post('/tokens/:token_id/revoke', async (request, reply) => {
        try {
            const { token_id } = request.params;
            const token = await memory_db_1.memoryDB.updateToken(token_id, { revoked: true });
            if (!token) {
                return reply.code(404).send({ error: 'Token not found.' });
            }
            return reply.send({
                message: 'Token revoked successfully.',
                token_id: token.id
            });
        }
        catch (error) {
            console.error('Error revoking token:', error);
            return reply.code(500).send({
                error: 'Internal server error while revoking token.'
            });
        }
    });
}
//# sourceMappingURL=tokens.js.map
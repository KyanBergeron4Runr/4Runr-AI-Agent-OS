"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.agentRoutes = agentRoutes;
const _4runr_cipher_1 = require("../services/4runr-cipher");
const memory_db_1 = require("../models/memory-db");
const metrics_1 = require("../observability/metrics");
async function agentRoutes(server) {
    // POST /create-agent - Create a new agent with keypair
    server.post('/create-agent', async (request, reply) => {
        try {
            const { name, created_by, role } = request.body;
            // Validate required fields
            if (!name || !created_by || !role) {
                return reply.code(400).send({
                    error: 'Missing required fields: name, created_by, and role are required.'
                });
            }
            // Generate asymmetric keypair for the agent
            const { publicKey, privateKey } = (0, _4runr_cipher_1.generateAgentKeyPair)();
            // Store agent data in memory database (public key only)
            const agent = await memory_db_1.memoryDB.createAgent({
                name,
                createdBy: created_by,
                role,
                publicKey,
                status: 'active'
            });
            // Record agent creation metric
            (0, metrics_1.recordAgentCreation)(agent.id);
            // Return agent ID and private key (only once - never stored)
            return reply.code(201).send({
                agent_id: agent.id,
                private_key: privateKey // Return ONCE — never store it
            });
        }
        catch (error) {
            console.error('Error creating agent:', error);
            return reply.code(500).send({
                error: 'Internal server error while creating agent.'
            });
        }
    });
    // GET /agents - List all agents (for admin purposes)
    server.get('/agents', async (request, reply) => {
        try {
            const agents = await memory_db_1.memoryDB.getAllAgents();
            return reply.send({ agents });
        }
        catch (error) {
            console.error('Error fetching agents:', error);
            return reply.code(500).send({
                error: 'Internal server error while fetching agents.'
            });
        }
    });
    // GET /agents/:id - Get specific agent details
    server.get('/agents/:id', async (request, reply) => {
        try {
            const { id } = request.params;
            const agent = await memory_db_1.memoryDB.findAgentById(id);
            if (!agent) {
                return reply.code(404).send({ error: 'Agent not found.' });
            }
            return reply.send({ agent });
        }
        catch (error) {
            console.error('Error fetching agent:', error);
            return reply.code(500).send({
                error: 'Internal server error while fetching agent.'
            });
        }
    });
}
//# sourceMappingURL=agents.js.map
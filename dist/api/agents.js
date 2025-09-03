"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.agentRoutes = agentRoutes;
const _4runr_cipher_1 = require("../services/4runr-cipher");
const memory_db_1 = require("../models/memory-db");
const metrics_1 = require("../observability/metrics");
async function agentRoutes(server) {
    server.post('/create-agent', async (request, reply) => {
        try {
            const { name, created_by, role } = request.body;
            console.log('Incoming request to create agent:', { name, created_by, role });
            if (!name || !created_by || !role) {
                console.error('Missing required fields for agent creation:', { name, created_by, role });
                return reply.code(400).send({
                    error: 'Missing required fields: name, created_by, and role are required.'
                });
            }
            const { publicKey, privateKey } = (0, _4runr_cipher_1.generateAgentKeyPair)();
            const agent = await memory_db_1.memoryDB.createAgent({
                name,
                createdBy: created_by,
                role,
                publicKey,
                status: 'active'
            });
            (0, metrics_1.recordAgentCreation)(agent.id);
            console.log('Agent created successfully:', { agent_id: agent.id });
            return reply.code(201).send({
                agent_id: agent.id,
                private_key: privateKey
            });
        }
        catch (error) {
            console.error('Error creating agent:', error);
            return reply.code(500).send({
                error: 'Internal server error while creating agent.'
            });
        }
    });
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
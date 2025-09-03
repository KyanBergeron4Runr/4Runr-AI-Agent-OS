"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.policyRoutes = policyRoutes;
const memory_db_1 = require("../models/memory-db");
const policyEngine_1 = require("../services/policyEngine");
const policy_1 = require("../types/policy");
const zod_1 = require("zod");
// Request schemas
const CreatePolicySchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    description: zod_1.z.string().optional(),
    agentId: zod_1.z.string().optional(),
    role: zod_1.z.string().optional(),
    spec: policy_1.PolicySpecSchema
});
const UpdatePolicySchema = zod_1.z.object({
    name: zod_1.z.string().min(1).optional(),
    description: zod_1.z.string().optional(),
    spec: policy_1.PolicySpecSchema.optional(),
    active: zod_1.z.boolean().optional()
});
const GetPoliciesQuerySchema = zod_1.z.object({
    agentId: zod_1.z.string().optional(),
    role: zod_1.z.string().optional(),
    active: zod_1.z.boolean().optional()
});
async function policyRoutes(fastify) {
    // Create a new policy
    fastify.post('/policies', {
        schema: {
            body: {
                type: 'object',
                required: ['name', 'spec'],
                properties: {
                    name: { type: 'string', minLength: 1 },
                    description: { type: 'string' },
                    agentId: { type: 'string' },
                    role: { type: 'string' },
                    spec: { type: 'object' }
                }
            }
        }
    }, async (request, reply) => {
        try {
            const body = CreatePolicySchema.parse(request.body);
            // Validate that either agentId or role is provided, but not both
            if (!body.agentId && !body.role) {
                return reply.code(400).send({ error: 'Either agentId or role must be provided' });
            }
            if (body.agentId && body.role) {
                return reply.code(400).send({ error: 'Cannot specify both agentId and role' });
            }
            // If agentId is provided, verify the agent exists
            if (body.agentId) {
                const agent = await memory_db_1.memoryDB.findAgentById(body.agentId);
                if (!agent) {
                    return reply.code(404).send({ error: 'Agent not found' });
                }
            }
            const policyEngine = policyEngine_1.PolicyEngine.getInstance();
            const specHash = policyEngine.computeSpecHash(body.spec);
            const policy = await memory_db_1.memoryDB.createPolicy({
                name: body.name,
                description: body.description,
                agentId: body.agentId,
                role: body.role,
                spec: JSON.stringify(body.spec),
                specHash,
                active: true
            });
            return reply.code(201).send(policy);
        }
        catch (error) {
            if (error instanceof zod_1.z.ZodError) {
                return reply.code(400).send({ error: 'Validation error', details: error.errors });
            }
            return reply.code(500).send({ error: 'Internal server error' });
        }
    });
    // Get all policies with optional filtering
    fastify.get('/policies', {
        schema: {
            querystring: {
                type: 'object',
                properties: {
                    agentId: { type: 'string' },
                    role: { type: 'string' },
                    active: { type: 'boolean' }
                }
            }
        }
    }, async (request, reply) => {
        try {
            const query = GetPoliciesQuerySchema.parse(request.query);
            let policies = await memory_db_1.memoryDB.getAllPolicies();
            // Apply filters
            if (query.agentId) {
                policies = policies.filter(p => p.agentId === query.agentId);
            }
            if (query.role) {
                policies = policies.filter(p => p.role === query.role);
            }
            if (query.active !== undefined) {
                policies = policies.filter(p => p.active === query.active);
            }
            // Parse spec JSON for each policy
            const policiesWithParsedSpec = policies.map(policy => ({
                ...policy,
                spec: JSON.parse(policy.spec)
            }));
            return reply.send(policiesWithParsedSpec);
        }
        catch (error) {
            if (error instanceof zod_1.z.ZodError) {
                return reply.code(400).send({ error: 'Validation error', details: error.errors });
            }
            return reply.code(500).send({ error: 'Internal server error' });
        }
    });
    // Get a specific policy by ID
    fastify.get('/policies/:id', {
        schema: {
            params: {
                type: 'object',
                required: ['id'],
                properties: {
                    id: { type: 'string' }
                }
            }
        }
    }, async (request, reply) => {
        try {
            const { id } = request.params;
            const policy = await memory_db_1.memoryDB.findPolicyById(id);
            if (!policy) {
                return reply.code(404).send({ error: 'Policy not found' });
            }
            return reply.send({
                ...policy,
                spec: JSON.parse(policy.spec)
            });
        }
        catch (error) {
            return reply.code(500).send({ error: 'Internal server error' });
        }
    });
    // Update a policy
    fastify.patch('/policies/:id', {
        schema: {
            params: {
                type: 'object',
                required: ['id'],
                properties: {
                    id: { type: 'string' }
                }
            },
            body: {
                type: 'object',
                properties: {
                    name: { type: 'string', minLength: 1 },
                    description: { type: 'string' },
                    spec: { type: 'object' },
                    active: { type: 'boolean' }
                }
            }
        }
    }, async (request, reply) => {
        try {
            const { id } = request.params;
            const body = UpdatePolicySchema.parse(request.body);
            const existingPolicy = await memory_db_1.memoryDB.findPolicyById(id);
            if (!existingPolicy) {
                return reply.code(404).send({ error: 'Policy not found' });
            }
            const updateData = {};
            if (body.name !== undefined)
                updateData.name = body.name;
            if (body.description !== undefined)
                updateData.description = body.description;
            if (body.active !== undefined)
                updateData.active = body.active;
            if (body.spec) {
                const policyEngine = policyEngine_1.PolicyEngine.getInstance();
                const specHash = policyEngine.computeSpecHash(body.spec);
                updateData.spec = JSON.stringify(body.spec);
                updateData.specHash = specHash;
            }
            const updatedPolicy = await memory_db_1.memoryDB.updatePolicy(id, updateData);
            if (!updatedPolicy) {
                return reply.code(500).send({ error: 'Failed to update policy' });
            }
            return reply.send({
                ...updatedPolicy,
                spec: JSON.parse(updatedPolicy.spec)
            });
        }
        catch (error) {
            if (error instanceof zod_1.z.ZodError) {
                return reply.code(400).send({ error: 'Validation error', details: error.errors });
            }
            return reply.code(500).send({ error: 'Internal server error' });
        }
    });
    // Delete a policy
    fastify.delete('/policies/:id', {
        schema: {
            params: {
                type: 'object',
                required: ['id'],
                properties: {
                    id: { type: 'string' }
                }
            }
        }
    }, async (request, reply) => {
        try {
            const { id } = request.params;
            const existingPolicy = await memory_db_1.memoryDB.findPolicyById(id);
            if (!existingPolicy) {
                return reply.code(404).send({ error: 'Policy not found' });
            }
            const deleted = await memory_db_1.memoryDB.deletePolicy(id);
            if (!deleted) {
                return reply.code(500).send({ error: 'Failed to delete policy' });
            }
            return reply.code(204).send();
        }
        catch (error) {
            return reply.code(500).send({ error: 'Internal server error' });
        }
    });
    // Get policy logs
    fastify.get('/policy-logs', {
        schema: {
            querystring: {
                type: 'object',
                properties: {
                    policyId: { type: 'string' },
                    agentId: { type: 'string' },
                    limit: { type: 'number', minimum: 1, maximum: 100 }
                }
            }
        }
    }, async (request, reply) => {
        try {
            const { policyId, agentId, limit = 50 } = request.query;
            let logs;
            if (policyId) {
                logs = await memory_db_1.memoryDB.getPolicyLogsByPolicyId(policyId, limit);
            }
            else if (agentId) {
                logs = await memory_db_1.memoryDB.getPolicyLogsByAgentId(agentId, limit);
            }
            else {
                logs = await memory_db_1.memoryDB.getAllPolicyLogs(limit);
            }
            return reply.send(logs);
        }
        catch (error) {
            return reply.code(500).send({ error: 'Internal server error' });
        }
    });
    // Get merged policies for an agent (for debugging)
    fastify.get('/policies/merged/:agentId', {
        schema: {
            params: {
                type: 'object',
                required: ['agentId'],
                properties: {
                    agentId: { type: 'string' }
                }
            }
        }
    }, async (request, reply) => {
        try {
            const { agentId } = request.params;
            const agent = await memory_db_1.memoryDB.findAgentById(agentId);
            if (!agent) {
                return reply.code(404).send({ error: 'Agent not found' });
            }
            const policyEngine = policyEngine_1.PolicyEngine.getInstance();
            const mergedResult = await policyEngine.loadMergedPolicies(agentId, agent.role);
            return reply.send({
                agentId,
                agentRole: agent.role,
                mergedSpec: mergedResult.mergedSpec,
                sourcePolicies: mergedResult.sourcePolicies
            });
        }
        catch (error) {
            return reply.code(500).send({ error: 'Internal server error' });
        }
    });
}
//# sourceMappingURL=policies.js.map
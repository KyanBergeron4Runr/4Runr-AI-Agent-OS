"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.memoryDB = void 0;
class MemoryDB {
    constructor() {
        this.agents = new Map();
        this.tokens = new Map();
        this.requestLogs = new Map();
        this.policies = new Map();
        this.policyLogs = new Map();
        this.quotaCounters = new Map();
        this.toolCredentials = new Map();
        this.tokenRegistry = new Map();
    }
    // Agent methods
    async createAgent(data) {
        const id = crypto.randomUUID();
        const agent = {
            ...data,
            id,
            createdAt: new Date()
        };
        this.agents.set(id, agent);
        return agent;
    }
    async findAgentById(id) {
        return this.agents.get(id) || null;
    }
    async findAgentByName(name) {
        for (const agent of this.agents.values()) {
            if (agent.name === name)
                return agent;
        }
        return null;
    }
    async getAllAgents() {
        return Array.from(this.agents.values());
    }
    // Token methods
    async createToken(data) {
        const id = crypto.randomUUID();
        const token = {
            ...data,
            id,
            createdAt: new Date()
        };
        this.tokens.set(id, token);
        return token;
    }
    async findTokensByAgentId(agentId) {
        return Array.from(this.tokens.values()).filter(t => t.agentId === agentId && !t.revoked);
    }
    async updateToken(id, data) {
        const token = this.tokens.get(id);
        if (!token)
            return null;
        const updatedToken = { ...token, ...data };
        this.tokens.set(id, updatedToken);
        return updatedToken;
    }
    // RequestLog methods
    async createRequestLog(data) {
        const id = crypto.randomUUID();
        const log = {
            ...data,
            id,
            createdAt: new Date()
        };
        this.requestLogs.set(id, log);
        return log;
    }
    async getRequestLogsByAgentId(agentId) {
        return Array.from(this.requestLogs.values()).filter(l => l.agentId === agentId);
    }
    async getAllRequestLogs(limit) {
        const logs = Array.from(this.requestLogs.values());
        logs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        return limit ? logs.slice(0, limit) : logs;
    }
    async getRequestLogsByDateRange(startDate, endDate) {
        return Array.from(this.requestLogs.values()).filter(log => log.createdAt >= startDate && log.createdAt <= endDate);
    }
    // Policy methods
    async createPolicy(data) {
        const id = crypto.randomUUID();
        const now = new Date();
        const policy = {
            ...data,
            id,
            createdAt: now,
            updatedAt: now
        };
        this.policies.set(id, policy);
        return policy;
    }
    async findPolicyById(id) {
        return this.policies.get(id) || null;
    }
    async findPoliciesByAgentId(agentId) {
        return Array.from(this.policies.values()).filter(p => p.agentId === agentId && p.active);
    }
    async findPoliciesByRole(role) {
        return Array.from(this.policies.values()).filter(p => p.role === role && p.active);
    }
    async getAllPolicies() {
        return Array.from(this.policies.values());
    }
    async updatePolicy(id, data) {
        const policy = this.policies.get(id);
        if (!policy)
            return null;
        const updatedPolicy = { ...policy, ...data, updatedAt: new Date() };
        this.policies.set(id, updatedPolicy);
        return updatedPolicy;
    }
    async deletePolicy(id) {
        return this.policies.delete(id);
    }
    // PolicyLog methods
    async createPolicyLog(data) {
        const id = crypto.randomUUID();
        const log = {
            ...data,
            id,
            createdAt: new Date()
        };
        this.policyLogs.set(id, log);
        return log;
    }
    async getPolicyLogsByPolicyId(policyId, limit) {
        const logs = Array.from(this.policyLogs.values()).filter(l => l.policyId === policyId);
        logs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        return limit ? logs.slice(0, limit) : logs;
    }
    async getPolicyLogsByAgentId(agentId, limit) {
        const logs = Array.from(this.policyLogs.values()).filter(l => l.agentId === agentId);
        logs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        return limit ? logs.slice(0, limit) : logs;
    }
    async getAllPolicyLogs(limit) {
        const logs = Array.from(this.policyLogs.values());
        logs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        return limit ? logs.slice(0, limit) : logs;
    }
    // QuotaCounter methods
    async createQuotaCounter(data) {
        const id = crypto.randomUUID();
        const now = new Date();
        const counter = {
            ...data,
            id,
            createdAt: now,
            updatedAt: now
        };
        this.quotaCounters.set(id, counter);
        return counter;
    }
    async findQuotaCounter(policyId, quotaKey) {
        for (const counter of this.quotaCounters.values()) {
            if (counter.policyId === policyId && counter.quotaKey === quotaKey) {
                return counter;
            }
        }
        return null;
    }
    async updateQuotaCounter(id, data) {
        const counter = this.quotaCounters.get(id);
        if (!counter)
            return null;
        const updatedCounter = { ...counter, ...data, updatedAt: new Date() };
        this.quotaCounters.set(id, updatedCounter);
        return updatedCounter;
    }
    async resetExpiredQuotaCounters() {
        const now = new Date();
        for (const counter of this.quotaCounters.values()) {
            if (counter.resetAt <= now) {
                counter.current = 0;
                counter.resetAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // Reset to tomorrow
                counter.updatedAt = now;
            }
        }
    }
    // ToolCredential methods
    async createToolCredential(data) {
        const id = crypto.randomUUID();
        const now = new Date();
        const credential = {
            ...data,
            id,
            createdAt: now,
            updatedAt: now
        };
        this.toolCredentials.set(id, credential);
        return credential;
    }
    async findToolCredentialById(id) {
        return this.toolCredentials.get(id) || null;
    }
    async findActiveToolCredential(tool) {
        for (const credential of this.toolCredentials.values()) {
            if (credential.tool === tool && credential.isActive) {
                return credential;
            }
        }
        return null;
    }
    async findToolCredentialsByTool(tool) {
        return Array.from(this.toolCredentials.values()).filter(c => c.tool === tool);
    }
    async getAllToolCredentials() {
        return Array.from(this.toolCredentials.values());
    }
    async updateToolCredential(id, data) {
        const credential = this.toolCredentials.get(id);
        if (!credential)
            return null;
        const updatedCredential = { ...credential, ...data, updatedAt: new Date() };
        this.toolCredentials.set(id, updatedCredential);
        return updatedCredential;
    }
    async activateToolCredential(id) {
        const credential = this.toolCredentials.get(id);
        if (!credential)
            return null;
        // Deactivate all other credentials for this tool
        for (const otherCredential of this.toolCredentials.values()) {
            if (otherCredential.tool === credential.tool && otherCredential.id !== id) {
                otherCredential.isActive = false;
                otherCredential.deactivatedAt = new Date();
                otherCredential.updatedAt = new Date();
            }
        }
        // Activate this credential
        credential.isActive = true;
        credential.activatedAt = new Date();
        credential.updatedAt = new Date();
        return credential;
    }
    async deleteToolCredential(id) {
        return this.toolCredentials.delete(id);
    }
    // TokenRegistry methods
    async createTokenRegistry(data) {
        const id = crypto.randomUUID();
        const registry = {
            ...data,
            id
        };
        this.tokenRegistry.set(id, registry);
        return registry;
    }
    async findTokenRegistryByTokenId(tokenId) {
        for (const registry of this.tokenRegistry.values()) {
            if (registry.tokenId === tokenId) {
                return registry;
            }
        }
        return null;
    }
    async findTokenRegistryByAgentId(agentId) {
        return Array.from(this.tokenRegistry.values()).filter(r => r.agentId === agentId);
    }
    async getAllTokenRegistry() {
        return Array.from(this.tokenRegistry.values());
    }
    async updateTokenRegistry(id, data) {
        const registry = this.tokenRegistry.get(id);
        if (!registry)
            return null;
        const updatedRegistry = { ...registry, ...data };
        this.tokenRegistry.set(id, updatedRegistry);
        return updatedRegistry;
    }
    async revokeToken(tokenId) {
        const registry = await this.findTokenRegistryByTokenId(tokenId);
        if (!registry)
            return null;
        registry.isRevoked = true;
        registry.revokedAt = new Date();
        return registry;
    }
    async deleteTokenRegistry(id) {
        return this.tokenRegistry.delete(id);
    }
    // Utility methods
    async clear() {
        this.agents.clear();
        this.tokens.clear();
        this.requestLogs.clear();
        this.policies.clear();
        this.policyLogs.clear();
        this.quotaCounters.clear();
        this.toolCredentials.clear();
        this.tokenRegistry.clear();
    }
    getStats() {
        return {
            agents: this.agents.size,
            tokens: this.tokens.size,
            requestLogs: this.requestLogs.size,
            policies: this.policies.size,
            policyLogs: this.policyLogs.size,
            quotaCounters: this.quotaCounters.size,
            toolCredentials: this.toolCredentials.size,
            tokenRegistry: this.tokenRegistry.size
        };
    }
}
// Export singleton instance
exports.memoryDB = new MemoryDB();
//# sourceMappingURL=memory-db.js.map
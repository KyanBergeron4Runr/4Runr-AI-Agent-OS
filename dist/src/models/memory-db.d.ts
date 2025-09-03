interface Agent {
    id: string;
    name: string;
    role: string;
    createdBy: string;
    publicKey: string;
    status: string;
    createdAt: Date;
}
interface Token {
    id: string;
    agentId: string;
    encrypted: string;
    expiresAt: Date;
    revoked: boolean;
    createdAt: Date;
}
interface RequestLog {
    id: string;
    corrId: string;
    agentId: string;
    tool: string;
    action: string;
    responseTime: number;
    statusCode: number;
    success: boolean;
    errorMessage?: string;
    createdAt: Date;
}
interface Policy {
    id: string;
    name: string;
    description?: string;
    agentId?: string;
    role?: string;
    spec: string;
    specHash: string;
    active: boolean;
    createdAt: Date;
    updatedAt: Date;
}
interface PolicyLog {
    id: string;
    policyId: string;
    agentId: string;
    tool: string;
    action: string;
    decision: string;
    reason?: string;
    requestData?: string;
    responseData?: string;
    createdAt: Date;
}
interface QuotaCounter {
    id: string;
    policyId: string;
    quotaKey: string;
    current: number;
    resetAt: Date;
    createdAt: Date;
    updatedAt: Date;
}
interface ToolCredential {
    id: string;
    tool: string;
    version: string;
    isActive: boolean;
    encryptedCredential: string;
    metadata?: string;
    createdAt: Date;
    updatedAt: Date;
    activatedAt?: Date;
    deactivatedAt?: Date;
}
interface TokenRegistry {
    id: string;
    tokenId: string;
    agentId: string;
    payloadHash: string;
    issuedAt: Date;
    expiresAt: Date;
    isRevoked: boolean;
    revokedAt?: Date;
}
declare class MemoryDB {
    private agents;
    private tokens;
    private requestLogs;
    private policies;
    private policyLogs;
    private quotaCounters;
    private toolCredentials;
    private tokenRegistry;
    createAgent(data: Omit<Agent, 'id' | 'createdAt'>): Promise<Agent>;
    findAgentById(id: string): Promise<Agent | null>;
    findAgentByName(name: string): Promise<Agent | null>;
    getAllAgents(): Promise<Agent[]>;
    createToken(data: Omit<Token, 'id' | 'createdAt'>): Promise<Token>;
    findTokensByAgentId(agentId: string): Promise<Token[]>;
    updateToken(id: string, data: Partial<Token>): Promise<Token | null>;
    createRequestLog(data: Omit<RequestLog, 'id' | 'createdAt'>): Promise<RequestLog>;
    getRequestLogsByAgentId(agentId: string): Promise<RequestLog[]>;
    getAllRequestLogs(limit?: number): Promise<RequestLog[]>;
    getRequestLogsByDateRange(startDate: Date, endDate: Date): Promise<RequestLog[]>;
    createPolicy(data: Omit<Policy, 'id' | 'createdAt' | 'updatedAt'>): Promise<Policy>;
    findPolicyById(id: string): Promise<Policy | null>;
    findPoliciesByAgentId(agentId: string): Promise<Policy[]>;
    findPoliciesByRole(role: string): Promise<Policy[]>;
    getAllPolicies(): Promise<Policy[]>;
    updatePolicy(id: string, data: Partial<Policy>): Promise<Policy | null>;
    deletePolicy(id: string): Promise<boolean>;
    createPolicyLog(data: Omit<PolicyLog, 'id' | 'createdAt'>): Promise<PolicyLog>;
    getPolicyLogsByPolicyId(policyId: string, limit?: number): Promise<PolicyLog[]>;
    getPolicyLogsByAgentId(agentId: string, limit?: number): Promise<PolicyLog[]>;
    getAllPolicyLogs(limit?: number): Promise<PolicyLog[]>;
    createQuotaCounter(data: Omit<QuotaCounter, 'id' | 'createdAt' | 'updatedAt'>): Promise<QuotaCounter>;
    findQuotaCounter(policyId: string, quotaKey: string): Promise<QuotaCounter | null>;
    updateQuotaCounter(id: string, data: Partial<QuotaCounter>): Promise<QuotaCounter | null>;
    resetExpiredQuotaCounters(): Promise<void>;
    createToolCredential(data: Omit<ToolCredential, 'id' | 'createdAt' | 'updatedAt'>): Promise<ToolCredential>;
    findToolCredentialById(id: string): Promise<ToolCredential | null>;
    findActiveToolCredential(tool: string): Promise<ToolCredential | null>;
    findToolCredentialsByTool(tool: string): Promise<ToolCredential[]>;
    getAllToolCredentials(): Promise<ToolCredential[]>;
    updateToolCredential(id: string, data: Partial<ToolCredential>): Promise<ToolCredential | null>;
    activateToolCredential(id: string): Promise<ToolCredential | null>;
    deleteToolCredential(id: string): Promise<boolean>;
    createTokenRegistry(data: Omit<TokenRegistry, 'id'>): Promise<TokenRegistry>;
    findTokenRegistryByTokenId(tokenId: string): Promise<TokenRegistry | null>;
    findTokenRegistryByAgentId(agentId: string): Promise<TokenRegistry[]>;
    getAllTokenRegistry(): Promise<TokenRegistry[]>;
    updateTokenRegistry(id: string, data: Partial<TokenRegistry>): Promise<TokenRegistry | null>;
    revokeToken(tokenId: string): Promise<TokenRegistry | null>;
    deleteTokenRegistry(id: string): Promise<boolean>;
    clear(): Promise<void>;
    getStats(): {
        agents: number;
        tokens: number;
        requestLogs: number;
        policies: number;
        policyLogs: number;
        quotaCounters: number;
        toolCredentials: number;
        tokenRegistry: number;
    };
}
export declare const memoryDB: MemoryDB;
export {};
//# sourceMappingURL=memory-db.d.ts.map
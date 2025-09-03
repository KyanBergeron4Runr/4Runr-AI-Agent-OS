// Simple in-memory database for testing
interface Agent {
  id: string
  name: string
  role: string
  createdBy: string
  publicKey: string
  status: string
  createdAt: Date
}

interface Token {
  id: string
  agentId: string
  encrypted: string
  expiresAt: Date
  revoked: boolean
  createdAt: Date
}

interface RequestLog {
  id: string
  corrId: string
  agentId: string
  tool: string
  action: string
  responseTime: number
  statusCode: number
  success: boolean
  errorMessage?: string
  createdAt: Date
}

interface Policy {
  id: string
  name: string
  description?: string
  agentId?: string
  role?: string
  spec: string // JSON policy specification
  specHash: string // SHA256 hash of spec
  active: boolean
  createdAt: Date
  updatedAt: Date
}

interface PolicyLog {
  id: string
  policyId: string
  agentId: string
  tool: string
  action: string
  decision: string // "allow", "deny"
  reason?: string
  requestData?: string
  responseData?: string
  createdAt: Date
}

interface QuotaCounter {
  id: string
  policyId: string
  quotaKey: string
  current: number
  resetAt: Date
  createdAt: Date
  updatedAt: Date
}

interface ToolCredential {
  id: string
  tool: string
  version: string
  isActive: boolean
  encryptedCredential: string
  metadata?: string
  createdAt: Date
  updatedAt: Date
  activatedAt?: Date
  deactivatedAt?: Date
}

interface TokenRegistry {
  id: string
  tokenId: string
  agentId: string
  payloadHash: string
  issuedAt: Date
  expiresAt: Date
  isRevoked: boolean
  revokedAt?: Date
}

class MemoryDB {
  private agents: Map<string, Agent> = new Map()
  private tokens: Map<string, Token> = new Map()
  private requestLogs: Map<string, RequestLog> = new Map()
  private policies: Map<string, Policy> = new Map()
  private policyLogs: Map<string, PolicyLog> = new Map()
  private quotaCounters: Map<string, QuotaCounter> = new Map()
  private toolCredentials: Map<string, ToolCredential> = new Map()
  private tokenRegistry: Map<string, TokenRegistry> = new Map()

  // Agent methods
  async createAgent(data: Omit<Agent, 'id' | 'createdAt'>): Promise<Agent> {
    const id = crypto.randomUUID()
    const agent: Agent = {
      ...data,
      id,
      createdAt: new Date()
    }
    this.agents.set(id, agent)
    return agent
  }

  async findAgentById(id: string): Promise<Agent | null> {
    return this.agents.get(id) || null
  }

  async findAgentByName(name: string): Promise<Agent | null> {
    for (const agent of this.agents.values()) {
      if (agent.name === name) return agent
    }
    return null
  }

  async getAllAgents(): Promise<Agent[]> {
    return Array.from(this.agents.values())
  }

  // Token methods
  async createToken(data: Omit<Token, 'id' | 'createdAt'>): Promise<Token> {
    const id = crypto.randomUUID()
    const token: Token = {
      ...data,
      id,
      createdAt: new Date()
    }
    this.tokens.set(id, token)
    return token
  }

  async findTokensByAgentId(agentId: string): Promise<Token[]> {
    return Array.from(this.tokens.values()).filter(t => t.agentId === agentId && !t.revoked)
  }

  async updateToken(id: string, data: Partial<Token>): Promise<Token | null> {
    const token = this.tokens.get(id)
    if (!token) return null
    
    const updatedToken = { ...token, ...data }
    this.tokens.set(id, updatedToken)
    return updatedToken
  }

  // RequestLog methods
  async createRequestLog(data: Omit<RequestLog, 'id' | 'createdAt'>): Promise<RequestLog> {
    const id = crypto.randomUUID()
    const log: RequestLog = {
      ...data,
      id,
      createdAt: new Date()
    }
    this.requestLogs.set(id, log)
    return log
  }

  async getRequestLogsByAgentId(agentId: string): Promise<RequestLog[]> {
    return Array.from(this.requestLogs.values()).filter(l => l.agentId === agentId)
  }

  async getAllRequestLogs(limit?: number): Promise<RequestLog[]> {
    const logs = Array.from(this.requestLogs.values())
    logs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    return limit ? logs.slice(0, limit) : logs
  }

  async getRequestLogsByDateRange(startDate: Date, endDate: Date): Promise<RequestLog[]> {
    return Array.from(this.requestLogs.values()).filter(log => 
      log.createdAt >= startDate && log.createdAt <= endDate
    )
  }

  // Policy methods
  async createPolicy(data: Omit<Policy, 'id' | 'createdAt' | 'updatedAt'>): Promise<Policy> {
    const id = crypto.randomUUID()
    const now = new Date()
    const policy: Policy = {
      ...data,
      id,
      createdAt: now,
      updatedAt: now
    }
    this.policies.set(id, policy)
    return policy
  }

  async findPolicyById(id: string): Promise<Policy | null> {
    return this.policies.get(id) || null
  }

  async findPoliciesByAgentId(agentId: string): Promise<Policy[]> {
    return Array.from(this.policies.values()).filter(p => p.agentId === agentId && p.active)
  }

  async findPoliciesByRole(role: string): Promise<Policy[]> {
    return Array.from(this.policies.values()).filter(p => p.role === role && p.active)
  }

  async getAllPolicies(): Promise<Policy[]> {
    return Array.from(this.policies.values())
  }

  async updatePolicy(id: string, data: Partial<Policy>): Promise<Policy | null> {
    const policy = this.policies.get(id)
    if (!policy) return null
    
    const updatedPolicy = { ...policy, ...data, updatedAt: new Date() }
    this.policies.set(id, updatedPolicy)
    return updatedPolicy
  }

  async deletePolicy(id: string): Promise<boolean> {
    return this.policies.delete(id)
  }

  // PolicyLog methods
  async createPolicyLog(data: Omit<PolicyLog, 'id' | 'createdAt'>): Promise<PolicyLog> {
    const id = crypto.randomUUID()
    const log: PolicyLog = {
      ...data,
      id,
      createdAt: new Date()
    }
    this.policyLogs.set(id, log)
    return log
  }

  async getPolicyLogsByPolicyId(policyId: string, limit?: number): Promise<PolicyLog[]> {
    const logs = Array.from(this.policyLogs.values()).filter(l => l.policyId === policyId)
    logs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    return limit ? logs.slice(0, limit) : logs
  }

  async getPolicyLogsByAgentId(agentId: string, limit?: number): Promise<PolicyLog[]> {
    const logs = Array.from(this.policyLogs.values()).filter(l => l.agentId === agentId)
    logs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    return limit ? logs.slice(0, limit) : logs
  }

  async getAllPolicyLogs(limit?: number): Promise<PolicyLog[]> {
    const logs = Array.from(this.policyLogs.values())
    logs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    return limit ? logs.slice(0, limit) : logs
  }

  // QuotaCounter methods
  async createQuotaCounter(data: Omit<QuotaCounter, 'id' | 'createdAt' | 'updatedAt'>): Promise<QuotaCounter> {
    const id = crypto.randomUUID()
    const now = new Date()
    const counter: QuotaCounter = {
      ...data,
      id,
      createdAt: now,
      updatedAt: now
    }
    this.quotaCounters.set(id, counter)
    return counter
  }

  async findQuotaCounter(policyId: string, quotaKey: string): Promise<QuotaCounter | null> {
    for (const counter of this.quotaCounters.values()) {
      if (counter.policyId === policyId && counter.quotaKey === quotaKey) {
        return counter
      }
    }
    return null
  }

  async updateQuotaCounter(id: string, data: Partial<QuotaCounter>): Promise<QuotaCounter | null> {
    const counter = this.quotaCounters.get(id)
    if (!counter) return null
    
    const updatedCounter = { ...counter, ...data, updatedAt: new Date() }
    this.quotaCounters.set(id, updatedCounter)
    return updatedCounter
  }

  async resetExpiredQuotaCounters(): Promise<void> {
    const now = new Date()
    for (const counter of this.quotaCounters.values()) {
      if (counter.resetAt <= now) {
        counter.current = 0
        counter.resetAt = new Date(now.getTime() + 24 * 60 * 60 * 1000) // Reset to tomorrow
        counter.updatedAt = now
      }
    }
  }

  // ToolCredential methods
  async createToolCredential(data: Omit<ToolCredential, 'id' | 'createdAt' | 'updatedAt'>): Promise<ToolCredential> {
    const id = crypto.randomUUID()
    const now = new Date()
    const credential: ToolCredential = {
      ...data,
      id,
      createdAt: now,
      updatedAt: now
    }
    this.toolCredentials.set(id, credential)
    return credential
  }

  async findToolCredentialById(id: string): Promise<ToolCredential | null> {
    return this.toolCredentials.get(id) || null
  }

  async findActiveToolCredential(tool: string): Promise<ToolCredential | null> {
    for (const credential of this.toolCredentials.values()) {
      if (credential.tool === tool && credential.isActive) {
        return credential
      }
    }
    return null
  }

  async findToolCredentialsByTool(tool: string): Promise<ToolCredential[]> {
    return Array.from(this.toolCredentials.values()).filter(c => c.tool === tool)
  }

  async getAllToolCredentials(): Promise<ToolCredential[]> {
    return Array.from(this.toolCredentials.values())
  }

  async updateToolCredential(id: string, data: Partial<ToolCredential>): Promise<ToolCredential | null> {
    const credential = this.toolCredentials.get(id)
    if (!credential) return null
    
    const updatedCredential = { ...credential, ...data, updatedAt: new Date() }
    this.toolCredentials.set(id, updatedCredential)
    return updatedCredential
  }

  async activateToolCredential(id: string): Promise<ToolCredential | null> {
    const credential = this.toolCredentials.get(id)
    if (!credential) return null
    
    // Deactivate all other credentials for this tool
    for (const otherCredential of this.toolCredentials.values()) {
      if (otherCredential.tool === credential.tool && otherCredential.id !== id) {
        otherCredential.isActive = false
        otherCredential.deactivatedAt = new Date()
        otherCredential.updatedAt = new Date()
      }
    }
    
    // Activate this credential
    credential.isActive = true
    credential.activatedAt = new Date()
    credential.updatedAt = new Date()
    
    return credential
  }

  async deleteToolCredential(id: string): Promise<boolean> {
    return this.toolCredentials.delete(id)
  }

  // TokenRegistry methods
  async createTokenRegistry(data: Omit<TokenRegistry, 'id'>): Promise<TokenRegistry> {
    const id = crypto.randomUUID()
    const registry: TokenRegistry = {
      ...data,
      id
    }
    this.tokenRegistry.set(id, registry)
    return registry
  }

  async findTokenRegistryByTokenId(tokenId: string): Promise<TokenRegistry | null> {
    for (const registry of this.tokenRegistry.values()) {
      if (registry.tokenId === tokenId) {
        return registry
      }
    }
    return null
  }

  async findTokenRegistryByAgentId(agentId: string): Promise<TokenRegistry[]> {
    return Array.from(this.tokenRegistry.values()).filter(r => r.agentId === agentId)
  }

  async getAllTokenRegistry(): Promise<TokenRegistry[]> {
    return Array.from(this.tokenRegistry.values())
  }

  async updateTokenRegistry(id: string, data: Partial<TokenRegistry>): Promise<TokenRegistry | null> {
    const registry = this.tokenRegistry.get(id)
    if (!registry) return null
    
    const updatedRegistry = { ...registry, ...data }
    this.tokenRegistry.set(id, updatedRegistry)
    return updatedRegistry
  }

  async revokeToken(tokenId: string): Promise<TokenRegistry | null> {
    const registry = await this.findTokenRegistryByTokenId(tokenId)
    if (!registry) return null
    
    registry.isRevoked = true
    registry.revokedAt = new Date()
    return registry
  }

  async deleteTokenRegistry(id: string): Promise<boolean> {
    return this.tokenRegistry.delete(id)
  }

  // Utility methods
  async clear(): Promise<void> {
    this.agents.clear()
    this.tokens.clear()
    this.requestLogs.clear()
    this.policies.clear()
    this.policyLogs.clear()
    this.quotaCounters.clear()
    this.toolCredentials.clear()
    this.tokenRegistry.clear()
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
    }
  }
}

// Export singleton instance
export const memoryDB = new MemoryDB()

"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PolicyEngine = void 0;
const crypto_1 = __importDefault(require("crypto"));
const memory_db_1 = require("../models/memory-db");
const policy_1 = require("../types/policy");
class PolicyEngine {
    constructor() { }
    static getInstance() {
        if (!PolicyEngine.instance) {
            PolicyEngine.instance = new PolicyEngine();
        }
        return PolicyEngine.instance;
    }
    // Compute SHA256 hash of policy spec for change detection
    computeSpecHash(spec) {
        const specString = JSON.stringify(spec, Object.keys(spec).sort());
        return crypto_1.default.createHash('sha256').update(specString).digest('hex');
    }
    // Load and merge policies for an agent
    async loadMergedPolicies(agentId, agentRole) {
        const agentPolicies = await memory_db_1.memoryDB.findPoliciesByAgentId(agentId);
        const rolePolicies = await memory_db_1.memoryDB.findPoliciesByRole(agentRole);
        const allPolicies = [...agentPolicies, ...rolePolicies];
        const sourcePolicies = allPolicies.map(p => p.id);
        if (allPolicies.length === 0) {
            // Default deny policy if no policies exist
            const defaultSpec = {
                scopes: [],
                intent: 'default_deny'
            };
            return {
                mergedSpec: defaultSpec,
                sourcePolicies: []
            };
        }
        const mergedSpec = this.mergePolicySpecs(allPolicies.map(p => JSON.parse(p.spec)));
        return {
            mergedSpec,
            sourcePolicies
        };
    }
    // Merge multiple policy specs (agent policies override role policies)
    mergePolicySpecs(specs) {
        if (specs.length === 0) {
            throw new Error('Cannot merge empty policy specs');
        }
        if (specs.length === 1) {
            return specs[0];
        }
        // Start with the first spec and merge others
        let merged = { ...specs[0] };
        for (let i = 1; i < specs.length; i++) {
            const spec = specs[i];
            // Merge scopes (union)
            if (spec.scopes) {
                merged.scopes = [...new Set([...merged.scopes, ...spec.scopes])];
            }
            // Merge intent (last one wins)
            if (spec.intent) {
                merged.intent = spec.intent;
            }
            // Merge guards
            if (spec.guards) {
                merged.guards = {
                    ...merged.guards,
                    ...spec.guards,
                    // Merge arrays
                    allowedDomains: spec.guards.allowedDomains
                        ? [...new Set([...(merged.guards?.allowedDomains || []), ...spec.guards.allowedDomains])]
                        : merged.guards?.allowedDomains,
                    blockedDomains: spec.guards.blockedDomains
                        ? [...new Set([...(merged.guards?.blockedDomains || []), ...spec.guards.blockedDomains])]
                        : merged.guards?.blockedDomains,
                    piiFilters: spec.guards.piiFilters
                        ? [...new Set([...(merged.guards?.piiFilters || []), ...spec.guards.piiFilters])]
                        : merged.guards?.piiFilters
                };
            }
            // Merge quotas (union)
            if (spec.quotas) {
                merged.quotas = [...(merged.quotas || []), ...spec.quotas];
            }
            // Merge schedule (last one wins)
            if (spec.schedule) {
                merged.schedule = spec.schedule;
            }
            // Merge response filters
            if (spec.responseFilters) {
                merged.responseFilters = {
                    ...merged.responseFilters,
                    ...spec.responseFilters,
                    // Merge arrays
                    redactFields: spec.responseFilters.redactFields
                        ? [...new Set([...(merged.responseFilters?.redactFields || []), ...spec.responseFilters.redactFields])]
                        : merged.responseFilters?.redactFields,
                    truncateFields: spec.responseFilters.truncateFields
                        ? [...(merged.responseFilters?.truncateFields || []), ...spec.responseFilters.truncateFields]
                        : merged.responseFilters?.truncateFields,
                    blockPatterns: spec.responseFilters.blockPatterns
                        ? [...new Set([...(merged.responseFilters?.blockPatterns || []), ...spec.responseFilters.blockPatterns])]
                        : merged.responseFilters?.blockPatterns
                };
            }
        }
        return merged;
    }
    // Evaluate a request against merged policies
    async evaluateRequest(agentId, agentRole, tool, action, requestData, responseData) {
        const { mergedSpec, sourcePolicies } = await this.loadMergedPolicies(agentId, agentRole);
        // Check scopes
        const scope = `${tool}:${action}`;
        if (!mergedSpec.scopes.includes(scope)) {
            await this.logPolicyDecision(sourcePolicies[0] || 'default', agentId, tool, action, 'deny', 'scope_not_allowed');
            return {
                allowed: false,
                reason: `Scope '${scope}' not allowed. Allowed scopes: ${mergedSpec.scopes.join(', ')}`
            };
        }
        // Check intent (if required)
        if (mergedSpec.intent && requestData.intent && requestData.intent !== mergedSpec.intent) {
            await this.logPolicyDecision(sourcePolicies[0] || 'default', agentId, tool, action, 'deny', 'intent_mismatch');
            return {
                allowed: false,
                reason: `Intent mismatch. Required: ${mergedSpec.intent}, provided: ${requestData.intent}`
            };
        }
        // Check guards
        if (mergedSpec.guards) {
            const guardResult = this.checkGuards(mergedSpec.guards, tool, action, requestData);
            if (!guardResult.allowed) {
                await this.logPolicyDecision(sourcePolicies[0] || 'default', agentId, tool, action, 'deny', guardResult.reason);
                return guardResult;
            }
        }
        // Check schedule
        if (mergedSpec.schedule) {
            const scheduleResult = this.checkSchedule(mergedSpec.schedule);
            if (!scheduleResult.allowed) {
                await this.logPolicyDecision(sourcePolicies[0] || 'default', agentId, tool, action, 'deny', scheduleResult.reason);
                return scheduleResult;
            }
        }
        // Check quotas
        if (mergedSpec.quotas) {
            const quotaResult = await this.checkQuotas(mergedSpec.quotas, agentId, tool, action, sourcePolicies[0]);
            if (!quotaResult.allowed) {
                await this.logPolicyDecision(sourcePolicies[0] || 'default', agentId, tool, action, 'deny', quotaResult.reason);
                return quotaResult;
            }
        }
        // Apply response filters if response data is provided
        let appliedFilters = undefined;
        if (responseData && mergedSpec.responseFilters) {
            appliedFilters = this.applyResponseFilters(mergedSpec.responseFilters, responseData);
        }
        // Log successful evaluation
        await this.logPolicyDecision(sourcePolicies[0] || 'default', agentId, tool, action, 'allow');
        return {
            allowed: true,
            appliedFilters
        };
    }
    // Check various guards
    checkGuards(guards, tool, action, requestData) {
        // Check request size
        if (guards.maxRequestSize) {
            const requestSize = JSON.stringify(requestData).length;
            if (requestSize > guards.maxRequestSize) {
                return {
                    allowed: false,
                    reason: `Request size ${requestSize} exceeds limit ${guards.maxRequestSize}`
                };
            }
        }
        // Check domain allowlist/blocklist for http_fetch
        if (tool === 'http_fetch' && action === 'get') {
            const url = requestData.url;
            if (url) {
                const domain = new URL(url).hostname;
                if (guards.blockedDomains?.includes(domain)) {
                    return {
                        allowed: false,
                        reason: `Domain ${domain} is blocked`
                    };
                }
                if (guards.allowedDomains && !guards.allowedDomains.includes(domain)) {
                    return {
                        allowed: false,
                        reason: `Domain ${domain} not in allowed list: ${guards.allowedDomains.join(', ')}`
                    };
                }
            }
        }
        // Check time window
        if (guards.timeWindow) {
            const now = new Date();
            const tz = guards.timeWindow.timezone || policy_1.DEFAULT_TIMEZONE;
            // Simple time check (in production, use proper timezone library)
            const currentHour = now.getHours();
            const currentMinute = now.getMinutes();
            const currentTime = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;
            if (guards.timeWindow.start && currentTime < guards.timeWindow.start) {
                return {
                    allowed: false,
                    reason: `Request time ${currentTime} before allowed start time ${guards.timeWindow.start}`
                };
            }
            if (guards.timeWindow.end && currentTime > guards.timeWindow.end) {
                return {
                    allowed: false,
                    reason: `Request time ${currentTime} after allowed end time ${guards.timeWindow.end}`
                };
            }
        }
        return { allowed: true };
    }
    // Check schedule constraints
    checkSchedule(schedule) {
        if (!schedule.enabled) {
            return { allowed: true };
        }
        const now = new Date();
        const currentDay = now.getDay(); // 0-6 (Sunday-Saturday)
        const currentHour = now.getHours();
        // Check allowed days
        if (schedule.allowedDays && !schedule.allowedDays.includes(currentDay)) {
            return {
                allowed: false,
                reason: `Day ${currentDay} not in allowed days: ${schedule.allowedDays.join(', ')}`
            };
        }
        // Check allowed hours
        if (schedule.allowedHours) {
            if (schedule.allowedHours.start && currentHour < schedule.allowedHours.start) {
                return {
                    allowed: false,
                    reason: `Current hour ${currentHour} before allowed start hour ${schedule.allowedHours.start}`
                };
            }
            if (schedule.allowedHours.end && currentHour > schedule.allowedHours.end) {
                return {
                    allowed: false,
                    reason: `Current hour ${currentHour} after allowed end hour ${schedule.allowedHours.end}`
                };
            }
        }
        return { allowed: true };
    }
    // Check and update quotas
    async checkQuotas(quotas, agentId, tool, action, policyId) {
        const scope = `${tool}:${action}`;
        for (const quota of quotas) {
            if (quota.action === scope) {
                const quotaKey = (0, policy_1.generateQuotaKey)(scope, quota.window);
                // Find or create quota counter
                let counter = await memory_db_1.memoryDB.findQuotaCounter(policyId, quotaKey);
                if (!counter) {
                    const resetAt = new Date();
                    if (quota.window === '1h') {
                        resetAt.setHours(resetAt.getHours() + 1, 0, 0, 0);
                    }
                    else if (quota.window === '24h') {
                        resetAt.setDate(resetAt.getDate() + 1);
                        resetAt.setHours(0, 0, 0, 0);
                    }
                    else if (quota.window === '7d') {
                        resetAt.setDate(resetAt.getDate() + 7);
                        resetAt.setHours(0, 0, 0, 0);
                    }
                    counter = await memory_db_1.memoryDB.createQuotaCounter({
                        policyId,
                        quotaKey,
                        current: 0,
                        resetAt
                    });
                }
                // Check if quota exceeded
                if (counter.current >= quota.limit) {
                    return {
                        allowed: false,
                        reason: `Quota exceeded for ${scope}: ${counter.current}/${quota.limit} (resets at ${counter.resetAt.toISOString()})`,
                        quotaInfo: {
                            action: scope,
                            current: counter.current,
                            limit: quota.limit,
                            resetAt: counter.resetAt
                        }
                    };
                }
                // Increment counter
                await memory_db_1.memoryDB.updateQuotaCounter(counter.id, {
                    current: counter.current + 1
                });
            }
        }
        return { allowed: true };
    }
    // Apply response filters
    applyResponseFilters(filters, responseData) {
        let filteredData = { ...responseData };
        // Redact sensitive fields
        if (filters.redactFields) {
            for (const field of filters.redactFields) {
                if (filteredData[field] !== undefined) {
                    filteredData[field] = '[REDACTED]';
                }
            }
        }
        // Truncate fields
        if (filters.truncateFields) {
            for (const truncateRule of filters.truncateFields) {
                if (filteredData[truncateRule.field] && typeof filteredData[truncateRule.field] === 'string') {
                    const value = filteredData[truncateRule.field];
                    if (value.length > truncateRule.maxLength) {
                        filteredData[truncateRule.field] = value.substring(0, truncateRule.maxLength) + '...';
                    }
                }
            }
        }
        // Block patterns (simple string matching for now)
        if (filters.blockPatterns) {
            const responseStr = JSON.stringify(filteredData);
            for (const pattern of filters.blockPatterns) {
                if (responseStr.includes(pattern)) {
                    filteredData = { error: 'Response blocked due to content policy' };
                    break;
                }
            }
        }
        return filteredData;
    }
    // Log policy decision
    async logPolicyDecision(policyId, agentId, tool, action, decision, reason, requestData, responseData) {
        await memory_db_1.memoryDB.createPolicyLog({
            policyId,
            agentId,
            tool,
            action,
            decision,
            reason,
            requestData: requestData ? JSON.stringify(requestData).substring(0, 1000) : undefined,
            responseData: responseData ? JSON.stringify(responseData).substring(0, 1000) : undefined
        });
    }
    // Reset expired quota counters (call periodically)
    async resetExpiredQuotaCounters() {
        await memory_db_1.memoryDB.resetExpiredQuotaCounters();
    }
}
exports.PolicyEngine = PolicyEngine;
//# sourceMappingURL=policyEngine.js.map
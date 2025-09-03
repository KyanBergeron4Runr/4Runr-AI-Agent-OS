"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.shield = exports.Shield = void 0;
const config_1 = require("./config");
const telemetry_1 = require("./telemetry");
const crypto_1 = __importDefault(require("crypto"));
class Shield {
    constructor() {
        this.policyCache = new Map();
        this.decisionCache = new Map();
        this.config = config_1.sentinelConfig.getFeatureConfig('shield');
        this.buildPolicyCache();
    }
    /**
     * Evaluate output against Shield policies
     */
    async evaluateOutput(correlationId, agentId, spanId, output, events, verdict, metadata) {
        const startTime = Date.now();
        try {
            // Check if Shield is enabled
            if (!this.config.enabled || this.config.mode === 'off') {
                return this.createPassDecision(correlationId, agentId, spanId, 'shield_disabled', startTime);
            }
            // Evaluate against all policies
            const matchingPolicy = this.evaluatePolicies(events || [], verdict, metadata);
            if (!matchingPolicy) {
                return this.createPassDecision(correlationId, agentId, spanId, 'no_policy_match', startTime);
            }
            // Apply the policy action
            const result = await this.applyPolicy(correlationId, agentId, spanId, output, matchingPolicy, startTime);
            // Store decision and emit audit event
            this.storeDecision(result.decision);
            this.emitAuditEvent(result.decision);
            return result;
        }
        catch (error) {
            console.error('Shield evaluation error:', error);
            const errorDecision = this.createBlockDecision(correlationId, agentId, spanId, 'shield_error', startTime, error);
            this.storeDecision(errorDecision);
            this.emitAuditEvent(errorDecision);
            return { decision: errorDecision, shouldBlock: true, shouldMask: false, shouldRewrite: false, error: error.message || 'Shield evaluation failed' };
        }
    }
    /**
     * Evaluate all policies against events and verdict
     */
    evaluatePolicies(events, verdict, metadata) {
        // Sort policies by priority (highest first)
        const sortedPolicies = Array.from(this.policyCache.values())
            .filter(policy => policy.enabled)
            .sort((a, b) => b.priority - a.priority);
        for (const policy of sortedPolicies) {
            if (this.policyMatches(policy, events, verdict, metadata)) {
                return policy;
            }
        }
        return null;
    }
    /**
     * Check if a policy matches the current conditions
     */
    policyMatches(policy, events, verdict, metadata) {
        const conditions = policy.conditions;
        // Ensure events is an array
        if (!events || !Array.isArray(events)) {
            return false;
        }
        // Check event type
        if (conditions.eventType) {
            const matchingEvents = events.filter(e => e.type === conditions.eventType);
            if (matchingEvents.length === 0) {
                return false;
            }
        }
        // Check severity conditions
        if (conditions.severity) {
            const matchingEvents = events.filter(e => {
                if (typeof conditions.severity === 'string') {
                    return e.severity === conditions.severity;
                }
                else {
                    const min = conditions.severity.min;
                    const max = conditions.severity.max;
                    if (min && this.compareSeverity(e.severity, min) < 0) {
                        return false;
                    }
                    if (max && this.compareSeverity(e.severity, max) > 0) {
                        return false;
                    }
                    return true;
                }
            });
            if (matchingEvents.length === 0) {
                return false;
            }
        }
        // Check confidence
        if (conditions.confidence) {
            const matchingEvents = events.filter(e => {
                const confidence = e.details?.confidence || 0;
                const min = conditions.confidence?.min;
                const max = conditions.confidence?.max;
                if (min && confidence < min)
                    return false;
                if (max && confidence > max)
                    return false;
                return true;
            });
            if (matchingEvents.length === 0) {
                return false;
            }
        }
        // Check groundedness (from verdict)
        if (conditions.groundedness && verdict) {
            const groundedness = verdict.groundedness;
            const min = conditions.groundedness.min;
            const max = conditions.groundedness.max;
            if (min && groundedness < min)
                return false;
            if (max && groundedness > max)
                return false;
        }
        // Check hasExternalAction
        if (conditions.hasExternalAction !== undefined && verdict) {
            const hasExternalAction = metadata?.hasExternalAction || false;
            if (conditions.hasExternalAction !== hasExternalAction) {
                return false;
            }
        }
        // Check patterns in event patterns
        if (conditions.patterns && conditions.patterns.length > 0) {
            const hasMatchingPattern = events.some(event => {
                const eventPatterns = event.details?.patterns || [];
                return conditions.patterns.some(pattern => eventPatterns.some((ep) => ep.toLowerCase().includes(pattern.toLowerCase())));
            });
            if (!hasMatchingPattern) {
                return false;
            }
        }
        // Check cost
        if (conditions.cost) {
            const matchingEvents = events.filter(e => {
                const cost = e.details?.cost || 0;
                const min = conditions.cost?.min;
                const max = conditions.cost?.max;
                if (min && cost < min)
                    return false;
                if (max && cost > max)
                    return false;
                return true;
            });
            if (matchingEvents.length === 0) {
                return false;
            }
        }
        // Check latency
        if (conditions.latency) {
            const matchingEvents = events.filter(e => {
                const latency = e.details?.latency || 0;
                const min = conditions.latency?.min;
                const max = conditions.latency?.max;
                if (min && latency < min)
                    return false;
                if (max && latency > max)
                    return false;
                return true;
            });
            if (matchingEvents.length === 0) {
                return false;
            }
        }
        return true;
    }
    /**
     * Apply a policy action to the output
     */
    async applyPolicy(correlationId, agentId, spanId, output, policy, startTime) {
        const action = this.config.actions[policy.action];
        const latencyMs = Date.now() - startTime;
        switch (policy.action) {
            case 'block':
                return this.applyBlockAction(correlationId, agentId, spanId, policy, action, latencyMs);
            case 'mask':
                return this.applyMaskAction(correlationId, agentId, spanId, output, policy, action, latencyMs);
            case 'rewrite':
                return this.applyRewriteAction(correlationId, agentId, spanId, output, policy, action, latencyMs);
            case 'pass':
                return this.applyPassAction(correlationId, agentId, spanId, policy, latencyMs);
            default:
                throw new Error(`Unknown policy action: ${policy.action}`);
        }
    }
    /**
     * Apply block action
     */
    applyBlockAction(correlationId, agentId, spanId, policy, action, latencyMs) {
        const decision = {
            id: crypto_1.default.randomUUID(),
            correlationId,
            agentId,
            spanId,
            policyId: policy.id,
            action: 'block',
            reason: `Blocked by policy: ${policy.name}`,
            metadata: {
                policyName: policy.name,
                policyDescription: policy.description,
                policyPriority: policy.priority
            },
            timestamp: Date.now(),
            latencyMs
        };
        return {
            decision,
            shouldBlock: true,
            shouldMask: false,
            shouldRewrite: false,
            error: action.response?.error || 'Output blocked by Shield policy'
        };
    }
    /**
     * Apply mask action
     */
    applyMaskAction(correlationId, agentId, spanId, output, policy, action, latencyMs) {
        const sanitizedOutput = this.sanitizeOutput(output, action.patterns);
        const decision = {
            id: crypto_1.default.randomUUID(),
            correlationId,
            agentId,
            spanId,
            policyId: policy.id,
            action: 'mask',
            reason: `Masked by policy: ${policy.name}`,
            originalOutput: this.config.audit.logOriginalOutput ? output : undefined,
            sanitizedOutput: this.config.audit.logSanitizedOutput ? sanitizedOutput : undefined,
            metadata: {
                policyName: policy.name,
                policyDescription: policy.description,
                policyPriority: policy.priority,
                maskPatterns: action.patterns
            },
            timestamp: Date.now(),
            latencyMs
        };
        return {
            decision,
            shouldBlock: false,
            shouldMask: true,
            shouldRewrite: false,
            sanitizedOutput
        };
    }
    /**
     * Apply rewrite action
     */
    applyRewriteAction(correlationId, agentId, spanId, output, policy, action, latencyMs) {
        const decision = {
            id: crypto_1.default.randomUUID(),
            correlationId,
            agentId,
            spanId,
            policyId: policy.id,
            action: 'rewrite',
            reason: `Rewrite requested by policy: ${policy.name}`,
            originalOutput: this.config.audit.logOriginalOutput ? output : undefined,
            metadata: {
                policyName: policy.name,
                policyDescription: policy.description,
                policyPriority: policy.priority,
                maxAttempts: action.maxAttempts,
                correctionPrompt: action.correctionPrompt
            },
            timestamp: Date.now(),
            latencyMs
        };
        return {
            decision,
            shouldBlock: false,
            shouldMask: false,
            shouldRewrite: true,
            sanitizedOutput: output // Keep original for rewrite
        };
    }
    /**
     * Apply pass action
     */
    applyPassAction(correlationId, agentId, spanId, policy, latencyMs) {
        const decision = {
            id: crypto_1.default.randomUUID(),
            correlationId,
            agentId,
            spanId,
            policyId: policy.id,
            action: 'pass',
            reason: `Passed by policy: ${policy.name}`,
            metadata: {
                policyName: policy.name,
                policyDescription: policy.description,
                policyPriority: policy.priority
            },
            timestamp: Date.now(),
            latencyMs
        };
        return {
            decision,
            shouldBlock: false,
            shouldMask: false,
            shouldRewrite: false
        };
    }
    /**
     * Sanitize output based on patterns
     */
    sanitizeOutput(output, patterns) {
        if (typeof output === 'string') {
            let sanitized = output;
            // Replace PII patterns
            if (patterns.pii) {
                sanitized = sanitized.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, patterns.pii);
                sanitized = sanitized.replace(/\b\d{3}-\d{2}-\d{4}\b/g, patterns.pii); // SSN
                sanitized = sanitized.replace(/\b\d{10,11}\b/g, patterns.pii); // Phone
            }
            // Replace hallucination patterns
            if (patterns.hallucination) {
                const hallucinationPatterns = [
                    "I can't verify",
                    "I don't have access to",
                    "I cannot confirm",
                    "I'm not sure",
                    "I don't know"
                ];
                hallucinationPatterns.forEach(pattern => {
                    sanitized = sanitized.replace(new RegExp(pattern, 'gi'), patterns.hallucination);
                });
            }
            // Replace injection patterns
            if (patterns.injection) {
                const injectionPatterns = [
                    "ignore previous instructions",
                    "you are now",
                    "forget everything",
                    "disregard all"
                ];
                injectionPatterns.forEach(pattern => {
                    sanitized = sanitized.replace(new RegExp(pattern, 'gi'), patterns.injection);
                });
            }
            return sanitized;
        }
        return output;
    }
    /**
     * Create a pass decision
     */
    createPassDecision(correlationId, agentId, spanId, reason, startTime) {
        const decision = {
            id: crypto_1.default.randomUUID(),
            correlationId,
            agentId,
            spanId,
            policyId: 'none',
            action: 'pass',
            reason,
            metadata: {},
            timestamp: Date.now(),
            latencyMs: Date.now() - startTime
        };
        return {
            decision,
            shouldBlock: false,
            shouldMask: false,
            shouldRewrite: false
        };
    }
    /**
     * Create a block decision
     */
    createBlockDecision(correlationId, agentId, spanId, reason, startTime, error) {
        const latencyMs = Date.now() - startTime;
        return {
            id: crypto_1.default.randomUUID(),
            correlationId,
            agentId,
            spanId,
            policyId: 'shield_error',
            action: 'block',
            reason,
            metadata: {
                error: error ? error.message : undefined,
                timestamp: Date.now()
            },
            timestamp: Date.now(),
            latencyMs
        };
    }
    /**
     * Store decision in cache
     */
    storeDecision(decision) {
        // Store in cache
        this.decisionCache.set(decision.id, decision);
        // Maintain cache size
        if (this.decisionCache.size > this.config.performance.cacheSize) {
            const oldestKey = this.decisionCache.keys().next().value;
            if (oldestKey) {
                this.decisionCache.delete(oldestKey);
            }
        }
        // Store in telemetry
        telemetry_1.sentinelTelemetry.storeShieldDecision(decision);
    }
    /**
     * Emit audit event
     */
    emitAuditEvent(decision) {
        if (!this.config.audit.enabled) {
            return;
        }
        const auditEvent = {
            id: crypto_1.default.randomUUID(),
            correlationId: decision.correlationId,
            agentId: decision.agentId,
            spanId: decision.spanId,
            timestamp: Date.now(),
            type: 'shield_decision',
            policyId: decision.policyId,
            action: decision.action,
            reason: decision.reason,
            originalOutput: this.config.audit.logOriginalOutput ? decision.originalOutput : undefined,
            sanitizedOutput: this.config.audit.logSanitizedOutput ? decision.sanitizedOutput : undefined,
            metadata: decision.metadata,
            latencyMs: decision.latencyMs
        };
        telemetry_1.sentinelTelemetry.storeAuditEvent(auditEvent);
    }
    /**
     * Build policy cache from config
     */
    buildPolicyCache() {
        this.policyCache.clear();
        for (const policy of this.config.policies) {
            this.policyCache.set(policy.id, policy);
        }
    }
    /**
     * Compare severity levels
     */
    compareSeverity(a, b) {
        const levels = { 'low': 1, 'medium': 2, 'high': 3, 'critical': 4, 'error': 5, 'warn': 2 };
        return (levels[a] || 0) - (levels[b] || 0);
    }
    /**
     * Get Shield configuration
     */
    getConfig() {
        return this.config;
    }
    /**
     * Update Shield configuration
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        this.buildPolicyCache();
    }
    /**
     * Get all decisions for a correlation ID
     */
    getDecisions(correlationId) {
        return Array.from(this.decisionCache.values())
            .filter(d => d.correlationId === correlationId);
    }
    /**
     * Clear decision cache
     */
    clearCache() {
        this.decisionCache.clear();
    }
}
exports.Shield = Shield;
// Singleton instance
exports.shield = new Shield();
//# sourceMappingURL=shield.js.map
import { ShieldConfig, ShieldDecision, SentinelEvent, Verdict } from './types';
export interface ShieldResult {
    decision: ShieldDecision;
    shouldBlock: boolean;
    shouldMask: boolean;
    shouldRewrite: boolean;
    sanitizedOutput?: any;
    error?: string;
}
export declare class Shield {
    private config;
    private policyCache;
    private decisionCache;
    constructor();
    /**
     * Evaluate output against Shield policies
     */
    evaluateOutput(correlationId: string, agentId: string, spanId: string, output: any, events: SentinelEvent[], verdict?: Verdict, metadata?: Record<string, any>): Promise<ShieldResult>;
    /**
     * Evaluate all policies against events and verdict
     */
    private evaluatePolicies;
    /**
     * Check if a policy matches the current conditions
     */
    private policyMatches;
    /**
     * Apply a policy action to the output
     */
    private applyPolicy;
    /**
     * Apply block action
     */
    private applyBlockAction;
    /**
     * Apply mask action
     */
    private applyMaskAction;
    /**
     * Apply rewrite action
     */
    private applyRewriteAction;
    /**
     * Apply pass action
     */
    private applyPassAction;
    /**
     * Sanitize output based on patterns
     */
    private sanitizeOutput;
    /**
     * Create a pass decision
     */
    private createPassDecision;
    /**
     * Create a block decision
     */
    private createBlockDecision;
    /**
     * Store decision in cache
     */
    private storeDecision;
    /**
     * Emit audit event
     */
    private emitAuditEvent;
    /**
     * Build policy cache from config
     */
    private buildPolicyCache;
    /**
     * Compare severity levels
     */
    private compareSeverity;
    /**
     * Get Shield configuration
     */
    getConfig(): ShieldConfig;
    /**
     * Update Shield configuration
     */
    updateConfig(newConfig: Partial<ShieldConfig>): void;
    /**
     * Get all decisions for a correlation ID
     */
    getDecisions(correlationId: string): ShieldDecision[];
    /**
     * Clear decision cache
     */
    clearCache(): void;
}
export declare const shield: Shield;
//# sourceMappingURL=shield.d.ts.map
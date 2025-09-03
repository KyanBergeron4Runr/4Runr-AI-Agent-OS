import { PolicySpec, PolicyEvaluationResult, PolicyMergeResult } from '../types/policy';
export declare class PolicyEngine {
    private static instance;
    private constructor();
    static getInstance(): PolicyEngine;
    computeSpecHash(spec: PolicySpec): string;
    loadMergedPolicies(agentId: string, agentRole: string): Promise<PolicyMergeResult>;
    private mergePolicySpecs;
    evaluateRequest(agentId: string, agentRole: string, tool: string, action: string, requestData: any, responseData?: any): Promise<PolicyEvaluationResult>;
    private checkGuards;
    private checkSchedule;
    private checkQuotas;
    private applyResponseFilters;
    private logPolicyDecision;
    resetExpiredQuotaCounters(): Promise<void>;
}
//# sourceMappingURL=policyEngine.d.ts.map
import { SentinelContext } from './types';
export declare class SentinelMiddleware {
    /**
     * Start monitoring a request
     */
    static startMonitoring(correlationId: string, agentId: string, tool: string, action: string, params: any): SentinelContext | null;
    /**
     * End monitoring and perform safety checks
     */
    static endMonitoring(context: SentinelContext | null, result: any, error?: Error): Promise<{
        shouldBlock: boolean;
        sanitizedOutput?: any;
        error?: string;
    }>;
    /**
     * Store evidence for Judge evaluation
     */
    static storeEvidence(context: SentinelContext | null, sourceId: string, url: string, content: string): void;
    /**
     * Judge the output for groundedness
     */
    private static judgeOutput;
    /**
     * Apply Shield enforcement
     */
    private static applyShieldEnforcement;
    /**
     * Extract output text from result
     */
    private static extractOutputText;
    /**
     * Check if this is an external action
     */
    private static hasExternalAction;
}
//# sourceMappingURL=middleware.d.ts.map
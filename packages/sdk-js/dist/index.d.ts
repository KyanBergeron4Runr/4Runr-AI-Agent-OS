import { Agent, Run, ApiResponse } from '@4runr/shared';
export interface GatewayClientConfig {
    baseUrl: string;
    agentId?: string;
    timeout?: number;
}
export declare class GatewayClient {
    private client;
    private config;
    constructor(config: GatewayClientConfig);
    health(): Promise<ApiResponse>;
    ready(): Promise<ApiResponse>;
    createAgent(agent: Partial<Agent>): Promise<ApiResponse<Agent>>;
    getAgent(agentId: string): Promise<ApiResponse<Agent>>;
    listAgents(): Promise<ApiResponse<Agent[]>>;
    startAgent(agentId: string): Promise<ApiResponse<Run>>;
    getSentinelHealth(): Promise<ApiResponse>;
    getSentinelMetrics(): Promise<ApiResponse>;
    getSentinelConfig(): Promise<ApiResponse>;
    updateSentinelConfig(config: any): Promise<ApiResponse>;
    getCoachReport(agentId: string, runCount?: number): Promise<ApiResponse>;
    startCoachExperiment(agentId: string, patchProposal: any): Promise<ApiResponse>;
    createSSEConnection(runId: string): EventSource;
    emitDemoRun(agentId: string, input: any): Promise<ApiResponse>;
    getBaseUrl(): string;
    getAgentId(): string | undefined;
}
export type { Agent, Run, SentinelSpan, GuardEvent, ApiResponse } from '@4runr/shared';
export default GatewayClient;
//# sourceMappingURL=index.d.ts.map
import { AgentLanguage } from "@prisma/client";
export declare function launchRun({ agentId, language, entrypoint, hostMountPath, cpus, memMb, env }: {
    agentId: string;
    language: AgentLanguage;
    entrypoint: string;
    hostMountPath: string;
    cpus?: number;
    memMb?: number;
    env?: Record<string, any>;
}): Promise<{
    runId: string;
    containerId: string;
}>;
//# sourceMappingURL=runner.d.ts.map
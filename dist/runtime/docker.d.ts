export type StartOpts = {
    image: "agent-node:base" | "agent-python:base";
    agentId: string;
    runId: string;
    entrypoint: string;
    hostMountPath: string;
    cpus?: number;
    memMb?: number;
    network?: "none" | "bridge";
};
export declare function startContainer({ image, agentId, runId, entrypoint, hostMountPath, cpus, memMb, network, env }: {
    image: string;
    agentId: string;
    runId: string;
    entrypoint: string;
    hostMountPath: string;
    cpus?: number;
    memMb?: number;
    network: string;
    env?: Record<string, any>;
}): Promise<string>;
export declare function stopContainer(containerId: string, signal?: string): Promise<void>;
//# sourceMappingURL=docker.d.ts.map
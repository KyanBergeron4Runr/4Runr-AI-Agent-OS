/**
 * Initialize Docker container management integration
 */
export declare function initializeDockerIntegration(): void;
/**
 * Get Docker container status
 */
export declare function getDockerContainerStatus(): {
    enabled: boolean;
    message: string;
    containerManager?: undefined;
    recoveryManager?: undefined;
    containers?: undefined;
} | {
    enabled: boolean;
    containerManager: {
        isMonitoring: boolean;
        containerCount: number;
        healthyContainers: number;
        unhealthyContainers: number;
        runningContainers: number;
        restartAttempts: number;
    };
    recoveryManager: {
        totalAttempts: number;
        successRate: number;
        averageRecoveryTime: number;
    };
    containers: {
        id: string;
        name: string;
        status: string;
        health: string;
        uptime: number;
        restartCount: number;
    }[];
    message?: undefined;
};
/**
 * Get container logs
 */
export declare function getContainerLogs(containerId: string, lines?: number): Promise<import("./docker-recovery-manager").ContainerLogEntry[]>;
/**
 * Trigger manual container recovery
 */
export declare function triggerContainerRecovery(containerId: string, strategyId?: string): Promise<import("./docker-recovery-manager").RecoveryAttempt>;
/**
 * Get container performance metrics
 */
export declare function getContainerPerformance(containerId: string): Promise<{
    cpuTrend: "increasing" | "decreasing" | "stable";
    memoryTrend: "increasing" | "decreasing" | "stable";
    restartFrequency: number;
    healthScore: number;
}>;
//# sourceMappingURL=docker-integration.d.ts.map
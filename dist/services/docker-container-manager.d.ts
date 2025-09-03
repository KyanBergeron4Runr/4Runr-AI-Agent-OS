import { EventEmitter } from 'events';
export interface ContainerInfo {
    id: string;
    name: string;
    image: string;
    status: string;
    state: string;
    health: string;
    ports: string[];
    created: Date;
    started?: Date;
    uptime: number;
    restartCount: number;
}
export interface ContainerStats {
    containerId: string;
    containerName: string;
    cpuPercent: number;
    memoryUsage: number;
    memoryLimit: number;
    memoryPercent: number;
    networkRx: number;
    networkTx: number;
    blockRead: number;
    blockWrite: number;
    pids: number;
    timestamp: Date;
}
export interface ContainerHealthCheck {
    containerId: string;
    containerName: string;
    status: 'healthy' | 'unhealthy' | 'starting' | 'none';
    failingStreak: number;
    log: HealthCheckLog[];
    lastCheck: Date;
}
export interface HealthCheckLog {
    timestamp: Date;
    exitCode: number;
    output: string;
    duration: number;
}
export interface ContainerRestartPolicy {
    name: 'no' | 'always' | 'unless-stopped' | 'on-failure';
    maximumRetryCount?: number;
    delay?: number;
    window?: number;
}
export interface ContainerResourceLimits {
    memory?: string;
    cpus?: string;
    swap?: string;
    kernelMemory?: string;
    oomKillDisable?: boolean;
}
export interface ContainerManagementConfig {
    healthCheckInterval: number;
    statsCollectionInterval: number;
    restartBackoffMultiplier: number;
    maxRestartAttempts: number;
    healthCheckTimeout: number;
    containerTimeout: number;
    logRetention: number;
}
/**
 * Enhanced Docker Container Manager
 * Provides comprehensive container lifecycle management, health monitoring,
 * and resource management with proper restart policies and failure handling
 */
export declare class DockerContainerManager extends EventEmitter {
    private config;
    private containers;
    private healthChecks;
    private stats;
    private restartAttempts;
    private isMonitoring;
    private monitoringInterval?;
    private statsInterval?;
    constructor(config?: Partial<ContainerManagementConfig>);
    /**
     * Start container monitoring
     */
    start(): Promise<void>;
    /**
     * Stop container monitoring
     */
    stop(): Promise<void>;
    /**
     * Discover all containers
     */
    discoverContainers(): Promise<ContainerInfo[]>;
    /**
     * Monitor container health and status
     */
    monitorContainers(): Promise<void>;
    /**
     * Collect container statistics
     */
    collectContainerStats(): Promise<void>;
    /**
     * Check individual container health
     */
    checkContainerHealth(container: ContainerInfo): Promise<ContainerHealthCheck>;
    /**
     * Handle unhealthy containers
     */
    handleUnhealthyContainer(container: ContainerInfo): Promise<void>;
    /**
     * Restart a container
     */
    restartContainer(containerId: string): Promise<boolean>;
    /**
     * Stop a container gracefully
     */
    stopContainer(containerId: string, timeout?: number): Promise<boolean>;
    /**
     * Start a container
     */
    startContainer(containerId: string): Promise<boolean>;
    /**
     * Get container information
     */
    getContainer(containerId: string): ContainerInfo | undefined;
    /**
     * Get all containers
     */
    getAllContainers(): ContainerInfo[];
    /**
     * Get container health status
     */
    getContainerHealth(containerId: string): ContainerHealthCheck | undefined;
    /**
     * Get container statistics
     */
    getContainerStats(containerId: string, limit?: number): ContainerStats[];
    /**
     * Get container management status
     */
    getManagerStatus(): {
        isMonitoring: boolean;
        containerCount: number;
        healthyContainers: number;
        unhealthyContainers: number;
        runningContainers: number;
        restartAttempts: number;
    };
    /**
     * Parse container information from Docker output
     */
    private parseContainerInfo;
    /**
     * Parse container statistics from Docker output
     */
    private parseContainerStats;
    /**
     * Parse health check information
     */
    private parseHealthCheck;
    /**
     * Parse health status from container status string
     */
    private parseHealthStatus;
    /**
     * Parse uptime from status string
     */
    private parseUptime;
    /**
     * Parse memory value (e.g., "1.5GiB" -> bytes)
     */
    private parseMemoryValue;
    /**
     * Parse network value (same as memory)
     */
    private parseNetworkValue;
}
export declare const dockerContainerManager: DockerContainerManager;
//# sourceMappingURL=docker-container-manager.d.ts.map
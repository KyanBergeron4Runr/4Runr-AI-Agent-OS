import { EventEmitter } from 'events';
export interface WatchdogConfig {
    healthCheckUrl: string;
    healthCheckInterval: number;
    healthCheckTimeout: number;
    maxResponseTime: number;
    maxMemoryMB: number;
    maxCpuPercent: number;
    failureThreshold: number;
    restartDelay: number;
    maxRestarts: number;
    restartWindow: number;
    logFile?: string;
}
export interface ProcessHealth {
    responsive: boolean;
    responseTime: number;
    memoryUsage: number;
    cpuUsage: number;
    uptime: number;
    lastCheck: Date;
    consecutiveFailures: number;
}
export interface RecoveryEvent {
    timestamp: Date;
    reason: string;
    action: 'restart' | 'kill' | 'alert';
    success: boolean;
    details?: any;
}
/**
 * External Watchdog Service for monitoring and recovering the main application
 * Runs as a separate process to monitor the main application health
 */
export declare class WatchdogService extends EventEmitter {
    private config;
    private monitoredProcess;
    private monitoredPid;
    private isMonitoring;
    private healthCheckTimer;
    private processHealth;
    private recoveryHistory;
    private restartCount;
    private restartWindowStart;
    constructor(config?: Partial<WatchdogConfig>);
    /**
     * Start monitoring a process by PID
     */
    monitorProcess(pid: number): Promise<void>;
    /**
     * Start monitoring a spawned process
     */
    monitorSpawnedProcess(command: string, args?: string[], options?: any): Promise<void>;
    /**
     * Stop monitoring
     */
    stop(): Promise<void>;
    /**
     * Get current process health
     */
    getProcessHealth(): ProcessHealth;
    /**
     * Get recovery history
     */
    getRecoveryHistory(): RecoveryEvent[];
    /**
     * Force restart the monitored process
     */
    restartProcess(reason: string): Promise<void>;
    /**
     * Kill the monitored process
     */
    killProcess(signal?: string): Promise<void>;
    /**
     * Start health checking loop
     */
    private startHealthChecking;
    /**
     * Perform a single health check
     */
    private performHealthCheck;
    /**
     * Perform HTTP health check
     */
    private httpHealthCheck;
    /**
     * Check if process is running
     */
    private isProcessRunning;
    /**
     * Get process metrics with cross-platform implementation
     */
    private getProcessMetrics;
    /**
     * Get detailed system process metrics using cross-platform commands
     */
    private getSystemProcessMetrics;
    /**
     * Get process metrics on Windows using PowerShell
     */
    private getWindowsProcessMetrics;
    /**
     * Get process metrics on Unix-like systems using ps
     */
    private getUnixProcessMetrics;
    /**
     * Get process metrics from Linux /proc filesystem
     */
    private getLinuxProcMetrics;
    /**
     * Parse elapsed time string from ps command
     */
    private parseElapsedTime;
    /**
     * Handle health check failures
     */
    private handleHealthFailure;
    /**
     * Perform process restart
     */
    private performRestart;
    /**
     * Handle process exit
     */
    private handleProcessExit;
    /**
     * Record recovery event
     */
    private recordRecoveryEvent;
    /**
     * Log message to file and console
     */
    private log;
    /**
     * Setup graceful shutdown
     */
    private setupGracefulShutdown;
    /**
     * Execute command with cross-platform compatibility
     */
    executeCommand(command: string, args?: string[], options?: {
        timeout?: number;
        retries?: number;
        cwd?: string;
    }): Promise<{
        success: boolean;
        output: string;
        error?: string;
    }>;
    /**
     * Get platform information
     */
    getPlatformInfo(): {
        platform: string;
        isWSL: boolean;
        config: import("../utils/cross-platform-executor").PlatformConfig;
    };
}
export declare const watchdogService: WatchdogService;
//# sourceMappingURL=watchdog.d.ts.map
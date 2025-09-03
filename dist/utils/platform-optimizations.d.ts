export interface PlatformInfo {
    platform: string;
    architecture: string;
    isWSL: boolean;
    isDocker: boolean;
    cpuCount: number;
    totalMemory: number;
    freeMemory: number;
    nodeVersion: string;
    optimizations: PlatformOptimizations;
}
export interface PlatformOptimizations {
    fileHandling: FileHandlingOptimizations;
    processManagement: ProcessManagementOptimizations;
    memoryManagement: MemoryManagementOptimizations;
    networkOptimizations: NetworkOptimizations;
    dockerOptimizations: DockerOptimizations;
}
export interface FileHandlingOptimizations {
    useAsyncIO: boolean;
    batchSize: number;
    bufferSize: number;
    concurrentOperations: number;
    fsyncEnabled: boolean;
    tempDirectory: string;
}
export interface ProcessManagementOptimizations {
    maxWorkers: number;
    processTimeout: number;
    gracefulShutdownTimeout: number;
    processPooling: boolean;
    signalHandling: string[];
}
export interface MemoryManagementOptimizations {
    gcStrategy: 'aggressive' | 'balanced' | 'conservative';
    heapSizeLimit: number;
    gcInterval: number;
    memoryThreshold: number;
    enableMemoryProfiling: boolean;
}
export interface NetworkOptimizations {
    keepAliveTimeout: number;
    maxConnections: number;
    connectionPooling: boolean;
    tcpNoDelay: boolean;
    socketTimeout: number;
}
export interface DockerOptimizations {
    useDockerAPI: boolean;
    healthCheckInterval: number;
    restartPolicy: string;
    resourceLimits: {
        memory: string;
        cpu: string;
    };
    logDriver: string;
}
/**
 * Platform-Specific Optimizations Manager
 * Provides optimized configurations and utilities for different platforms
 */
export declare class PlatformOptimizer {
    private platformInfo;
    private optimizations;
    constructor();
    /**
     * Get platform information and optimizations
     */
    getPlatformInfo(): PlatformInfo;
    /**
     * Get optimized file handling configuration
     */
    getFileHandlingOptimizations(): FileHandlingOptimizations;
    /**
     * Get optimized process management configuration
     */
    getProcessManagementOptimizations(): ProcessManagementOptimizations;
    /**
     * Get optimized memory management configuration
     */
    getMemoryManagementOptimizations(): MemoryManagementOptimizations;
    /**
     * Get optimized network configuration
     */
    getNetworkOptimizations(): NetworkOptimizations;
    /**
     * Get optimized Docker configuration
     */
    getDockerOptimizations(): DockerOptimizations;
    /**
     * Apply platform-specific file system optimizations
     */
    optimizeFileOperations(filePath: string, data: string | Buffer): Promise<void>;
    /**
     * Apply platform-specific process optimizations
     */
    applyProcessOptimizations(): void;
    /**
     * Apply platform-specific memory optimizations
     */
    applyMemoryOptimizations(): void;
    /**
     * Get optimized Docker Compose configuration
     */
    getOptimizedDockerConfig(): any;
    /**
     * Get optimized Node.js options
     */
    getNodeOptions(): string;
    /**
     * Detect platform information
     */
    private detectPlatform;
    /**
     * Detect if running in WSL
     */
    private detectWSL;
    /**
     * Detect if running in Docker
     */
    private detectDocker;
    /**
     * Generate platform-specific optimizations
     */
    private generateOptimizations;
    /**
     * Windows-specific optimizations
     */
    private getWindowsOptimizations;
    /**
     * WSL-specific optimizations
     */
    private getWSLOptimizations;
    /**
     * Linux-specific optimizations
     */
    private getLinuxOptimizations;
    /**
     * macOS-specific optimizations
     */
    private getMacOSOptimizations;
    /**
     * Windows-specific file writing
     */
    private writeFileWindows;
    /**
     * Unix-specific file writing
     */
    private writeFileUnix;
}
export declare const platformOptimizer: PlatformOptimizer;
export declare function getPlatformInfo(): PlatformInfo;
export declare function applyPlatformOptimizations(): void;
export declare function optimizedFileWrite(filePath: string, data: string | Buffer): Promise<void>;
//# sourceMappingURL=platform-optimizations.d.ts.map
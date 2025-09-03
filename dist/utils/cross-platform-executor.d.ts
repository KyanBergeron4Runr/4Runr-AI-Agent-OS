import { SpawnOptions } from 'child_process';
import { EventEmitter } from 'events';
export interface ExecutionOptions {
    timeout?: number;
    retries?: number;
    retryDelay?: number;
    maxBuffer?: number;
    cwd?: string;
    env?: Record<string, string>;
    shell?: boolean;
    windowsHide?: boolean;
    killSignal?: string | number;
    encoding?: BufferEncoding;
}
export interface ExecutionResult {
    success: boolean;
    exitCode: number | null;
    signal: string | null;
    stdout: string;
    stderr: string;
    duration: number;
    retryCount: number;
    platform: string;
    command: string;
    args: string[];
}
export interface PlatformConfig {
    maxBuffer: number;
    defaultTimeout: number;
    defaultRetries: number;
    retryDelay: number;
    killSignal: string | number;
    shell: boolean;
    windowsHide: boolean;
    spawnOptions: Partial<SpawnOptions>;
}
/**
 * Cross-Platform Command Executor
 * Handles platform-specific command execution with proper error handling,
 * timeouts, retries, and buffer management for Windows/WSL2 compatibility
 */
export declare class CrossPlatformExecutor extends EventEmitter {
    private platformConfig;
    private currentPlatform;
    constructor();
    /**
     * Execute command with cross-platform compatibility
     */
    execute(command: string, args?: string[], options?: ExecutionOptions): Promise<ExecutionResult>;
    /**
     * Execute command once with platform-specific handling
     */
    private executeOnce;
    /**
     * Prepare command and arguments for platform-specific execution
     */
    private prepareCommand;
    /**
     * Kill process with platform-specific signal
     */
    private killProcess;
    /**
     * Check if error is Windows buffer overflow (ENOBUFS)
     */
    private isWindowsBufferError;
    /**
     * Check if running in WSL
     */
    private isWSL;
    /**
     * Determine if command should be retried
     */
    private shouldRetry;
    /**
     * Get platform-specific configuration
     */
    private getPlatformConfig;
    /**
     * Merge user options with platform defaults
     */
    private mergeOptions;
    /**
     * Utility delay function
     */
    private delay;
    /**
     * Get platform information
     */
    getPlatformInfo(): {
        platform: string;
        isWSL: boolean;
        config: PlatformConfig;
    };
}
export declare const crossPlatformExecutor: CrossPlatformExecutor;
export declare function executeCommand(command: string, args?: string[], options?: ExecutionOptions): Promise<ExecutionResult>;
//# sourceMappingURL=cross-platform-executor.d.ts.map
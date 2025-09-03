interface BackupMetadata {
    id: string;
    timestamp: Date;
    configPath: string;
    reason: string;
    checksum: string;
    size: number;
}
interface BackupInfo {
    metadata: BackupMetadata;
    exists: boolean;
}
/**
 * Configuration Manager for safe, atomic configuration updates
 * Integrates with existing validation system to prevent corruption
 */
export declare class ConfigurationManager {
    private readonly configPath;
    private readonly backupDir;
    private readonly lockDir;
    private readonly lockTimeout;
    constructor(configPath?: string);
    /**
     * Safely update configuration with atomic writes and validation
     */
    updateConfig(changes: Record<string, string>, reason?: string): Promise<void>;
    /**
     * Create a timestamped backup of current configuration with metadata
     */
    createBackup(reason?: string): Promise<string>;
    /**
     * Rollback to a specific backup
     */
    rollbackConfig(backupId: string): Promise<void>;
    /**
     * Read and parse current configuration
     */
    private readConfig;
    /**
     * Write configuration atomically to prevent corruption
     */
    private writeConfigAtomic;
    /**
     * Validate configuration using existing validation system
     */
    private validateConfiguration;
    /**
     * Safe chaos flag toggle (prevents corruption)
     */
    toggleChaos(enabled: boolean): Promise<void>;
    /**
     * Execute operation with file locking to prevent concurrent access
     */
    withConfigLock<T>(operation: () => Promise<T>, operationName?: string): Promise<T>;
    /**
     * List available backups with metadata
     */
    listBackups(): Promise<string[]>;
    /**
     * Get detailed backup information
     */
    getBackupInfo(backupId: string): Promise<BackupInfo>;
    /**
     * Clean up old backups (keep last N backups)
     */
    cleanupBackups(keepCount?: number): Promise<number>;
    /**
     * Verify backup integrity
     */
    verifyBackup(backupId: string): Promise<boolean>;
    /**
     * Calculate simple checksum for content verification
     */
    private calculateChecksum;
    /**
     * Check if file exists
     */
    private fileExists;
    /**
     * Acquire configuration lock with timeout
     */
    private acquireLock;
    /**
     * Release configuration lock
     */
    private releaseLock;
    /**
     * Generate unique lock ID
     */
    private generateLockId;
    /**
     * Check if a process is still running
     */
    private isProcessRunning;
    /**
     * Utility delay function
     */
    private delay;
    /**
     * Clean up stale locks on startup
     */
    cleanupStaleLocks(): Promise<number>;
}
export declare const configManager: ConfigurationManager;
export {};
//# sourceMappingURL=manager.d.ts.map
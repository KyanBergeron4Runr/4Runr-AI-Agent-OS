"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.configManager = exports.ConfigurationManager = void 0;
const fs_1 = require("fs");
const path_1 = require("path");
const validate_1 = require("./validate");
/**
 * Configuration Manager for safe, atomic configuration updates
 * Integrates with existing validation system to prevent corruption
 */
class ConfigurationManager {
    constructor(configPath = 'config/.env') {
        this.lockTimeout = 30000; // 30 seconds
        this.configPath = configPath;
        this.backupDir = (0, path_1.join)(configPath, '..', '.env-backups');
        this.lockDir = (0, path_1.join)(configPath, '..', '.env-locks');
    }
    /**
     * Safely update configuration with atomic writes and validation
     */
    async updateConfig(changes, reason = 'update') {
        return this.withConfigLock(async () => {
            // Create backup before any changes
            const backupId = await this.createBackup(reason);
            try {
                // Read current config
                const currentConfig = await this.readConfig();
                // Apply changes
                const newConfig = { ...currentConfig, ...changes };
                // Validate new configuration
                this.validateConfiguration(newConfig);
                // Write atomically (write to temp file, then rename)
                await this.writeConfigAtomic(newConfig);
                // Clean up old backups (keep last 10)
                await this.cleanupBackups(10);
                console.log(`✅ Configuration updated successfully (backup: ${backupId})`);
            }
            catch (error) {
                // Rollback on any error
                await this.rollbackConfig(backupId);
                const message = error instanceof Error ? error.message : String(error);
                throw new Error(`Configuration update failed: ${message}`);
            }
        }, 'update');
    }
    /**
     * Create a timestamped backup of current configuration with metadata
     */
    async createBackup(reason = 'manual') {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupId = `env-backup-${timestamp}`;
        const backupPath = (0, path_1.join)(this.backupDir, `${backupId}.env`);
        const metadataPath = (0, path_1.join)(this.backupDir, `${backupId}.json`);
        // Ensure backup directory exists
        await fs_1.promises.mkdir(this.backupDir, { recursive: true });
        // Get file stats and checksum
        const stats = await fs_1.promises.stat(this.configPath);
        const content = await fs_1.promises.readFile(this.configPath, 'utf-8');
        const checksum = this.calculateChecksum(content);
        // Create metadata
        const metadata = {
            id: backupId,
            timestamp: new Date(),
            configPath: this.configPath,
            reason,
            checksum,
            size: stats.size
        };
        // Copy current config to backup
        await fs_1.promises.copyFile(this.configPath, backupPath);
        // Save metadata
        await fs_1.promises.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
        console.log(`📦 Backup created: ${backupId} (${reason})`);
        return backupId;
    }
    /**
     * Rollback to a specific backup
     */
    async rollbackConfig(backupId) {
        const backupPath = (0, path_1.join)(this.backupDir, `${backupId}.env`);
        try {
            await fs_1.promises.copyFile(backupPath, this.configPath);
            console.log(`✅ Configuration rolled back to ${backupId}`);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(`Rollback failed: ${message}`);
        }
    }
    /**
     * Read and parse current configuration
     */
    async readConfig() {
        const content = await fs_1.promises.readFile(this.configPath, 'utf-8');
        const config = {};
        for (const line of content.split('\n')) {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#')) {
                const [key, ...valueParts] = trimmed.split('=');
                if (key && valueParts.length > 0) {
                    let value = valueParts.join('=');
                    // Remove quotes if present
                    if ((value.startsWith('"') && value.endsWith('"')) ||
                        (value.startsWith("'") && value.endsWith("'"))) {
                        value = value.slice(1, -1);
                    }
                    config[key.trim()] = value;
                }
            }
        }
        return config;
    }
    /**
     * Write configuration atomically to prevent corruption
     */
    async writeConfigAtomic(config) {
        const tempPath = `${this.configPath}.tmp`;
        // Build config content
        const lines = [
            '# --- REQUIRED ---',
            `PORT=${config.PORT || '3000'}`,
            `DATABASE_URL=${config.DATABASE_URL || ''}`,
            `REDIS_URL=${config.REDIS_URL || ''}`,
            `TOKEN_HMAC_SECRET=${config.TOKEN_HMAC_SECRET || ''}`,
            `SECRETS_BACKEND=${config.SECRETS_BACKEND || 'env'}`,
            `HTTP_TIMEOUT_MS=${config.HTTP_TIMEOUT_MS || '6000'}`,
            `DEFAULT_TIMEZONE=${config.DEFAULT_TIMEZONE || 'America/Toronto'}`,
            `KEK_BASE64=${config.KEK_BASE64 || ''}`,
            '',
            '# --- OPTIONAL / FEATURE FLAGS ---',
            `FF_CACHE=${config.FF_CACHE || 'on'}`,
            `FF_RETRY=${config.FF_RETRY || 'on'}`,
            `FF_BREAKERS=${config.FF_BREAKERS || 'on'}`,
            `FF_ASYNC=${config.FF_ASYNC || 'on'}`,
            `FF_POLICY=${config.FF_POLICY || 'on'}`,
            `UPSTREAM_MODE=${config.UPSTREAM_MODE || 'mock'}`,
            `FF_CHAOS=${config.FF_CHAOS || 'off'}`,
            ''
        ];
        // Add any additional config keys not in the template
        const templateKeys = new Set([
            'PORT', 'DATABASE_URL', 'REDIS_URL', 'TOKEN_HMAC_SECRET', 'SECRETS_BACKEND',
            'HTTP_TIMEOUT_MS', 'DEFAULT_TIMEZONE', 'KEK_BASE64', 'FF_CACHE', 'FF_RETRY',
            'FF_BREAKERS', 'FF_ASYNC', 'FF_POLICY', 'UPSTREAM_MODE', 'FF_CHAOS'
        ]);
        const additionalKeys = Object.keys(config).filter(key => !templateKeys.has(key));
        if (additionalKeys.length > 0) {
            lines.push('# --- ADDITIONAL CONFIG ---');
            for (const key of additionalKeys) {
                const value = config[key];
                // Quote values that contain spaces or special characters
                const quotedValue = /[\s"'#]/.test(value) ? `"${value.replace(/"/g, '\\"')}"` : value;
                lines.push(`${key}=${quotedValue}`);
            }
            lines.push('');
        }
        const content = lines.join('\n');
        // Write to temp file first
        await fs_1.promises.writeFile(tempPath, content, 'utf-8');
        // Atomic rename (this is atomic on most filesystems)
        await fs_1.promises.rename(tempPath, this.configPath);
    }
    /**
     * Validate configuration using existing validation system
     */
    validateConfiguration(config) {
        try {
            (0, validate_1.validateEnv)(config);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(`Configuration validation failed: ${message}`);
        }
    }
    /**
     * Safe chaos flag toggle (prevents corruption)
     */
    async toggleChaos(enabled) {
        const reason = `chaos-${enabled ? 'enable' : 'disable'}`;
        await this.updateConfig({ FF_CHAOS: enabled ? 'on' : 'off' }, reason);
    }
    /**
     * Execute operation with file locking to prevent concurrent access
     */
    async withConfigLock(operation, operationName = 'operation') {
        const lockId = this.generateLockId();
        const lockPath = (0, path_1.join)(this.lockDir, `${lockId}.lock`);
        // Ensure lock directory exists
        await fs_1.promises.mkdir(this.lockDir, { recursive: true });
        try {
            // Acquire lock
            await this.acquireLock(lockId, operationName, lockPath);
            console.log(`🔒 Configuration lock acquired: ${lockId} (${operationName})`);
            // Execute operation
            const result = await operation();
            console.log(`🔓 Configuration operation completed: ${lockId}`);
            return result;
        }
        finally {
            // Always release lock
            await this.releaseLock(lockPath);
        }
    }
    /**
     * List available backups with metadata
     */
    async listBackups() {
        try {
            const files = await fs_1.promises.readdir(this.backupDir);
            return files
                .filter(f => f.endsWith('.env'))
                .map(f => f.replace('.env', ''))
                .sort()
                .reverse(); // Most recent first
        }
        catch {
            return [];
        }
    }
    /**
     * Get detailed backup information
     */
    async getBackupInfo(backupId) {
        const backupPath = (0, path_1.join)(this.backupDir, `${backupId}.env`);
        const metadataPath = (0, path_1.join)(this.backupDir, `${backupId}.json`);
        try {
            const exists = await this.fileExists(backupPath);
            let metadata;
            if (await this.fileExists(metadataPath)) {
                const metadataContent = await fs_1.promises.readFile(metadataPath, 'utf-8');
                metadata = JSON.parse(metadataContent);
            }
            else {
                // Create metadata for legacy backups
                const stats = await fs_1.promises.stat(backupPath);
                const content = await fs_1.promises.readFile(backupPath, 'utf-8');
                metadata = {
                    id: backupId,
                    timestamp: stats.mtime,
                    configPath: this.configPath,
                    reason: 'legacy',
                    checksum: this.calculateChecksum(content),
                    size: stats.size
                };
            }
            return { metadata, exists };
        }
        catch {
            return {
                metadata: {
                    id: backupId,
                    timestamp: new Date(0),
                    configPath: this.configPath,
                    reason: 'unknown',
                    checksum: '',
                    size: 0
                },
                exists: false
            };
        }
    }
    /**
     * Clean up old backups (keep last N backups)
     */
    async cleanupBackups(keepCount = 10) {
        const backups = await this.listBackups();
        const toDelete = backups.slice(keepCount);
        let deletedCount = 0;
        for (const backupId of toDelete) {
            try {
                const backupPath = (0, path_1.join)(this.backupDir, `${backupId}.env`);
                const metadataPath = (0, path_1.join)(this.backupDir, `${backupId}.json`);
                await fs_1.promises.unlink(backupPath);
                if (await this.fileExists(metadataPath)) {
                    await fs_1.promises.unlink(metadataPath);
                }
                deletedCount++;
            }
            catch (error) {
                console.warn(`⚠️ Failed to delete backup ${backupId}:`, error);
            }
        }
        if (deletedCount > 0) {
            console.log(`🧹 Cleaned up ${deletedCount} old backups`);
        }
        return deletedCount;
    }
    /**
     * Verify backup integrity
     */
    async verifyBackup(backupId) {
        try {
            const info = await this.getBackupInfo(backupId);
            if (!info.exists)
                return false;
            const backupPath = (0, path_1.join)(this.backupDir, `${backupId}.env`);
            const content = await fs_1.promises.readFile(backupPath, 'utf-8');
            const actualChecksum = this.calculateChecksum(content);
            return actualChecksum === info.metadata.checksum;
        }
        catch {
            return false;
        }
    }
    /**
     * Calculate simple checksum for content verification
     */
    calculateChecksum(content) {
        let hash = 0;
        for (let i = 0; i < content.length; i++) {
            const char = content.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return hash.toString(16);
    }
    /**
     * Check if file exists
     */
    async fileExists(path) {
        try {
            await fs_1.promises.access(path);
            return true;
        }
        catch {
            return false;
        }
    }
    /**
     * Acquire configuration lock with timeout
     */
    async acquireLock(lockId, operationName, lockPath) {
        const startTime = Date.now();
        const lock = {
            id: lockId,
            timestamp: new Date(),
            operation: operationName,
            pid: process.pid
        };
        while (Date.now() - startTime < this.lockTimeout) {
            try {
                // Try to create lock file exclusively
                await fs_1.promises.writeFile(lockPath, JSON.stringify(lock, null, 2), { flag: 'wx' });
                return; // Lock acquired successfully
            }
            catch (error) {
                if (error.code === 'EEXIST') {
                    // Lock file exists, check if it's stale
                    try {
                        const existingLockContent = await fs_1.promises.readFile(lockPath, 'utf-8');
                        const existingLock = JSON.parse(existingLockContent);
                        // Check if lock is stale (older than timeout)
                        const lockAge = Date.now() - new Date(existingLock.timestamp).getTime();
                        if (lockAge > this.lockTimeout) {
                            console.log(`🧹 Removing stale configuration lock: ${existingLock.id} (age: ${Math.round(lockAge / 1000)}s)`);
                            await fs_1.promises.unlink(lockPath);
                            continue; // Try again
                        }
                        // Check if the process that created the lock is still running
                        if (!this.isProcessRunning(existingLock.pid)) {
                            console.log(`🧹 Removing orphaned configuration lock: ${existingLock.id} (PID ${existingLock.pid} not running)`);
                            await fs_1.promises.unlink(lockPath);
                            continue; // Try again
                        }
                        // Lock is valid, wait and retry
                        console.log(`⏳ Waiting for configuration lock: ${existingLock.id} (${existingLock.operation})`);
                        await this.delay(1000); // Wait 1 second
                    }
                    catch (parseError) {
                        // Corrupted lock file, remove it
                        console.log(`🧹 Removing corrupted configuration lock file`);
                        try {
                            await fs_1.promises.unlink(lockPath);
                        }
                        catch { }
                        continue; // Try again
                    }
                }
                else {
                    throw error;
                }
            }
        }
        throw new Error(`Failed to acquire configuration lock within ${this.lockTimeout}ms timeout`);
    }
    /**
     * Release configuration lock
     */
    async releaseLock(lockPath) {
        try {
            await fs_1.promises.unlink(lockPath);
        }
        catch (error) {
            // Lock file might already be removed, that's okay
            console.log(`⚠️ Failed to remove lock file (might already be removed):`, error);
        }
    }
    /**
     * Generate unique lock ID
     */
    generateLockId() {
        return `config-lock-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    /**
     * Check if a process is still running
     */
    isProcessRunning(pid) {
        try {
            // Sending signal 0 checks if process exists without actually sending a signal
            process.kill(pid, 0);
            return true;
        }
        catch {
            return false;
        }
    }
    /**
     * Utility delay function
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    /**
     * Clean up stale locks on startup
     */
    async cleanupStaleLocks() {
        try {
            const lockFiles = await fs_1.promises.readdir(this.lockDir);
            let cleanedCount = 0;
            for (const file of lockFiles) {
                if (file.endsWith('.lock')) {
                    const lockPath = (0, path_1.join)(this.lockDir, file);
                    try {
                        const lockContent = await fs_1.promises.readFile(lockPath, 'utf-8');
                        const lock = JSON.parse(lockContent);
                        const lockAge = Date.now() - new Date(lock.timestamp).getTime();
                        if (lockAge > this.lockTimeout || !this.isProcessRunning(lock.pid)) {
                            await fs_1.promises.unlink(lockPath);
                            cleanedCount++;
                            console.log(`🧹 Cleaned up stale lock: ${lock.id}`);
                        }
                    }
                    catch {
                        // Corrupted lock file, remove it
                        await fs_1.promises.unlink(lockPath);
                        cleanedCount++;
                    }
                }
            }
            if (cleanedCount > 0) {
                console.log(`🧹 Cleaned up ${cleanedCount} stale configuration locks`);
            }
            return cleanedCount;
        }
        catch {
            // Lock directory doesn't exist yet
            return 0;
        }
    }
}
exports.ConfigurationManager = ConfigurationManager;
// Export singleton instance for easy use
exports.configManager = new ConfigurationManager();
//# sourceMappingURL=manager.js.map
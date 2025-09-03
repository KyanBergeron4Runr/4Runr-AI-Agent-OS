import { promises as fs } from 'fs'
import { join } from 'path'
import { validateEnv } from './validate'

interface ConfigLock {
  id: string
  timestamp: Date
  operation: string
  pid: number
}

interface BackupMetadata {
  id: string
  timestamp: Date
  configPath: string
  reason: string
  checksum: string
  size: number
}

interface BackupInfo {
  metadata: BackupMetadata
  exists: boolean
}

/**
 * Configuration Manager for safe, atomic configuration updates
 * Integrates with existing validation system to prevent corruption
 */
export class ConfigurationManager {
  private readonly configPath: string
  private readonly backupDir: string
  private readonly lockDir: string
  private readonly lockTimeout: number = 30000 // 30 seconds
  
  constructor(configPath = 'config/.env') {
    this.configPath = configPath
    this.backupDir = join(configPath, '..', '.env-backups')
    this.lockDir = join(configPath, '..', '.env-locks')
  }
  
  /**
   * Safely update configuration with atomic writes and validation
   */
  async updateConfig(changes: Record<string, string>, reason = 'update'): Promise<void> {
    return this.withConfigLock(async () => {
      // Create backup before any changes
      const backupId = await this.createBackup(reason)
      
      try {
        // Read current config
        const currentConfig = await this.readConfig()
        
        // Apply changes
        const newConfig = { ...currentConfig, ...changes }
        
        // Validate new configuration
        this.validateConfiguration(newConfig)
        
        // Write atomically (write to temp file, then rename)
        await this.writeConfigAtomic(newConfig)
        
        // Clean up old backups (keep last 10)
        await this.cleanupBackups(10)
        
        console.log(`✅ Configuration updated successfully (backup: ${backupId})`)
      } catch (error) {
        // Rollback on any error
        await this.rollbackConfig(backupId)
        const message = error instanceof Error ? error.message : String(error)
        throw new Error(`Configuration update failed: ${message}`)
      }
    }, 'update')
  }
  
  /**
   * Create a timestamped backup of current configuration with metadata
   */
  async createBackup(reason = 'manual'): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const backupId = `env-backup-${timestamp}`
    const backupPath = join(this.backupDir, `${backupId}.env`)
    const metadataPath = join(this.backupDir, `${backupId}.json`)
    
    // Ensure backup directory exists
    await fs.mkdir(this.backupDir, { recursive: true })
    
    // Get file stats and checksum
    const stats = await fs.stat(this.configPath)
    const content = await fs.readFile(this.configPath, 'utf-8')
    const checksum = this.calculateChecksum(content)
    
    // Create metadata
    const metadata: BackupMetadata = {
      id: backupId,
      timestamp: new Date(),
      configPath: this.configPath,
      reason,
      checksum,
      size: stats.size
    }
    
    // Copy current config to backup
    await fs.copyFile(this.configPath, backupPath)
    
    // Save metadata
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2))
    
    console.log(`📦 Backup created: ${backupId} (${reason})`)
    return backupId
  }
  
  /**
   * Rollback to a specific backup
   */
  async rollbackConfig(backupId: string): Promise<void> {
    const backupPath = join(this.backupDir, `${backupId}.env`)
    
    try {
      await fs.copyFile(backupPath, this.configPath)
      console.log(`✅ Configuration rolled back to ${backupId}`)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      throw new Error(`Rollback failed: ${message}`)
    }
  }
  
  /**
   * Read and parse current configuration
   */
  private async readConfig(): Promise<Record<string, string>> {
    const content = await fs.readFile(this.configPath, 'utf-8')
    const config: Record<string, string> = {}
    
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=')
        if (key && valueParts.length > 0) {
          let value = valueParts.join('=')
          // Remove quotes if present
          if ((value.startsWith('"') && value.endsWith('"')) || 
              (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1)
          }
          config[key.trim()] = value
        }
      }
    }
    
    return config
  }
  
  /**
   * Write configuration atomically to prevent corruption
   */
  private async writeConfigAtomic(config: Record<string, string>): Promise<void> {
    const tempPath = `${this.configPath}.tmp`
    
    // Build config content
    const lines: string[] = [
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
    ]
    
    // Add any additional config keys not in the template
    const templateKeys = new Set([
      'PORT', 'DATABASE_URL', 'REDIS_URL', 'TOKEN_HMAC_SECRET', 'SECRETS_BACKEND',
      'HTTP_TIMEOUT_MS', 'DEFAULT_TIMEZONE', 'KEK_BASE64', 'FF_CACHE', 'FF_RETRY',
      'FF_BREAKERS', 'FF_ASYNC', 'FF_POLICY', 'UPSTREAM_MODE', 'FF_CHAOS'
    ])
    
    const additionalKeys = Object.keys(config).filter(key => !templateKeys.has(key))
    if (additionalKeys.length > 0) {
      lines.push('# --- ADDITIONAL CONFIG ---')
      for (const key of additionalKeys) {
        const value = config[key]
        // Quote values that contain spaces or special characters
        const quotedValue = /[\s"'#]/.test(value) ? `"${value.replace(/"/g, '\\"')}"` : value
        lines.push(`${key}=${quotedValue}`)
      }
      lines.push('')
    }
    
    const content = lines.join('\n')
    
    // Write to temp file first
    await fs.writeFile(tempPath, content, 'utf-8')
    
    // Atomic rename (this is atomic on most filesystems)
    await fs.rename(tempPath, this.configPath)
  }
  
  /**
   * Validate configuration using existing validation system
   */
  private validateConfiguration(config: Record<string, string>): void {
    try {
      validateEnv(config)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      throw new Error(`Configuration validation failed: ${message}`)
    }
  }
  
  /**
   * Safe chaos flag toggle (prevents corruption)
   */
  async toggleChaos(enabled: boolean): Promise<void> {
    const reason = `chaos-${enabled ? 'enable' : 'disable'}`
    await this.updateConfig({ FF_CHAOS: enabled ? 'on' : 'off' }, reason)
  }

  /**
   * Execute operation with file locking to prevent concurrent access
   */
  async withConfigLock<T>(operation: () => Promise<T>, operationName = 'operation'): Promise<T> {
    const lockId = this.generateLockId()
    const lockPath = join(this.lockDir, `${lockId}.lock`)
    
    // Ensure lock directory exists
    await fs.mkdir(this.lockDir, { recursive: true })
    
    try {
      // Acquire lock
      await this.acquireLock(lockId, operationName, lockPath)
      
      console.log(`🔒 Configuration lock acquired: ${lockId} (${operationName})`)
      
      // Execute operation
      const result = await operation()
      
      console.log(`🔓 Configuration operation completed: ${lockId}`)
      
      return result
      
    } finally {
      // Always release lock
      await this.releaseLock(lockPath)
    }
  }
  
  /**
   * List available backups with metadata
   */
  async listBackups(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.backupDir)
      return files
        .filter(f => f.endsWith('.env'))
        .map(f => f.replace('.env', ''))
        .sort()
        .reverse() // Most recent first
    } catch {
      return []
    }
  }

  /**
   * Get detailed backup information
   */
  async getBackupInfo(backupId: string): Promise<BackupInfo> {
    const backupPath = join(this.backupDir, `${backupId}.env`)
    const metadataPath = join(this.backupDir, `${backupId}.json`)
    
    try {
      const exists = await this.fileExists(backupPath)
      let metadata: BackupMetadata
      
      if (await this.fileExists(metadataPath)) {
        const metadataContent = await fs.readFile(metadataPath, 'utf-8')
        metadata = JSON.parse(metadataContent)
      } else {
        // Create metadata for legacy backups
        const stats = await fs.stat(backupPath)
        const content = await fs.readFile(backupPath, 'utf-8')
        metadata = {
          id: backupId,
          timestamp: stats.mtime,
          configPath: this.configPath,
          reason: 'legacy',
          checksum: this.calculateChecksum(content),
          size: stats.size
        }
      }
      
      return { metadata, exists }
    } catch {
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
      }
    }
  }

  /**
   * Clean up old backups (keep last N backups)
   */
  async cleanupBackups(keepCount = 10): Promise<number> {
    const backups = await this.listBackups()
    const toDelete = backups.slice(keepCount)
    
    let deletedCount = 0
    for (const backupId of toDelete) {
      try {
        const backupPath = join(this.backupDir, `${backupId}.env`)
        const metadataPath = join(this.backupDir, `${backupId}.json`)
        
        await fs.unlink(backupPath)
        if (await this.fileExists(metadataPath)) {
          await fs.unlink(metadataPath)
        }
        deletedCount++
      } catch (error) {
        console.warn(`⚠️ Failed to delete backup ${backupId}:`, error)
      }
    }
    
    if (deletedCount > 0) {
      console.log(`🧹 Cleaned up ${deletedCount} old backups`)
    }
    
    return deletedCount
  }

  /**
   * Verify backup integrity
   */
  async verifyBackup(backupId: string): Promise<boolean> {
    try {
      const info = await this.getBackupInfo(backupId)
      if (!info.exists) return false
      
      const backupPath = join(this.backupDir, `${backupId}.env`)
      const content = await fs.readFile(backupPath, 'utf-8')
      const actualChecksum = this.calculateChecksum(content)
      
      return actualChecksum === info.metadata.checksum
    } catch {
      return false
    }
  }

  /**
   * Calculate simple checksum for content verification
   */
  private calculateChecksum(content: string): string {
    let hash = 0
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return hash.toString(16)
  }

  /**
   * Check if file exists
   */
  private async fileExists(path: string): Promise<boolean> {
    try {
      await fs.access(path)
      return true
    } catch {
      return false
    }
  }

  /**
   * Acquire configuration lock with timeout
   */
  private async acquireLock(lockId: string, operationName: string, lockPath: string): Promise<void> {
    const startTime = Date.now()
    const lock: ConfigLock = {
      id: lockId,
      timestamp: new Date(),
      operation: operationName,
      pid: process.pid
    }
    
    while (Date.now() - startTime < this.lockTimeout) {
      try {
        // Try to create lock file exclusively
        await fs.writeFile(lockPath, JSON.stringify(lock, null, 2), { flag: 'wx' })
        return // Lock acquired successfully
      } catch (error: any) {
        if (error.code === 'EEXIST') {
          // Lock file exists, check if it's stale
          try {
            const existingLockContent = await fs.readFile(lockPath, 'utf-8')
            const existingLock: ConfigLock = JSON.parse(existingLockContent)
            
            // Check if lock is stale (older than timeout)
            const lockAge = Date.now() - new Date(existingLock.timestamp).getTime()
            if (lockAge > this.lockTimeout) {
              console.log(`🧹 Removing stale configuration lock: ${existingLock.id} (age: ${Math.round(lockAge / 1000)}s)`)
              await fs.unlink(lockPath)
              continue // Try again
            }
            
            // Check if the process that created the lock is still running
            if (!this.isProcessRunning(existingLock.pid)) {
              console.log(`🧹 Removing orphaned configuration lock: ${existingLock.id} (PID ${existingLock.pid} not running)`)
              await fs.unlink(lockPath)
              continue // Try again
            }
            
            // Lock is valid, wait and retry
            console.log(`⏳ Waiting for configuration lock: ${existingLock.id} (${existingLock.operation})`)
            await this.delay(1000) // Wait 1 second
            
          } catch (parseError) {
            // Corrupted lock file, remove it
            console.log(`🧹 Removing corrupted configuration lock file`)
            try {
              await fs.unlink(lockPath)
            } catch {}
            continue // Try again
          }
        } else {
          throw error
        }
      }
    }
    
    throw new Error(`Failed to acquire configuration lock within ${this.lockTimeout}ms timeout`)
  }

  /**
   * Release configuration lock
   */
  private async releaseLock(lockPath: string): Promise<void> {
    try {
      await fs.unlink(lockPath)
    } catch (error) {
      // Lock file might already be removed, that's okay
      console.log(`⚠️ Failed to remove lock file (might already be removed):`, error)
    }
  }

  /**
   * Generate unique lock ID
   */
  private generateLockId(): string {
    return `config-lock-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Check if a process is still running
   */
  private isProcessRunning(pid: number): boolean {
    try {
      // Sending signal 0 checks if process exists without actually sending a signal
      process.kill(pid, 0)
      return true
    } catch {
      return false
    }
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Clean up stale locks on startup
   */
  async cleanupStaleLocks(): Promise<number> {
    try {
      const lockFiles = await fs.readdir(this.lockDir)
      let cleanedCount = 0
      
      for (const file of lockFiles) {
        if (file.endsWith('.lock')) {
          const lockPath = join(this.lockDir, file)
          try {
            const lockContent = await fs.readFile(lockPath, 'utf-8')
            const lock: ConfigLock = JSON.parse(lockContent)
            
            const lockAge = Date.now() - new Date(lock.timestamp).getTime()
            if (lockAge > this.lockTimeout || !this.isProcessRunning(lock.pid)) {
              await fs.unlink(lockPath)
              cleanedCount++
              console.log(`🧹 Cleaned up stale lock: ${lock.id}`)
            }
          } catch {
            // Corrupted lock file, remove it
            await fs.unlink(lockPath)
            cleanedCount++
          }
        }
      }
      
      if (cleanedCount > 0) {
        console.log(`🧹 Cleaned up ${cleanedCount} stale configuration locks`)
      }
      
      return cleanedCount
    } catch {
      // Lock directory doesn't exist yet
      return 0
    }
  }
}

// Export singleton instance for easy use
export const configManager = new ConfigurationManager()
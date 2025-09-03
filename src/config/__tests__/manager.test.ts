import { ConfigurationManager } from '../manager'
import { promises as fs } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

describe('ConfigurationManager', () => {
  let manager: ConfigurationManager
  let testDir: string
  let configPath: string

  beforeEach(async () => {
    // Create temporary directory for tests
    testDir = join(tmpdir(), `config-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`)
    await fs.mkdir(testDir, { recursive: true })
    
    configPath = join(testDir, '.env')
    
    // Create initial config file
    const initialConfig = [
      '# --- REQUIRED ---',
      'PORT=3000',
      'DATABASE_URL=postgresql://test:test@localhost:5432/test',
      'REDIS_URL=redis://localhost:6379',
      'TOKEN_HMAC_SECRET=test-secret',
      'SECRETS_BACKEND=env',
      'HTTP_TIMEOUT_MS=6000',
      'DEFAULT_TIMEZONE=America/Toronto',
      'KEK_BASE64=dGVzdC1rZXk=',
      '',
      '# --- OPTIONAL / FEATURE FLAGS ---',
      'FF_CACHE=on',
      'FF_RETRY=on',
      'FF_BREAKERS=on',
      'FF_ASYNC=on',
      'FF_POLICY=on',
      'UPSTREAM_MODE=mock',
      'FF_CHAOS=off',
      ''
    ].join('\n')
    
    await fs.writeFile(configPath, initialConfig)
    
    manager = new ConfigurationManager(configPath)
    
    // Clean up any stale locks
    await manager.cleanupStaleLocks()
  })

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true })
    } catch (error) {
      // Ignore cleanup errors
    }
  })

  describe('Configuration Updates', () => {
    test('should update configuration atomically', async () => {
      const changes = {
        PORT: '4000',
        FF_CHAOS: 'on'
      }

      await manager.updateConfig(changes, 'test-update')

      // Verify changes were applied
      const content = await fs.readFile(configPath, 'utf-8')
      expect(content).toContain('PORT=4000')
      expect(content).toContain('FF_CHAOS=on')
    })

    test('should create backup before update', async () => {
      const changes = { PORT: '5000' }
      
      await manager.updateConfig(changes, 'backup-test')
      
      const backups = await manager.listBackups()
      expect(backups.length).toBeGreaterThan(0)
      
      const latestBackup = backups[0]
      expect(latestBackup).toContain('backup-test')
    })

    test('should rollback on validation failure', async () => {
      const invalidChanges = {
        PORT: 'invalid-port' // This should fail validation
      }

      await expect(manager.updateConfig(invalidChanges, 'invalid-test')).rejects.toThrow()

      // Verify original config is preserved
      const content = await fs.readFile(configPath, 'utf-8')
      expect(content).toContain('PORT=3000') // Original value
    })

    test('should handle concurrent updates with locking', async () => {
      const updates = [
        manager.updateConfig({ PORT: '6000' }, 'concurrent-1'),
        manager.updateConfig({ PORT: '7000' }, 'concurrent-2'),
        manager.updateConfig({ PORT: '8000' }, 'concurrent-3')
      ]

      // All updates should complete without corruption
      await Promise.all(updates)

      // Final config should have one of the values (last one to complete)
      const content = await fs.readFile(configPath, 'utf-8')
      expect(content).toMatch(/PORT=(6000|7000|8000)/)
    })
  })

  describe('Backup Management', () => {
    test('should create backup with metadata', async () => {
      const backupId = await manager.createBackup('test-backup')
      
      expect(backupId).toMatch(/^env-backup-/)
      
      const backupInfo = await manager.getBackupInfo(backupId)
      expect(backupInfo.exists).toBe(true)
      expect(backupInfo.metadata.reason).toBe('test-backup')
      expect(backupInfo.metadata.checksum).toBeTruthy()
    })

    test('should list backups in reverse chronological order', async () => {
      await manager.createBackup('backup-1')
      await new Promise(resolve => setTimeout(resolve, 10)) // Small delay
      await manager.createBackup('backup-2')
      await new Promise(resolve => setTimeout(resolve, 10)) // Small delay
      await manager.createBackup('backup-3')

      const backups = await manager.listBackups()
      expect(backups.length).toBe(3)
      
      // Should be in reverse chronological order (newest first)
      expect(backups[0]).toContain('backup-3')
      expect(backups[1]).toContain('backup-2')
      expect(backups[2]).toContain('backup-1')
    })

    test('should rollback to specific backup', async () => {
      // Create backup of original state
      const originalBackup = await manager.createBackup('original')
      
      // Make changes
      await manager.updateConfig({ PORT: '9000' }, 'change')
      
      // Verify changes
      let content = await fs.readFile(configPath, 'utf-8')
      expect(content).toContain('PORT=9000')
      
      // Rollback
      await manager.rollbackConfig(originalBackup)
      
      // Verify rollback
      content = await fs.readFile(configPath, 'utf-8')
      expect(content).toContain('PORT=3000')
    })

    test('should clean up old backups', async () => {
      // Create multiple backups
      for (let i = 0; i < 15; i++) {
        await manager.createBackup(`backup-${i}`)
      }

      let backups = await manager.listBackups()
      expect(backups.length).toBe(15)

      // Clean up, keeping only 5
      const deletedCount = await manager.cleanupBackups(5)
      expect(deletedCount).toBe(10)

      backups = await manager.listBackups()
      expect(backups.length).toBe(5)
    })

    test('should verify backup integrity', async () => {
      const backupId = await manager.createBackup('integrity-test')
      
      // Verify backup is valid
      const isValid = await manager.verifyBackup(backupId)
      expect(isValid).toBe(true)
      
      // Verify non-existent backup
      const isInvalid = await manager.verifyBackup('non-existent-backup')
      expect(isInvalid).toBe(false)
    })
  })

  describe('File Locking', () => {
    test('should acquire and release locks properly', async () => {
      let lockAcquired = false
      let operationCompleted = false

      const result = await manager.withConfigLock(async () => {
        lockAcquired = true
        await new Promise(resolve => setTimeout(resolve, 100))
        operationCompleted = true
        return 'success'
      }, 'test-operation')

      expect(lockAcquired).toBe(true)
      expect(operationCompleted).toBe(true)
      expect(result).toBe('success')
    })

    test('should handle lock timeout', async () => {
      // Create a manager with very short timeout for testing
      const shortTimeoutManager = new (class extends ConfigurationManager {
        constructor() {
          super(configPath)
          // @ts-ignore - accessing private property for test
          this.lockTimeout = 100 // 100ms timeout
        }
      })()

      // Start a long-running operation
      const longOperation = shortTimeoutManager.withConfigLock(async () => {
        await new Promise(resolve => setTimeout(resolve, 200)) // 200ms operation
        return 'first'
      }, 'long-operation')

      // Try to acquire lock while first operation is running
      const timeoutPromise = shortTimeoutManager.withConfigLock(async () => {
        return 'second'
      }, 'timeout-operation')

      // First operation should succeed
      const firstResult = await longOperation
      expect(firstResult).toBe('first')

      // Second operation should timeout
      await expect(timeoutPromise).rejects.toThrow('Failed to acquire configuration lock')
    }, 10000)

    test('should clean up stale locks', async () => {
      const cleanedCount = await manager.cleanupStaleLocks()
      expect(typeof cleanedCount).toBe('number')
      expect(cleanedCount).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Chaos Toggle', () => {
    test('should toggle chaos flag safely', async () => {
      // Enable chaos
      await manager.toggleChaos(true)
      
      let content = await fs.readFile(configPath, 'utf-8')
      expect(content).toContain('FF_CHAOS=on')
      
      // Disable chaos
      await manager.toggleChaos(false)
      
      content = await fs.readFile(configPath, 'utf-8')
      expect(content).toContain('FF_CHAOS=off')
    })
  })

  describe('Error Handling', () => {
    test('should handle missing config file gracefully', async () => {
      const nonExistentPath = join(testDir, 'non-existent.env')
      const badManager = new ConfigurationManager(nonExistentPath)

      await expect(badManager.updateConfig({ TEST: 'value' })).rejects.toThrow()
    })

    test('should handle corrupted config file', async () => {
      // Write corrupted config
      await fs.writeFile(configPath, 'INVALID CONFIG CONTENT\n\x00\x01\x02')

      await expect(manager.updateConfig({ TEST: 'value' })).rejects.toThrow()
    })

    test('should handle rollback to non-existent backup', async () => {
      await expect(manager.rollbackConfig('non-existent-backup')).rejects.toThrow('Rollback failed')
    })
  })
})
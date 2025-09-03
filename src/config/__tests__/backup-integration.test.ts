import { ConfigurationManager } from '../manager'
import { promises as fs } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

describe('Configuration Backup System Integration', () => {
  let manager: ConfigurationManager
  let testDir: string
  let configPath: string

  beforeEach(async () => {
    // Create temporary directory for integration tests
    testDir = join(tmpdir(), `backup-integration-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`)
    await fs.mkdir(testDir, { recursive: true })
    
    configPath = join(testDir, '.env')
    
    // Create realistic initial config
    const initialConfig = [
      '# --- REQUIRED ---',
      'PORT=3000',
      'DATABASE_URL=postgresql://gateway:gateway@localhost:5432/gateway',
      'REDIS_URL=redis://localhost:6379',
      'TOKEN_HMAC_SECRET=production-secret-key',
      'SECRETS_BACKEND=env',
      'HTTP_TIMEOUT_MS=6000',
      'DEFAULT_TIMEZONE=America/Toronto',
      'KEK_BASE64=cHJvZHVjdGlvbi1rZXk=',
      '',
      '# --- OPTIONAL / FEATURE FLAGS ---',
      'FF_CACHE=on',
      'FF_RETRY=on',
      'FF_BREAKERS=on',
      'FF_ASYNC=on',
      'FF_POLICY=on',
      'UPSTREAM_MODE=production',
      'FF_CHAOS=off',
      ''
    ].join('\n')
    
    await fs.writeFile(configPath, initialConfig)
    manager = new ConfigurationManager(configPath)
    await manager.cleanupStaleLocks()
  })

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true })
    } catch (error) {
      // Ignore cleanup errors
    }
  })

  describe('End-to-End Backup and Rollback Scenarios', () => {
    test('should handle complete deployment rollback scenario', async () => {
      // Scenario: Production deployment with rollback capability
      
      // Step 1: Create pre-deployment backup
      const preDeploymentBackup = await manager.createBackup('pre-deployment-v2.1.0')
      
      // Step 2: Apply deployment configuration changes
      const deploymentChanges = {
        UPSTREAM_MODE: 'live',
        FF_CHAOS: 'on',
        HTTP_TIMEOUT_MS: '8000',
        NEW_FEATURE_FLAG: 'enabled'
      }
      
      await manager.updateConfig(deploymentChanges, 'deployment-v2.1.0')
      
      // Step 3: Verify deployment changes applied
      let content = await fs.readFile(configPath, 'utf-8')
      expect(content).toContain('UPSTREAM_MODE=live')
      expect(content).toContain('FF_CHAOS=on')
      expect(content).toContain('HTTP_TIMEOUT_MS=8000')
      expect(content).toContain('NEW_FEATURE_FLAG=enabled')
      
      // Step 4: Simulate deployment failure - rollback required
      await manager.rollbackConfig(preDeploymentBackup)
      
      // Step 5: Verify rollback restored original state
      content = await fs.readFile(configPath, 'utf-8')
      expect(content).toContain('UPSTREAM_MODE=production')
      expect(content).toContain('FF_CHAOS=off')
      expect(content).toContain('HTTP_TIMEOUT_MS=6000')
      expect(content).not.toContain('NEW_FEATURE_FLAG')
      
      // Step 6: Verify backup integrity
      const isValid = await manager.verifyBackup(preDeploymentBackup)
      expect(isValid).toBe(true)
    })

    test('should handle progressive configuration updates with rollback points', async () => {
      // Scenario: Multiple configuration updates with rollback points
      
      const checkpoints: string[] = []
      
      // Checkpoint 1: Enable caching optimizations
      checkpoints.push(await manager.createBackup('checkpoint-1-baseline'))
      await manager.updateConfig({
        FF_CACHE: 'on',
        CACHE_TTL: '3600'
      }, 'enable-caching')
      
      // Checkpoint 2: Enable async processing
      checkpoints.push(await manager.createBackup('checkpoint-2-caching'))
      await manager.updateConfig({
        FF_ASYNC: 'on',
        ASYNC_WORKERS: '4'
      }, 'enable-async')
      
      // Checkpoint 3: Enable circuit breakers
      checkpoints.push(await manager.createBackup('checkpoint-3-async'))
      await manager.updateConfig({
        FF_BREAKERS: 'on',
        BREAKER_THRESHOLD: '50'
      }, 'enable-breakers')
      
      // Verify final state
      let content = await fs.readFile(configPath, 'utf-8')
      expect(content).toContain('CACHE_TTL=3600')
      expect(content).toContain('ASYNC_WORKERS=4')
      expect(content).toContain('BREAKER_THRESHOLD=50')
      
      // Rollback to checkpoint 2 (before circuit breakers)
      await manager.rollbackConfig(checkpoints[2])
      
      content = await fs.readFile(configPath, 'utf-8')
      expect(content).toContain('CACHE_TTL=3600')
      expect(content).toContain('ASYNC_WORKERS=4')
      expect(content).not.toContain('BREAKER_THRESHOLD')
      
      // Rollback to baseline
      await manager.rollbackConfig(checkpoints[0])
      
      content = await fs.readFile(configPath, 'utf-8')
      expect(content).not.toContain('CACHE_TTL')
      expect(content).not.toContain('ASYNC_WORKERS')
      expect(content).not.toContain('BREAKER_THRESHOLD')
    })

    test('should handle chaos engineering configuration cycles', async () => {
      // Scenario: Chaos engineering with safe rollback
      
      // Create safe baseline
      const safeBaseline = await manager.createBackup('safe-baseline')
      
      // Enable chaos for testing
      await manager.toggleChaos(true)
      
      // Apply chaos-specific configuration
      await manager.updateConfig({
        CHAOS_MEMORY_LEAK: 'enabled',
        CHAOS_NETWORK_DELAY: '500ms',
        CHAOS_ERROR_RATE: '0.05'
      }, 'chaos-testing-config')
      
      // Verify chaos configuration
      let content = await fs.readFile(configPath, 'utf-8')
      expect(content).toContain('FF_CHAOS=on')
      expect(content).toContain('CHAOS_MEMORY_LEAK=enabled')
      expect(content).toContain('CHAOS_NETWORK_DELAY=500ms')
      
      // Simulate chaos test completion - restore safe state
      await manager.rollbackConfig(safeBaseline)
      
      // Verify safe state restored
      content = await fs.readFile(configPath, 'utf-8')
      expect(content).toContain('FF_CHAOS=off')
      expect(content).not.toContain('CHAOS_MEMORY_LEAK')
      expect(content).not.toContain('CHAOS_NETWORK_DELAY')
    })

    test('should handle backup versioning and cleanup in long-running scenario', async () => {
      // Scenario: Long-running system with many configuration changes
      
      const backupIds: string[] = []
      
      // Simulate 20 configuration changes over time
      for (let i = 1; i <= 20; i++) {
        const backupId = await manager.createBackup(`auto-backup-${i}`)
        backupIds.push(backupId)
        
        await manager.updateConfig({
          [`CONFIG_VERSION`]: `v1.0.${i}`,
          [`LAST_UPDATE`]: new Date().toISOString()
        }, `update-${i}`)
        
        // Small delay to ensure different timestamps
        await new Promise(resolve => setTimeout(resolve, 10))
      }
      
      // Verify all backups exist
      const allBackups = await manager.listBackups()
      expect(allBackups.length).toBeGreaterThanOrEqual(20)
      
      // Test backup cleanup (keep last 10)
      const deletedCount = await manager.cleanupBackups(10)
      expect(deletedCount).toBeGreaterThan(0)
      
      const remainingBackups = await manager.listBackups()
      expect(remainingBackups.length).toBeLessThanOrEqual(10)
      
      // Verify we can still rollback to recent backups
      const recentBackup = remainingBackups[2] // Third most recent
      await manager.rollbackConfig(recentBackup)
      
      // Verify rollback worked
      const content = await fs.readFile(configPath, 'utf-8')
      expect(content).toContain('CONFIG_VERSION=')
    })

    test('should handle concurrent backup operations safely', async () => {
      // Scenario: Multiple processes trying to create backups simultaneously
      
      const concurrentBackups = await Promise.all([
        manager.createBackup('concurrent-1'),
        manager.createBackup('concurrent-2'),
        manager.createBackup('concurrent-3'),
        manager.createBackup('concurrent-4'),
        manager.createBackup('concurrent-5')
      ])
      
      // All backups should be created successfully
      expect(concurrentBackups).toHaveLength(5)
      expect(new Set(concurrentBackups).size).toBe(5) // All unique IDs
      
      // Verify all backups exist and are valid
      for (const backupId of concurrentBackups) {
        const info = await manager.getBackupInfo(backupId)
        expect(info.exists).toBe(true)
        
        const isValid = await manager.verifyBackup(backupId)
        expect(isValid).toBe(true)
      }
    })

    test('should handle backup corruption and recovery', async () => {
      // Scenario: Backup file corruption and recovery
      
      // Create valid backup
      const backupId = await manager.createBackup('corruption-test')
      const backupInfo = await manager.getBackupInfo(backupId)
      expect(backupInfo.exists).toBe(true)
      
      // Simulate backup corruption by modifying the backup file
      const backupDir = join(testDir, '.env-backups')
      const backupPath = join(backupDir, `${backupId}.env`)
      
      // Corrupt the backup file
      await fs.writeFile(backupPath, 'CORRUPTED BACKUP CONTENT')
      
      // Verify corruption is detected
      const isValidAfterCorruption = await manager.verifyBackup(backupId)
      expect(isValidAfterCorruption).toBe(false)
      
      // Attempt rollback to corrupted backup should work (file exists)
      // but the content will be corrupted
      await expect(manager.rollbackConfig(backupId)).resolves.not.toThrow()
      
      // The config file should now contain the corrupted content
      const content = await fs.readFile(configPath, 'utf-8')
      expect(content).toBe('CORRUPTED BACKUP CONTENT')
    })

    test('should handle backup metadata persistence and recovery', async () => {
      // Scenario: Backup metadata handling and recovery
      
      // Create backup with detailed metadata
      const backupId = await manager.createBackup('metadata-test')
      
      // Get backup info
      const originalInfo = await manager.getBackupInfo(backupId)
      expect(originalInfo.metadata.reason).toBe('metadata-test')
      expect(originalInfo.metadata.checksum).toBeTruthy()
      expect(originalInfo.metadata.size).toBeGreaterThan(0)
      
      // Simulate metadata file deletion
      const backupDir = join(testDir, '.env-backups')
      const metadataPath = join(backupDir, `${backupId}.json`)
      await fs.unlink(metadataPath)
      
      // Get backup info again (should create legacy metadata)
      const recoveredInfo = await manager.getBackupInfo(backupId)
      expect(recoveredInfo.exists).toBe(true)
      expect(recoveredInfo.metadata.reason).toBe('legacy')
      expect(recoveredInfo.metadata.checksum).toBeTruthy()
    })
  })

  describe('Backup System Performance and Reliability', () => {
    test('should handle large configuration files efficiently', async () => {
      // Create large configuration file
      const largeConfig = [
        '# --- REQUIRED ---',
        'PORT=3000',
        'DATABASE_URL=postgresql://gateway:gateway@localhost:5432/gateway',
        'REDIS_URL=redis://localhost:6379'
      ]
      
      // Add many configuration entries
      for (let i = 0; i < 1000; i++) {
        largeConfig.push(`LARGE_CONFIG_${i}=value-${i}-${'x'.repeat(100)}`)
      }
      
      await fs.writeFile(configPath, largeConfig.join('\n'))
      
      // Test backup creation performance
      const startTime = Date.now()
      const backupId = await manager.createBackup('large-file-test')
      const backupTime = Date.now() - startTime
      
      // Should complete within reasonable time (5 seconds)
      expect(backupTime).toBeLessThan(5000)
      
      // Verify backup integrity
      const isValid = await manager.verifyBackup(backupId)
      expect(isValid).toBe(true)
      
      // Test rollback performance
      const rollbackStartTime = Date.now()
      await manager.rollbackConfig(backupId)
      const rollbackTime = Date.now() - rollbackStartTime
      
      // Rollback should also be fast
      expect(rollbackTime).toBeLessThan(5000)
    })

    test('should handle backup system under stress', async () => {
      // Stress test: Many rapid backup operations
      const stressBackups: string[] = []
      
      // Create 50 backups rapidly
      for (let i = 0; i < 50; i++) {
        const backupId = await manager.createBackup(`stress-test-${i}`)
        stressBackups.push(backupId)
        
        // Make small config change
        await manager.updateConfig({
          [`STRESS_TEST_${i}`]: `value-${i}`
        }, `stress-update-${i}`)
      }
      
      // Verify all backups are valid
      let validCount = 0
      for (const backupId of stressBackups) {
        const isValid = await manager.verifyBackup(backupId)
        if (isValid) validCount++
      }
      
      // At least 90% should be valid (allowing for some edge cases)
      expect(validCount / stressBackups.length).toBeGreaterThan(0.9)
      
      // Test cleanup under stress
      const deletedCount = await manager.cleanupBackups(5)
      expect(deletedCount).toBeGreaterThan(0)
      
      const remainingBackups = await manager.listBackups()
      expect(remainingBackups.length).toBeLessThanOrEqual(5)
    })
  })
})
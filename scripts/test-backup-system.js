#!/usr/bin/env node

/**
 * Integration test for Configuration Backup System
 * Tests backup creation, rollback, and verification
 */

const { ConfigurationManager } = require('../dist/config/manager')
const { promises: fs } = require('fs')
const { join } = require('path')

async function runTests() {
  console.log('🧪 Testing Configuration Backup System...\n')
  
  const configManager = new ConfigurationManager()
  let testsPassed = 0
  let testsTotal = 0
  
  async function test(name, testFn) {
    testsTotal++
    try {
      console.log(`🔍 ${name}...`)
      await testFn()
      console.log(`✅ ${name} - PASSED\n`)
      testsPassed++
    } catch (error) {
      console.log(`❌ ${name} - FAILED: ${error.message}\n`)
    }
  }
  
  // Test 1: Create backup
  await test('Create backup with metadata', async () => {
    const backupId = await configManager.createBackup('test-backup')
    if (!backupId.startsWith('env-backup-')) {
      throw new Error('Invalid backup ID format')
    }
    
    const info = await configManager.getBackupInfo(backupId)
    if (!info.exists) {
      throw new Error('Backup file not created')
    }
    if (info.metadata.reason !== 'test-backup') {
      throw new Error('Backup metadata incorrect')
    }
  })
  
  // Test 2: Verify backup integrity
  await test('Verify backup integrity', async () => {
    const backups = await configManager.listBackups()
    if (backups.length === 0) {
      throw new Error('No backups found')
    }
    
    const isValid = await configManager.verifyBackup(backups[0])
    if (!isValid) {
      throw new Error('Backup verification failed')
    }
  })
  
  // Test 3: Safe configuration update
  await test('Safe configuration update', async () => {
    const originalBackups = await configManager.listBackups()
    
    // Update a non-critical setting
    await configManager.updateConfig({ 
      HTTP_TIMEOUT_MS: '7000' 
    }, 'test-update')
    
    const newBackups = await configManager.listBackups()
    if (newBackups.length <= originalBackups.length) {
      throw new Error('Backup not created during update')
    }
    
    // Verify the change was applied
    const content = await fs.readFile('config/.env', 'utf-8')
    if (!content.includes('HTTP_TIMEOUT_MS=7000')) {
      throw new Error('Configuration update not applied')
    }
  })
  
  // Test 4: Rollback functionality
  await test('Rollback to previous configuration', async () => {
    const backups = await configManager.listBackups()
    
    // Find a backup that's not the most recent
    let rollbackTarget = null
    for (const backup of backups) {
      const info = await configManager.getBackupInfo(backup)
      if (info.metadata.reason !== 'test-update') {
        rollbackTarget = backup
        break
      }
    }
    
    if (!rollbackTarget) {
      throw new Error('No suitable rollback target found')
    }
    
    await configManager.rollbackConfig(rollbackTarget)
    
    // Verify rollback worked
    const content = await fs.readFile('config/.env', 'utf-8')
    if (content.includes('HTTP_TIMEOUT_MS=7000')) {
      throw new Error('Rollback did not revert changes')
    }
  })
  
  // Test 5: Chaos toggle safety
  await test('Safe chaos toggle', async () => {
    const beforeBackups = await configManager.listBackups()
    
    // Toggle chaos on
    await configManager.toggleChaos(true)
    
    const afterBackups = await configManager.listBackups()
    if (afterBackups.length <= beforeBackups.length) {
      throw new Error('Backup not created during chaos toggle')
    }
    
    // Verify chaos is enabled
    const content = await fs.readFile('config/.env', 'utf-8')
    if (!content.includes('FF_CHAOS=on')) {
      throw new Error('Chaos mode not enabled')
    }
    
    // Toggle back off
    await configManager.toggleChaos(false)
    
    const finalContent = await fs.readFile('config/.env', 'utf-8')
    if (!finalContent.includes('FF_CHAOS=off')) {
      throw new Error('Chaos mode not disabled')
    }
  })
  
  // Test 6: Backup cleanup
  await test('Backup cleanup', async () => {
    const beforeBackups = await configManager.listBackups()
    
    if (beforeBackups.length < 3) {
      // Create some extra backups for testing
      await configManager.createBackup('cleanup-test-1')
      await configManager.createBackup('cleanup-test-2')
      await configManager.createBackup('cleanup-test-3')
    }
    
    const deletedCount = await configManager.cleanupBackups(2)
    const afterBackups = await configManager.listBackups()
    
    if (afterBackups.length > 2) {
      throw new Error('Cleanup did not remove enough backups')
    }
    
    if (deletedCount === 0 && beforeBackups.length > 2) {
      throw new Error('Cleanup should have deleted some backups')
    }
  })
  
  // Summary
  console.log('📊 Test Results:')
  console.log(`   Passed: ${testsPassed}/${testsTotal}`)
  console.log(`   Success Rate: ${Math.round(testsPassed / testsTotal * 100)}%`)
  
  if (testsPassed === testsTotal) {
    console.log('\n🎉 All tests passed! Configuration backup system is working correctly.')
    process.exit(0)
  } else {
    console.log('\n❌ Some tests failed. Please check the configuration backup system.')
    process.exit(1)
  }
}

runTests().catch(error => {
  console.error('💥 Test runner failed:', error)
  process.exit(1)
})
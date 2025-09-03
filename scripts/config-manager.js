#!/usr/bin/env node

/**
 * Configuration Manager CLI
 * Safe configuration updates for 4RUNR Gateway
 * 
 * Usage:
 *   node scripts/config-manager.js toggle-chaos on
 *   node scripts/config-manager.js toggle-chaos off
 *   node scripts/config-manager.js backup
 *   node scripts/config-manager.js rollback <backup-id>
 *   node scripts/config-manager.js list-backups
 */

const { ConfigurationManager } = require('../dist/config/manager')

async function main() {
  const [,, command, ...args] = process.argv
  const configManager = new ConfigurationManager()
  
  try {
    switch (command) {
      case 'toggle-chaos':
        const enabled = args[0] === 'on'
        await configManager.toggleChaos(enabled)
        console.log(`✅ Chaos mode ${enabled ? 'enabled' : 'disabled'}`)
        break
        
      case 'backup':
        const backupId = await configManager.createBackup()
        console.log(`✅ Backup created: ${backupId}`)
        break
        
      case 'rollback':
        const targetBackup = args[0]
        if (!targetBackup) {
          console.error('❌ Please specify backup ID')
          process.exit(1)
        }
        await configManager.rollbackConfig(targetBackup)
        break
        
      case 'list-backups':
        const backups = await configManager.listBackups()
        if (backups.length === 0) {
          console.log('No backups found')
        } else {
          console.log('Available backups:')
          for (const backup of backups.slice(0, 5)) { // Show last 5
            const info = await configManager.getBackupInfo(backup)
            const date = new Date(info.metadata.timestamp).toLocaleString()
            const size = Math.round(info.metadata.size / 1024 * 100) / 100
            console.log(`  ${backup}`)
            console.log(`    Date: ${date}`)
            console.log(`    Reason: ${info.metadata.reason}`)
            console.log(`    Size: ${size}KB`)
            console.log('')
          }
          if (backups.length > 5) {
            console.log(`  ... and ${backups.length - 5} more backups`)
          }
        }
        break
        
      case 'update':
        const key = args[0]
        const value = args[1]
        if (!key || value === undefined) {
          console.error('❌ Usage: update <key> <value>')
          process.exit(1)
        }
        await configManager.updateConfig({ [key]: value }, 'manual-update')
        break
        
      case 'verify':
        const verifyBackup = args[0]
        if (!verifyBackup) {
          console.error('❌ Please specify backup ID')
          process.exit(1)
        }
        const isValid = await configManager.verifyBackup(verifyBackup)
        console.log(`${isValid ? '✅' : '❌'} Backup ${verifyBackup} is ${isValid ? 'valid' : 'corrupted'}`)
        break
        
      case 'cleanup':
        const keepCount = parseInt(args[0]) || 10
        const deletedCount = await configManager.cleanupBackups(keepCount)
        console.log(`🧹 Cleanup complete. Deleted ${deletedCount} old backups.`)
        break
        
      case 'info':
        const infoBackup = args[0]
        if (!infoBackup) {
          console.error('❌ Please specify backup ID')
          process.exit(1)
        }
        const backupInfo = await configManager.getBackupInfo(infoBackup)
        if (!backupInfo.exists) {
          console.log(`❌ Backup ${infoBackup} not found`)
        } else {
          const meta = backupInfo.metadata
          console.log(`📦 Backup Information: ${meta.id}`)
          console.log(`   Created: ${new Date(meta.timestamp).toLocaleString()}`)
          console.log(`   Reason: ${meta.reason}`)
          console.log(`   Size: ${Math.round(meta.size / 1024 * 100) / 100}KB`)
          console.log(`   Checksum: ${meta.checksum}`)
          console.log(`   Valid: ${await configManager.verifyBackup(infoBackup) ? '✅' : '❌'}`)
        }
        break
        
      default:
        console.log(`
Configuration Manager CLI

Commands:
  toggle-chaos <on|off>     - Safely toggle chaos mode
  backup                    - Create configuration backup
  rollback <backup-id>      - Rollback to specific backup
  list-backups             - List available backups with details
  update <key> <value>     - Update configuration value
  verify <backup-id>       - Verify backup integrity
  cleanup [keep-count]     - Clean up old backups (default: keep 10)
  info <backup-id>         - Show detailed backup information

Examples:
  node scripts/config-manager.js toggle-chaos on
  node scripts/config-manager.js backup
  node scripts/config-manager.js rollback env-backup-2025-08-18T16-00-00-000Z
  node scripts/config-manager.js verify env-backup-2025-08-18T16-00-00-000Z
  node scripts/config-manager.js cleanup 5
        `)
    }
  } catch (error) {
    console.error(`❌ Error: ${error.message}`)
    process.exit(1)
  }
}

main()
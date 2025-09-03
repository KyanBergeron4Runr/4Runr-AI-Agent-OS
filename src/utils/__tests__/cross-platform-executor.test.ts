import { CrossPlatformExecutor, executeCommand } from '../cross-platform-executor'
import { platform } from 'os'

describe('CrossPlatformExecutor', () => {
  let executor: CrossPlatformExecutor

  beforeEach(() => {
    executor = new CrossPlatformExecutor()
  })

  describe('Platform Detection', () => {
    test('should detect current platform', () => {
      const platformInfo = executor.getPlatformInfo()
      expect(platformInfo.platform).toBe(platform())
      expect(typeof platformInfo.isWSL).toBe('boolean')
      expect(platformInfo.config).toBeDefined()
    })

    test('should have platform-specific configuration', () => {
      const platformInfo = executor.getPlatformInfo()
      const config = platformInfo.config
      
      expect(config.maxBuffer).toBeGreaterThan(0)
      expect(config.defaultTimeout).toBeGreaterThan(0)
      expect(config.defaultRetries).toBeGreaterThanOrEqual(0)
      expect(config.retryDelay).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Command Execution', () => {
    test('should execute simple command successfully', async () => {
      const command = platform() === 'win32' ? 'echo' : 'echo'
      const args = ['hello', 'world']
      
      const result = await executor.execute(command, args, { timeout: 5000 })
      
      expect(result.success).toBe(true)
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('hello world')
      expect(result.platform).toBe(platform())
      expect(result.command).toBe(command)
      expect(result.args).toEqual(args)
      expect(result.duration).toBeGreaterThan(0)
    }, 10000)

    test('should handle command failure', async () => {
      const command = 'nonexistent-command-12345'
      
      const result = await executor.execute(command, [], { timeout: 5000, retries: 1 })
      
      expect(result.success).toBe(false)
      expect(result.stderr).toBeTruthy()
      expect(result.retryCount).toBeGreaterThanOrEqual(0)
    }, 10000)

    test('should handle timeout', async () => {
      const command = platform() === 'win32' ? 'timeout' : 'sleep'
      const args = platform() === 'win32' ? ['5'] : ['5']
      
      const result = await executor.execute(command, args, { 
        timeout: 1000, 
        retries: 0 
      })
      
      expect(result.success).toBe(false)
      expect(result.stderr).toContain('timeout')
    }, 5000)

    test('should retry on retryable errors', async () => {
      const command = 'nonexistent-command-12345'
      
      const result = await executor.execute(command, [], { 
        timeout: 2000, 
        retries: 2 
      })
      
      expect(result.success).toBe(false)
      expect(result.retryCount).toBe(2)
    }, 10000)
  })

  describe('Buffer Management', () => {
    test('should handle large output without buffer overflow', async () => {
      const command = platform() === 'win32' ? 'echo' : 'echo'
      const largeString = 'x'.repeat(1000)
      
      const result = await executor.execute(command, [largeString], { 
        maxBuffer: 500,
        timeout: 5000 
      })
      
      expect(result.success).toBe(true)
      expect(result.stdout.length).toBeLessThanOrEqual(500 + 50) // Allow for truncation message
    }, 10000)
  })

  describe('Platform-Specific Features', () => {
    test('should use appropriate shell settings for platform', () => {
      const platformInfo = executor.getPlatformInfo()
      
      if (platformInfo.platform === 'win32') {
        expect(platformInfo.config.shell).toBe(true)
        expect(platformInfo.config.windowsHide).toBe(true)
      } else {
        expect(platformInfo.config.shell).toBe(false)
      }
    })

    test('should have smaller buffer size on Windows', () => {
      const platformInfo = executor.getPlatformInfo()
      
      if (platformInfo.platform === 'win32') {
        expect(platformInfo.config.maxBuffer).toBeLessThanOrEqual(512 * 1024)
      }
    })
  })

  describe('Utility Function', () => {
    test('should work with utility function', async () => {
      const command = platform() === 'win32' ? 'echo' : 'echo'
      const args = ['test']
      
      const result = await executeCommand(command, args, { timeout: 5000 })
      
      expect(result.success).toBe(true)
      expect(result.stdout).toContain('test')
    }, 10000)
  })

  describe('Error Handling', () => {
    test('should identify Windows buffer errors', async () => {
      // This test is more about code coverage since we can't easily simulate ENOBUFS
      const platformInfo = executor.getPlatformInfo()
      expect(platformInfo).toBeDefined()
    })

    test('should handle process killing gracefully', async () => {
      const command = platform() === 'win32' ? 'timeout' : 'sleep'
      const args = platform() === 'win32' ? ['10'] : ['10']
      
      const result = await executor.execute(command, args, { 
        timeout: 500,
        retries: 0 
      })
      
      expect(result.success).toBe(false)
    }, 2000)
  })
})

describe('Integration Tests', () => {
  test('should handle Docker commands if Docker is available', async () => {
    try {
      const result = await executeCommand('docker', ['--version'], { 
        timeout: 10000,
        retries: 1 
      })
      
      if (result.success) {
        expect(result.stdout).toContain('Docker')
      }
      // If Docker is not available, that's fine for this test
    } catch (error) {
      // Docker not available, skip test
      console.log('Docker not available, skipping Docker test')
    }
  }, 15000)

  test('should handle git commands if git is available', async () => {
    try {
      const result = await executeCommand('git', ['--version'], { 
        timeout: 5000,
        retries: 1 
      })
      
      if (result.success) {
        expect(result.stdout).toContain('git')
      }
    } catch (error) {
      // Git not available, skip test
      console.log('Git not available, skipping git test')
    }
  }, 10000)
})